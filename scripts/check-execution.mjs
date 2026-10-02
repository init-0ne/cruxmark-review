import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { setTimeout as pause } from 'node:timers/promises'
import { createPublicClient, createWalletClient, http, keccak256, parseEventLogs } from 'viem'
import { foundry } from 'viem/chains'
import { factoryAbi, BORROW_CORRECT, BORROW_INCORRECT, BORROW_PROBE, DEPOSIT_AMOUNT } from '../src/contracts.ts'
import { actionOutcome, confirmAction, encodeSubmission, restoreSubmission, loadOwnedRuns, loadRun, readSnapshot, submitAction, SupersededTransactionError, verifyFactory } from '../src/execution.ts'
import { buildEvidenceReport, serialize, validateEvidenceReport } from '../src/evidence.ts'
import { assertWalletSession, classifyError, readWalletSession, switchToSelectedChain } from '../src/wallet.ts'

const server = createServer()
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
await new Promise((resolve) => server.close(resolve))
const node = spawn('anvil', ['--host', '127.0.0.1', '--port', String(port), '--chain-id', '31337', '--silent'], { stdio: 'ignore' })
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
    await execute({ type: 'borrow', consumer: 'unsafe', amount: BORROW_PROBE })
    await execute({ type: 'borrow', consumer: 'guarded', amount: BORROW_PROBE, expectedError: fault < 4 ? 'PriceUnavailable' : 'SequencerUnavailable' })
    await execute({ type: 'repay', consumer: 'guarded', amount: BORROW_PROBE })
    await execute({ type: 'repay', consumer: 'unsafe', amount: BORROW_PROBE })
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
  const source = { revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: true, compiler: '0.8.30', evmVersion: 'paris', optimizerRuns: 200, factoryCodeHash: codeHash }
  const report = buildEvidenceReport({ owner, contracts: run, chainId: 31337, chainName: 'Isolated local check', source, snapshot, actions: records })
  assert.equal(report.result, 'complete')
  assert.equal(report.checks.length, 15)
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
  const exact = 123456789012345678901234567890n
  assert.equal(BigInt(serialize({ amount: exact }).amount), exact)
  await assert.rejects(Promise.resolve().then(() => buildEvidenceReport({ owner, contracts: run, chainId: 31337, chainName: 'Local', source, snapshot, actions: [] })))
  assert.equal(classifyError(new Error('gas exceeds balance')).kind, 'unknown', 'Gas failure must not be classified as a guard')

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
  delete globalThis.window

  mkdirSync('work/verification', { recursive: true })
  writeFileSync('work/verification/local-evidence.json', JSON.stringify(report, null, 2) + '\n')
  console.log(`Execution checks passed: ${records.length} confirmed actions, 15 verified coverage checks, exact guard replays, independent owners, strict evidence rejection and wallet identity checks.`)
} finally {
  node.kill('SIGTERM')
  await new Promise((resolve) => node.exitCode !== null ? resolve() : node.once('exit', resolve))
}
