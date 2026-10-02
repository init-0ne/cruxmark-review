import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'node:net'
import { setTimeout as pause } from 'node:timers/promises'
import { createPublicClient, createWalletClient, custom, encodeFunctionData, http, InsufficientFundsError, keccak256, parseEventLogs, toEventSelector } from 'viem'
import { foundry } from 'viem/chains'
import { executionAbi, factoryAbi, BORROW_CORRECT, BORROW_INCORRECT, BORROW_PROBE, DEPOSIT_AMOUNT } from '../src/contracts.ts'
import { actionOutcome, confirmAction, encodeSubmission, guardMessages, restoreSubmission, loadOwnedRuns, loadRun, readSnapshot, submitAction, SupersededTransactionError, verifyFactory } from '../src/execution.ts'
import { buildEvidenceReport, nextLabStep, observedFault, serialize, validateEvidenceReport } from '../src/evidence.ts'
import { verifyReportOnChain } from '../src/verification.ts'
import { assertWalletSession, connectLocalAccount, classifyError, getProvider, readWalletSession, switchToSelectedChain } from '../src/wallet.ts'

function labSnapshot(fault, debt = 0n) {
  const now = 20_000n
  const grace = 3_600n
  const maxAge = 300n
  const token = 10n ** 18n
  const priceAt = fault === 'stale' ? now - maxAge - 1n : now
  const blocked = fault === 'paused' || fault === 'stale' || fault === 'down' || fault === 'grace'
  return {
    block: { number: 3n, hash: `0x${'ab'.repeat(32)}`, timestamp: now },
    inputs: {
      multiplier: fault === 'split' ? 2n * token : token, paused: fault === 'paused', priceDecimals: 8,
      price: { answer: 100n * 10n ** 8n, startedAt: priceAt, updatedAt: priceAt },
      sequencer: { status: fault === 'down' ? 1n : 0n, startedAt: fault === 'down' || fault === 'grace' ? now : now - grace - 1n, updatedAt: now },
      maxAge, gracePeriod: grace,
    },
    unsafe: { collateral: 100n * token, debt, value: fault === 'split' ? 20_000n * token : 10_000n * token, cap: fault === 'split' ? 12_000n * token : 6_000n * token },
    guarded: blocked
      ? { collateral: 100n * token, debt, error: fault === 'down' || fault === 'grace' ? 'SequencerUnavailable' : 'PriceUnavailable' }
      : { collateral: 100n * token, debt, value: 10_000n * token, cap: 6_000n * token },
  }
}
for (const fault of ['healthy', 'split', 'paused', 'stale', 'down', 'grace']) assert.equal(observedFault(labSnapshot(fault)), fault)
assert.equal(nextLabStep('split', undefined, []), 'Create an isolated run, then prepare 100 tokens in each consumer.')
const unprepared = labSnapshot('healthy')
unprepared.unsafe.collateral = 0n
unprepared.guarded.collateral = 0n
assert.equal(nextLabStep('split', unprepared, []), 'Prepare 100 tokens in each consumer.')
const oversized = labSnapshot('healthy')
oversized.unsafe.collateral += 1n
assert.equal(nextLabStep('price', oversized, []), 'This run holds more than 100 tokens in a consumer. Create a fresh isolated run so the example caps stay exact.')
assert.equal(nextLabStep('split', labSnapshot('healthy'), []), 'Seed Stock split.')
assert.equal(nextLabStep('split', labSnapshot('split'), []), 'Borrow $12k unsafe.')
assert.equal(nextLabStep('split', labSnapshot('split', 1n), []), 'Repay all debt, then borrow $12k unsafe.')
assert.equal(nextLabStep('price', labSnapshot('paused'), []), 'Restore healthy inputs, then borrow $1k healthy control.')
assert.equal(nextLabStep('sequencer', labSnapshot('down'), []), 'Simulate post-grace control, then borrow $1k healthy control.')
assert.equal(nextLabStep('price', labSnapshot('healthy'), []), 'Borrow $1k healthy control.')
assert.equal(nextLabStep('price', labSnapshot('healthy', 6_000n * 10n ** 18n), []), 'Repay all debt, then borrow $1k healthy control.')
function coverageRecord(action, before, after, status = 'success', replayError) {
  return { action, before, after, receipt: { status }, ...(replayError ? { replayError } : {}) }
}
const probe = 1_000n * 10n ** 18n
const healthyBefore = labSnapshot('healthy')
const healthyAfter = structuredClone(healthyBefore)
healthyAfter.guarded.debt = probe
const pausedAt = labSnapshot('paused', probe)
const staleAt = labSnapshot('stale', probe)
const priceRecords = [
  coverageRecord({ type: 'borrow', consumer: 'guarded', amount: probe }, healthyBefore, healthyAfter),
  coverageRecord({ type: 'borrow', consumer: 'unsafe', amount: probe }, pausedAt, structuredClone(pausedAt)),
  coverageRecord({ type: 'borrow', consumer: 'guarded', amount: probe, expectedError: 'PriceUnavailable' }, pausedAt, pausedAt, 'reverted', 'PriceUnavailable'),
  coverageRecord({ type: 'borrow', consumer: 'unsafe', amount: probe }, staleAt, structuredClone(staleAt)),
  coverageRecord({ type: 'borrow', consumer: 'guarded', amount: probe, expectedError: 'PriceUnavailable' }, staleAt, staleAt, 'reverted', 'PriceUnavailable'),
]
priceRecords[1].after.unsafe.debt += probe
priceRecords[3].after.unsafe.debt += probe
assert.equal(nextLabStep('price', staleAt, priceRecords), 'Repay all debt while guarded pricing stays blocked.')

const server = createServer()
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
await new Promise((resolve) => server.close(resolve))
// Run on the EVM level the contracts target (evm_version = paris): the Robinhood testnet RPC is flagged as lacking PUSH0, and a
// pre-Shanghai chain rejects it, so this fails if the compiler target is ever raised.
const node = spawn('anvil', ['--host', '127.0.0.1', '--port', String(port), '--chain-id', '31337', '--hardfork', 'paris', '--silent'], { stdio: 'ignore' })
const client = createPublicClient({ chain: foundry, transport: http(`http://127.0.0.1:${port}`, { retryCount: 0, timeout: 3000 }), cacheTime: 0 })
try {
  let ready = false
  for (let i = 0; i < 100; i++) {
    try { await client.getChainId(); ready = true; break } catch { await pause(50) }
  }
  assert(ready, 'Isolated Anvil did not start')
  const wallet = createWalletClient({ chain: foundry, transport: http(`http://127.0.0.1:${port}`) })
  const [owner, other] = await wallet.getAddresses()
  const artifact = JSON.parse(readFileSync('contracts/out/ScenarioFactory.sol/ScenarioFactory.json', 'utf8'))
  const codeHash = keccak256(artifact.deployedBytecode.object)
  const deploymentHash = await wallet.deployContract({ account: owner, abi: artifact.abi, bytecode: artifact.bytecode.object })
  const deployment = await client.waitForTransactionReceipt({ hash: deploymentHash })
  assert.equal(deployment.status, 'success')
  const factory = deployment.contractAddress
  await verifyFactory(client, factory, 31337, codeHash)
  mkdirSync('work/verification', { recursive: true })
  writeFileSync('work/verification/broadcast.json', JSON.stringify({ transactions: [{ contractName: 'ScenarioFactory', contractAddress: factory, hash: deploymentHash }] }))
  execFileSync(process.execPath, ['scripts/verify-deployment.mjs', '--network', 'local', '--rpc-url', `http://127.0.0.1:${port}`, '--broadcast', 'work/verification/broadcast.json', '--output', 'work/verification/deployment.json'], { stdio: 'pipe' })
  const manifest = JSON.parse(readFileSync('work/verification/deployment.json', 'utf8'))
  assert.equal(manifest.factory.runtimeCodeHash, codeHash)
  assert.equal(manifest.deployment.status, 'success')

  await assert.rejects(verifyFactory(client, factory, 1, codeHash), /Wrong network/)
  await assert.rejects(verifyFactory(client, factory, 31337, `0x${'0'.repeat(64)}`), /bytecode/)
  await assert.rejects(verifyFactory(client, owner, 31337, codeHash), /bytecode/)
  async function create(account) {
    const hash = await wallet.writeContract({ address: factory, abi: factoryAbi, functionName: 'createScenario', account })
    const receipt = await client.waitForTransactionReceipt({ hash })
    assert.equal(receipt.status, 'success')
    return parseEventLogs({ abi: factoryAbi, logs: receipt.logs, eventName: 'ScenarioCreated' })[0].args.instance
  }
  const instance = await create(owner)
  const otherInstance = await create(other)
  assert.deepEqual(await loadOwnedRuns(client, factory, owner), [instance])
  assert.deepEqual(await loadOwnedRuns(client, factory, other), [otherInstance])
  await assert.rejects(loadRun(client, factory, instance, other), /another wallet/)
  const run = await loadRun(client, factory, instance, owner)
  const otherRun = await loadRun(client, factory, otherInstance, other)
  const records = []
  async function execute(action) {
    const tickingWallet = new Proxy(wallet, { get(target, key) { return key === 'writeContract' ? async (request) => { await client.request({ method: 'evm_increaseTime', params: [1] }); return wallet.writeContract(request) } : target[key] } })
    const pending = await submitAction(client, tickingWallet, owner, run, action, codeHash)
    const confirmed = await confirmAction(client, pending)
    assert.equal(actionOutcome(confirmed), action.expectedError ? 'blocked' : 'confirmed', JSON.stringify(serialize(confirmed)))
    records.push(confirmed)
    return confirmed
  }
  for (const consumer of ['unsafe', 'guarded']) await execute({ type: 'deposit', consumer, amount: DEPOSIT_AMOUNT })
  await execute({ type: 'configure', fault: 1 })
  assert.equal((await readSnapshot(client, otherRun, other)).inputs.multiplier, 10n ** 18n)
  await execute({ type: 'borrow', consumer: 'unsafe', amount: BORROW_INCORRECT })
  await execute({ type: 'borrow', consumer: 'guarded', amount: BORROW_INCORRECT, expectedError: 'BorrowExceedsCap' })
  await execute({ type: 'borrow', consumer: 'guarded', amount: BORROW_CORRECT })
  for (const [consumer, amount] of [['unsafe', BORROW_INCORRECT], ['guarded', BORROW_CORRECT]]) await execute({ type: 'repay', consumer, amount })
  await execute({ type: 'configure', fault: 0 })
  await assert.rejects(submitAction(client, wallet, owner, run, { type: 'borrow', consumer: 'guarded', amount: BORROW_PROBE, expectedError: 'PriceUnavailable' }, codeHash), /did not reject/)
  for (const fault of [2, 3, 4, 5]) {
    await execute({ type: 'configure', fault: 0 })
    await execute({ type: 'borrow', consumer: 'guarded', amount: BORROW_PROBE })
    await execute({ type: 'configure', fault })
    const blocked = await readSnapshot(client, run, owner)
    assert.equal(blocked.guarded.error, fault < 4 ? 'PriceUnavailable' : 'SequencerUnavailable')
    assert.equal(blocked.guarded.debt, BORROW_PROBE, 'Blocked pricing must not hide debt')
    await assert.rejects(submitAction(client, wallet, owner, run, { type: 'borrow', consumer: 'guarded', amount: BORROW_PROBE, expectedError: 'BorrowExceedsCap' }, codeHash))
    const expired = await submitAction(client, wallet, owner, run, { type: 'borrow', consumer: 'guarded', amount: BORROW_PROBE }, codeHash).then(() => assert.fail('A blocked borrow must not be signed'), (error) => classifyError(error))
    assert.deepEqual(expired, { kind: 'reverted', message: guardMessages[fault < 4 ? 'PriceUnavailable' : 'SequencerUnavailable'] })
    await execute({ type: 'borrow', consumer: 'unsafe', amount: BORROW_PROBE })
    await execute({ type: 'borrow', consumer: 'guarded', amount: BORROW_PROBE, expectedError: fault < 4 ? 'PriceUnavailable' : 'SequencerUnavailable' })
    await execute({ type: 'repay', consumer: 'guarded', amount: BORROW_PROBE })
    await execute({ type: 'repay', consumer: 'unsafe', amount: BORROW_PROBE })
  }
  // Recovery grace is still seeded. A borrow that dies for lack of gas is not a guard rejection, even though replaying
  // the same call at that block reverts with the guard's own error.
  // 22,000 runs out directly; 30,000 runs out inside the nested call to the guard and leaves 16 gas over, so a
  // gasUsed < limit test would miss it. A clean rejection costs 38,877 gas.
  for (const gas of [22_000n, 30_000n]) {
    const starved = await wallet.writeContract({ address: run.guarded, abi: executionAbi, functionName: 'borrow', args: [BORROW_PROBE], account: owner, gas })
    const starvedRecord = await confirmAction(client, { hash: starved, chainId: 31337, owner, contracts: run, action: { type: 'borrow', consumer: 'guarded', amount: BORROW_PROBE, expectedError: 'SequencerUnavailable' }, before: await readSnapshot(client, run, owner) })
    assert.equal(starvedRecord.receipt.status, 'reverted')
    assert.equal(starvedRecord.replayError, undefined, `out of gas at a ${gas} limit must not be recorded as a guard rejection`)
    assert.equal(actionOutcome(starvedRecord), 'unexpected')
  }
  await execute({ type: 'configure', fault: 0 })
  await execute({ type: 'borrow', consumer: 'guarded', amount: BORROW_PROBE })
  await execute({ type: 'repay', consumer: 'guarded', amount: BORROW_PROBE })
  // Deliberately lose a submitted-action response. Reconcile the same hash rather than rebroadcasting.
  const pending = await submitAction(client, wallet, owner, run, { type: 'configure', fault: 1 }, codeHash)
  const restored = await restoreSubmission(client, encodeSubmission({ type: 'action', value: pending }), owner, factory, 31337, codeHash)
  assert.equal(restored.type, 'action')
  assert.equal(restored.value.action.fault, 1)
  assert.equal(restored.value.before.block.hash, pending.before.block.hash)
  await assert.rejects(restoreSubmission(client, encodeSubmission({ type: 'action', value: pending }), other, factory, 31337, codeHash), /different wallet/)
  const recovered = await confirmAction(client, restored.value)
  assert.equal(recovered.hash, pending.hash)
  await assert.rejects(confirmAction(client, { ...pending, chainId: 421614 }), /Wrong network/)
  await assert.rejects(submitAction(client, wallet, owner, run, { type: 'deposit', consumer: 'unsafe', amount: 0n }, codeHash), /positive/)
  const noRpc = new Proxy(client, { get(target, key) { return key === 'readContract' ? async () => { throw new Error('RPC unavailable') } : target[key] } })
  await assert.rejects(readSnapshot(noRpc, run, owner), /RPC unavailable/)
  records.push(recovered)
  const replaced = new Proxy(client, { get(target, key) { return key === 'waitForTransactionReceipt' ? async () => client.getTransactionReceipt({ hash: records[0].hash }) : target[key] } })
  await assert.rejects(confirmAction(replaced, pending), SupersededTransactionError)
  const snapshot = await readSnapshot(client, run, owner)
  const source = { revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), compiler: '0.8.30', evmVersion: 'paris', optimizerRuns: 200, factoryCodeHash: codeHash }
  const report = buildEvidenceReport({ owner, contracts: run, chainId: 31337, chainName: 'Isolated local check', source, snapshot, actions: records })
  assert.equal(report.result, 'complete')
  assert.equal(report.checks.length, 15)
  function stepAfter(match, family) {
    const index = records.findIndex(match)
    assert(index >= 0, 'Expected action was not recorded')
    const slice = records.slice(0, index + 1)
    return nextLabStep(family, slice.at(-1).after, slice)
  }
  assert.equal(stepAfter((record) => record.action.type === 'deposit' && record.action.consumer === 'guarded', 'split'), 'Seed Stock split.')
  assert.equal(stepAfter((record) => record.action.type === 'configure' && record.action.fault === 1, 'split'), 'Borrow $12k unsafe.')
  assert.equal(stepAfter((record) => record.action.type === 'borrow' && record.action.consumer === 'unsafe' && record.action.amount === BORROW_INCORRECT, 'split'), 'Test $12k guarded rejection.')
  assert.equal(stepAfter((record) => record.action.expectedError === 'BorrowExceedsCap', 'split'), 'Borrow $6k guarded control.')
  assert.equal(stepAfter((record) => record.action.type === 'borrow' && record.action.amount === BORROW_CORRECT, 'split'), 'Stock split checks are recorded. Switch family or download the evidence JSON.')
  assert.equal(stepAfter((record) => record.action.type === 'configure' && record.action.fault === 0, 'price'), 'Borrow $1k healthy control.')
  assert.equal(stepAfter((record) => record.action.type === 'borrow' && record.action.consumer === 'guarded' && record.action.amount === BORROW_PROBE && !record.action.expectedError, 'price'), 'Seed Paused price.')
  assert.equal(stepAfter((record) => record.action.type === 'configure' && record.action.fault === 2, 'price'), 'Borrow $1k unsafe.')
  assert.equal(stepAfter((record) => record.action.type === 'borrow' && record.action.consumer === 'unsafe' && record.action.amount === BORROW_PROBE, 'price'), 'Test $1k guarded rejection.')
  assert.equal(stepAfter((record) => record.action.expectedError === 'PriceUnavailable' && observedFault(record.after) === 'paused', 'price'), 'Seed Stale price.')
  assert.equal(nextLabStep('split', snapshot, records), 'Stock split checks are recorded. Switch family or download the evidence JSON.')
  assert.equal(nextLabStep('price', snapshot, records), 'Unavailable-price checks are recorded. Switch family or download the evidence JSON.')
  assert.equal(nextLabStep('sequencer', snapshot, records), 'Sequencer checks are recorded. Switch family or download the evidence JSON.')
  assert(validateEvidenceReport(JSON.parse(JSON.stringify(report))))
  const bad = (edit) => { const copy = structuredClone(report); edit(copy); assert(!validateEvidenceReport(copy)) }
  bad((r) => { r.actions[0].receipt.status = 'pending' })
  bad((r) => { r.actions[0].receipt.block.hash = `0x${'f'.repeat(64)}` })
  bad((r) => { r.actions[0].owner = other })
  bad((r) => { r.actions[0].action.amount = '100' })
  bad((r) => { r.actions.push(r.actions[0]) })
  bad((r) => { r.chain.id = 1 })
  bad((r) => { r.observations.unsafe.debt = 1.1 })
  const partial = buildEvidenceReport({ owner, contracts: run, chainId: 31337, chainName: 'Local', source, snapshot, actions: records.slice(0, 1) })
  assert.equal(partial.result, 'partial')
  bad((r) => { r.checks[0].status = 'incomplete' })
  // Independent verification re-reads the chain: an honest report passes, and reports that are
  // internally consistent but untrue do not.
  const outline = (findings) => findings.map((item) => `${item.check}:${item.status}`)
  const honest = await verifyReportOnChain(client, structuredClone(report), { state: true })
  assert.deepEqual(outline(honest), ['RPC chain:pass', 'Factory bytecode:pass', 'Run ownership:pass', 'Transactions:pass', 'Blocks:pass', 'Events:pass', 'State snapshots:pass'], JSON.stringify(honest))
  async function untrue(edit, ...checks) {
    const copy = structuredClone(report)
    edit(copy)
    assert(validateEvidenceReport(copy), `${checks}: the tampered report must still be internally consistent`)
    const findings = await verifyReportOnChain(client, copy, { state: true })
    for (const check of checks) assert(findings.some((item) => item.check === check && item.status === 'fail'), `${check} was not detected: ${JSON.stringify(findings)}`)
  }
  const rehash = (r, from, to) => {
    for (const item of r.actions) if (item.hash === from) { item.hash = to; item.receipt.hash = to }
    for (const item of r.checks) item.transactionHashes = item.transactionHashes.map((value) => (value === from ? to : value))
  }
  await untrue((r) => rehash(r, r.actions[0].hash, deploymentHash), 'Transactions')
  await untrue((r) => { const fake = `0x${'cd'.repeat(32)}`; r.actions[3].receipt.block.hash = fake; r.actions[3].after.block.hash = fake }, 'Blocks', 'Transactions')
  await untrue((r) => { r.actions[0].receipt.status = 'reverted' }, 'Transactions')
  await untrue((r) => { r.run.owner = other; r.run.id = `31337:${r.run.contracts.instance.toLowerCase()}:${other.toLowerCase()}`; for (const item of r.actions) { item.owner = other; item.receipt.from = other } }, 'Run ownership')
  // A contract that looks like a run (same owner, same getters) but was never created by the factory.
  const instanceArtifact = JSON.parse(readFileSync('contracts/out/ScenarioFactory.sol/ScenarioInstance.json', 'utf8'))
  const lookalikeHash = await wallet.deployContract({ account: owner, abi: instanceArtifact.abi, bytecode: instanceArtifact.bytecode.object, args: [owner] })
  const lookalike = await loadRun(client, factory, (await client.waitForTransactionReceipt({ hash: lookalikeHash })).contractAddress, owner)
  await untrue((r) => {
    r.run.contracts = structuredClone(lookalike)
    r.run.id = `31337:${lookalike.instance.toLowerCase()}:${owner.toLowerCase()}`
    for (const item of r.actions) { item.contracts = structuredClone(lookalike); item.receipt.to = item.action.type === 'configure' ? lookalike.instance : lookalike[item.action.consumer] }
  }, 'Run ownership')
  // An RPC that lies about who sent a transaction, what it carried, or where it went.
  const lying = (field, value) => new Proxy(client, { get(target, key) { return key === 'getTransaction' ? async (request) => ({ ...(await target.getTransaction(request)), [field]: value }) : target[key] } })
  for (const [field, value] of [['from', other], ['value', 1n], ['to', other], ['input', '0x']]) {
    assert((await verifyReportOnChain(lying(field, value), structuredClone(report))).some((item) => item.check === 'Transactions' && item.status === 'fail'), `a lying RPC (${field}) must not verify`)
  }
  await untrue((r) => { r.source.factoryCodeHash = `0x${'ef'.repeat(32)}` }, 'Factory bytecode')
  await untrue((r) => { const forged = 99n * 10n ** 18n; r.actions[0].action.amount = forged.toString(); r.actions[0].receipt.data = encodeFunctionData({ abi: executionAbi, functionName: 'deposit', args: [forged] }) }, 'Events')
  const wrongChain = (r) => { r.chain.id = 421614; r.run.id = `421614:${r.run.contracts.instance.toLowerCase()}:${r.run.owner.toLowerCase()}`; for (const item of r.actions) item.chainId = 421614 }
  await untrue(wrongChain, 'RPC chain')
  const elsewhere = structuredClone(report)
  wrongChain(elsewhere)
  assert.equal((await verifyReportOnChain(client, elsewhere, { state: true })).length, 1, 'on the wrong chain nothing else is meaningful, so no misleading follow-up findings')
  await untrue((r) => { const later = (BigInt(r.actions[0].receipt.block.timestamp) + 1n).toString(); r.actions[0].receipt.block.timestamp = later; r.actions[0].after.block.timestamp = later }, 'Blocks')
  await untrue((r) => { r.run.contracts.price = otherRun.price; for (const item of r.actions) item.contracts.price = otherRun.price }, 'Run ownership')
  await untrue((r) => { r.observations.guarded.collateral = '1' }, 'State snapshots')
  const tamperedState = structuredClone(report)
  tamperedState.observations.guarded.collateral = '1'
  assert.deepEqual(outline(await verifyReportOnChain(client, tamperedState)).slice(-1), ['State snapshots:skipped'], 'state is opt-in: without it the limitation is stated, not hidden')
  // An RPC that has pruned old state makes snapshots unverifiable, never a mismatch.
  const pruned = new Proxy(client, { get(target, key) { return key === 'readContract' ? async (request) => { if (request.blockNumber !== undefined) throw new Error('missing trie node'); return target.readContract(request) } : target[key] } })
  assert.deepEqual(outline(await verifyReportOnChain(pruned, structuredClone(report), { state: true })).slice(-4), ['Transactions:pass', 'Blocks:pass', 'Events:pass', 'State snapshots:skipped'])
  // An RPC that rewrites receipts: wrong event, extra log, or logs on a revert.
  const rewriting = (edit) => new Proxy(client, { get(target, key) { return key === 'getTransactionReceipt' ? async (request) => edit(await target.getTransactionReceipt(request)) : target[key] } })
  const sampleLog = (await client.getTransactionReceipt({ hash: records[0].hash })).logs[0]
  const repaid = toEventSelector('event Repaid(address indexed user, uint256 amount)')
  for (const [label, edit] of [
    // Only consumer events share Repaid's layout (indexed user), so the name alone differs; configure logs would merely fail to decode.
    ['a log naming a different event', (r) => (r.status === 'success' && r.logs[0].topics.length === 2 ? { ...r, logs: r.logs.map((log) => ({ ...log, topics: [repaid, ...log.topics.slice(1)] })) } : r)],
    ['an extra log', (r) => (r.status === 'success' ? { ...r, logs: [...r.logs, ...r.logs] } : r)],
    ['logs on a reverted transaction', (r) => (r.status === 'reverted' ? { ...r, logs: [sampleLog] } : r)],
  ]) {
    assert((await verifyReportOnChain(rewriting(edit), structuredClone(report))).some((item) => item.check === 'Events' && item.status === 'fail'), `${label} must not verify`)
  }
  assert((await verifyReportOnChain(rewriting((r) => (r.status === 'reverted' ? { ...r, gasUsed: 2n ** 40n } : r)), structuredClone(report))).some((item) => item.check === 'Transactions' && item.status === 'fail'), 'a revert that spent its whole gas limit must not verify as a rejection')
  // The rejection reason is re-derived from the chain, whatever the report says.
  const misreported = structuredClone(report)
  misreported.actions.find((item) => item.replayError === 'PriceUnavailable').replayError = 'SequencerUnavailable'
  assert.match((await verifyReportOnChain(client, misreported, { state: true })).at(-1).detail, /replays as PriceUnavailable, the report says SequencerUnavailable/)
  // Infrastructure trouble is never reported as a mismatch: a replay that fails for a non-guard reason is skipped,
  // and an RPC fault while looking a transaction up propagates instead of reading as "not on this chain".
  const noReplay = new Proxy(client, { get(target, key) { return key === 'simulateContract' ? async () => { throw new Error('RPC unavailable') } : target[key] } })
  assert.deepEqual(outline(await verifyReportOnChain(noReplay, structuredClone(report), { state: true })).slice(-1), ['State snapshots:skipped'])
  const flaky = new Proxy(client, { get(target, key) { return key === 'getTransactionReceipt' ? async () => { throw new Error('RPC unavailable') } : target[key] } })
  await assert.rejects(verifyReportOnChain(flaky, structuredClone(report)), /RPC unavailable/)
  // The CLI end to end, against the same chain.
  const cliArgs = (file) => ['scripts/verify-report.mjs', file, '--rpc-url', `http://127.0.0.1:${port}`, '--state']
  writeFileSync('work/verification/cli-report.json', JSON.stringify(report))
  const cli = execFileSync(process.execPath, cliArgs('work/verification/cli-report.json'), { encoding: 'utf8' })
  assert.match(cli, /VERIFIED against this RPC\./)
  assert.equal([...cli.matchAll(/^✓ /gm)].length, 8, cli)
  writeFileSync('work/verification/cli-tampered.json', JSON.stringify(tamperedState))
  assert.throws(() => execFileSync(process.execPath, cliArgs('work/verification/cli-tampered.json'), { encoding: 'utf8', stdio: 'pipe' }), (error) => error.status === 1 && /NOT VERIFIED/.test(error.stdout) && /✗ State snapshots/.test(error.stdout))
  writeFileSync('work/verification/cli-garbage.json', JSON.stringify({ schemaVersion: 'cruxmark-evidence/2' }))
  assert.throws(() => execFileSync(process.execPath, cliArgs('work/verification/cli-garbage.json'), { encoding: 'utf8', stdio: 'pipe' }), (error) => error.status === 1 && /not a consistent/.test(error.stdout))
  const exact = 123456789012345678901234567890n
  assert.equal(BigInt(serialize({ amount: exact }).amount), exact)
  await assert.rejects(Promise.resolve().then(() => buildEvidenceReport({ owner, contracts: run, chainId: 31337, chainName: 'Local', source, snapshot, actions: [] })))
  assert.equal(classifyError(new Error('gas exceeds balance')).kind, 'unknown', 'Gas failure must not be classified as a guard')

  // Each documented failure state is described from a real viem error type, never from guessed wording.
  const failure = (work) => work().then(() => assert.fail('Expected a failure'), (error) => classifyError(error))
  const signingWith = (thrown) => createWalletClient({ chain: foundry, account: owner, transport: custom({ request: async () => { throw thrown } }, { retryCount: 0 }) })
  const createRun = (walletClient) => walletClient.writeContract({ address: factory, abi: factoryAbi, functionName: 'createScenario' })
  assert.equal((await failure(() => createRun(signingWith(Object.assign(new Error('User rejected the request.'), { code: 4001 }))))).kind, 'rejected')
  assert.equal((await failure(() => createRun(signingWith({ code: 4001, message: 'User denied transaction signature.' })))).kind, 'rejected', 'wallets that throw plain objects')
  assert.equal(classifyError({ code: 4001, message: 'User rejected the request.' }).kind, 'rejected', 'a raw provider rejection, e.g. while connecting')
  const refused = createPublicClient({ chain: foundry, transport: http('http://127.0.0.1:9', { retryCount: 0, timeout: 2000 }) })
  assert.deepEqual(await failure(() => refused.getBlockNumber()), { kind: 'rpc', message: 'RPC request failed. Check the network and retry.' })
  const limiter = createHttpServer((_, response) => { response.statusCode = 429; response.end('Too Many Requests') })
  await new Promise((resolve) => limiter.listen(0, '127.0.0.1', resolve))
  const limited = createPublicClient({ chain: foundry, transport: http(`http://127.0.0.1:${limiter.address().port}`, { retryCount: 0 }) })
  assert.match((await failure(() => limited.getBlockNumber())).message, /rate-limiting/)
  limiter.closeAllConnections(); limiter.close()
  const silent = createHttpServer(() => {})
  await new Promise((resolve) => silent.listen(0, '127.0.0.1', resolve))
  const slow = createPublicClient({ chain: foundry, transport: http(`http://127.0.0.1:${silent.address().port}`, { retryCount: 0, timeout: 300 }) })
  assert.match((await failure(() => slow.getBlockNumber())).message, /did not respond/)
  silent.closeAllConnections(); silent.close()
  assert.equal((await failure(() => client.waitForTransactionReceipt({ hash: `0x${'ab'.repeat(32)}`, timeout: 500, pollingInterval: 100 }))).kind, 'timeout')
  const poor = (await wallet.getAddresses())[7]
  await client.request({ method: 'anvil_setBalance', params: [poor, '0x0'] })
  assert.equal((await failure(() => wallet.sendTransaction({ account: poor, to: owner, value: 1n }))).kind, 'funds')
  assert.equal(classifyError(new InsufficientFundsError()).kind, 'funds', 'recognized by type alone')
  assert.equal(classifyError(new Error('Insufficient funds for gas * price + value')).kind, 'funds', 'wallets that only send text')
  const curated = 'Wrong network: switch the wallet to Local sandbox.'
  assert.deepEqual(classifyError(new Error(curated)), { kind: 'unknown', message: curated }, 'our own messages are not rewritten')

  const requests = []
  let currentChain = '0x1'
  globalThis.window = { ethereum: { request: async ({ method, params }) => {
    requests.push(method)
    if (method === 'eth_accounts') return [owner]
    if (method === 'eth_chainId') return currentChain
    if (method === 'wallet_switchEthereumChain' && currentChain === '0x1') { currentChain = 'missing'; throw { code: 4902 } }
    if (method === 'wallet_addEthereumChain') { currentChain = params[0].chainId; return null }
    if (method === 'wallet_switchEthereumChain') return null
  } } }
  await assert.rejects(assertWalletSession(owner), /Wrong network/)
  await switchToSelectedChain()
  assert.deepEqual(requests.slice(-3), ['wallet_switchEthereumChain', 'wallet_addEthereumChain', 'wallet_switchEthereumChain'])
  await assertWalletSession(owner)
  await assert.rejects(assertWalletSession(other), /account changed/)
  window.ethereum.request = async () => ['invalid account']
  await assert.rejects(readWalletSession(), /invalid accounts/)
  window.location = { hostname: 'example.com' }
  await assert.rejects(connectLocalAccount(`http://127.0.0.1:${port}`), /loopback/)
  window.location.hostname = '127.0.0.1'
  await assert.rejects(connectLocalAccount('https://example.com'), /loopback/)
  assert.equal((await connectLocalAccount(`http://127.0.0.1:${port}`)).toLowerCase(), owner.toLowerCase())
  await assertWalletSession(owner)
  await assert.rejects(getProvider().request({ method: 'anvil_setBalance', params: [owner, '0x0'] }), /Unsupported/)
  await assert.rejects(getProvider().request({ method: 'personal_sign', params: ['0x', owner] }), /Unsupported/)
  delete globalThis.window

  mkdirSync('work/verification', { recursive: true })
  writeFileSync('work/verification/local-evidence.json', JSON.stringify(report, null, 2) + '\n')
  console.log(`Execution checks passed: ${records.length} confirmed actions, 15 verified coverage checks, exact guard replays, independent owners, strict evidence rejection, wallet identity checks, real-error failure descriptions and independent on-chain report verification.`)
} finally {
  node.kill('SIGTERM')
  await new Promise((resolve) => node.exitCode !== null ? resolve() : node.once('exit', resolve))
}
