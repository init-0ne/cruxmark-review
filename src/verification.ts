import { keccak256, parseEventLogs, type Address, type PublicClient } from 'viem'
import { executionAbi, factoryAbi } from './contracts.ts'
import { contractError, loadRun, readSnapshot, simulateAction, type Action, type RunContracts } from './execution.ts'
import { serialize, type EvidenceReport } from './evidence.ts'

export interface Finding { check: string; status: 'pass' | 'fail' | 'skipped'; detail: string }

const same = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase()
// Key order must not matter when comparing a report against a fresh read.
const canonical = (value: unknown) => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : 1))) : item)

/** A missing record is a finding; any other RPC failure means "could not verify" and must propagate. */
async function orNull<T>(read: Promise<T>, notFound: string): Promise<T | null> {
  try { return await read } catch (error) {
    if (error instanceof Error && error.name === notFound) return null
    throw error
  }
}

/**
 * Re-check an exported report against the chain behind `client`. This trusts that RPC
 * for what it returns; it is not L1 finality, an attestation, or an audit. Receipts,
 * calldata, block hashes and logs stay readable indefinitely. State snapshots need an
 * RPC that still serves the recorded blocks (public RPCs prune within minutes to hours),
 * so they are opt-in and an unreadable block is reported as skipped, never as a mismatch.
 */
export async function verifyReportOnChain(client: PublicClient, report: EvidenceReport, options: { state?: boolean } = {}): Promise<Finding[]> {
  const findings: Finding[] = []
  const conclude = (check: string, problems: string[], detail: string) =>
    findings.push(problems.length ? { check, status: 'fail', detail: problems.join('; ') } : { check, status: 'pass', detail })
  const owner = report.run.owner as Address
  const contracts = report.run.contracts

  const chainId = await client.getChainId()
  conclude('RPC chain', chainId === report.chain.id ? [] : [`the RPC is chain ${chainId} but the report is for ${report.chain.id}`], `chain ${chainId}`)
  if (chainId !== report.chain.id) return findings

  const factoryCode = await client.getCode({ address: contracts.factory })
  conclude('Factory bytecode', factoryCode && keccak256(factoryCode) === report.source.factoryCodeHash ? [] : ['the deployed factory is not the build named by source.factoryCodeHash'], 'deployed runtime matches source.factoryCodeHash')

  let run: RunContracts
  try {
    run = await loadRun(client, contracts.factory, contracts.instance, owner)
  } catch (error) {
    conclude('Run ownership', [error instanceof Error ? error.message : String(error)], '')
    return findings
  }
  const created = await client.readContract({ address: contracts.factory, abi: factoryAbi, functionName: 'myScenarios', account: owner })
  const differing = (Object.keys(run) as (keyof RunContracts)[]).filter((key) => !same(run[key], contracts[key]))
  conclude('Run ownership', [
    ...(created.some((address) => same(address, contracts.instance)) ? [] : ['the factory never created this instance for this owner']),
    ...differing.map((key) => `${key} address differs from the chain`),
  ], 'created by the factory for the owner; every contract address matches')

  const transactions: string[] = []
  const blocks: string[] = []
  const events: string[] = []
  for (const [index, item] of report.actions.entries()) {
    const tag = `#${index + 1} ${item.hash.slice(0, 10)}…`
    const [receipt, transaction, block] = await Promise.all([
      orNull(client.getTransactionReceipt({ hash: item.hash }), 'TransactionReceiptNotFoundError'),
      orNull(client.getTransaction({ hash: item.hash }), 'TransactionNotFoundError'),
      orNull(client.getBlock({ blockNumber: BigInt(item.receipt.block.number) }), 'BlockNotFoundError'),
    ])
    if (!receipt || !transaction) { transactions.push(`${tag} is not on this chain`); continue }
    if (receipt.status !== item.receipt.status) transactions.push(`${tag} receipt status is ${receipt.status}, the report says ${item.receipt.status}`)
    if (receipt.blockNumber !== BigInt(item.receipt.block.number) || receipt.blockHash !== item.receipt.block.hash) transactions.push(`${tag} was mined in a different block`)
    if (!same(receipt.from, owner) || !same(transaction.from, owner)) transactions.push(`${tag} was not sent by the owner`)
    if (!same(receipt.to, item.receipt.to) || !same(transaction.to, item.receipt.to)) transactions.push(`${tag} targets a different contract`)
    if (transaction.input !== item.receipt.data || transaction.value !== 0n) transactions.push(`${tag} calldata or value differs`)
    if (!block || block.hash !== item.receipt.block.hash || block.timestamp !== BigInt(item.receipt.block.timestamp)) blocks.push(`${tag} block ${item.receipt.block.number} hash or timestamp differs`)

    // A success emits exactly one event naming the action's actor and amount; a revert emits none.
    const action = item.action
    const expected = action.type === 'configure'
      ? { address: contracts.instance, name: 'ScenarioConfigured', args: { fault: action.fault, timestamp: BigInt(item.receipt.block.timestamp) } as Record<string, unknown> }
      : { address: contracts[action.consumer], name: { deposit: 'Deposited', borrow: 'Borrowed', repay: 'Repaid' }[action.type], args: { user: owner, amount: BigInt(action.amount) } as Record<string, unknown> }
    if (receipt.status === 'reverted') {
      if (receipt.logs.length) events.push(`${tag} reverted yet emitted ${receipt.logs.length} log(s)`)
      continue
    }
    const [log] = parseEventLogs({ abi: executionAbi, logs: receipt.logs })
    const args = (log?.args ?? {}) as Record<string, unknown>
    const argsMatch = Object.entries(expected.args).every(([key, value]) => typeof value === 'string' ? same(args[key] as string, value) : args[key] === value)
    if (receipt.logs.length !== 1 || !log || !same(log.address, expected.address) || log.eventName !== expected.name || !argsMatch) {
      events.push(`${tag} did not emit exactly one ${expected.name} event with the recorded arguments`)
    }
  }
  const count = report.actions.length
  conclude('Transactions', transactions, `${count}/${count}: receipt status, block, sender, target, calldata and zero value`)
  conclude('Blocks', blocks, `${count}/${count}: block hash and timestamp`)
  conclude('Events', events, `${count}/${count}: each action's logs match its actor, amount or fault`)

  if (!options.state) {
    findings.push({ check: 'State snapshots', status: 'skipped', detail: 'not requested; pass --state with an RPC that still serves these blocks' })
    return findings
  }
  const problems: string[] = []
  let unavailable: string | undefined
  let compared = 0
  try {
    const snapshots = [
      ...report.actions.flatMap((item, index) => [[`#${index + 1} before`, item.before], [`#${index + 1} after`, item.after]] as const),
      ['final observation', report.observations] as const,
    ]
    for (const [label, snapshot] of snapshots) {
      const observed = serialize(await readSnapshot(client, run, owner, BigInt(snapshot.block.number)))
      compared++
      if (canonical(observed) !== canonical(snapshot)) problems.push(`${label} differs from the chain at block ${snapshot.block.number}`)
    }
    for (const [index, item] of report.actions.entries()) {
      if (item.receipt.status !== 'reverted') continue
      const action: Action = item.action.type === 'configure' ? item.action : { ...item.action, amount: BigInt(item.action.amount) }
      let replayed: string | undefined
      try {
        await simulateAction(client, run, owner, action, BigInt(item.receipt.block.number))
      } catch (error) {
        replayed = contractError(error)
        if (!replayed) throw error // Not a decoded guard rejection: unreadable state or an RPC fault, never a mismatch.
      }
      if (replayed !== item.replayError) problems.push(`#${index + 1} replays as ${replayed ?? 'a success'}, the report says ${item.replayError ?? 'no recorded reason'}`)
    }
  } catch (error) {
    unavailable = error instanceof Error ? error.message.split('\n')[0] : String(error)
  }
  if (problems.length) conclude('State snapshots', problems, '')
  if (unavailable) {
    findings.push({ check: 'State snapshots', status: 'skipped', detail: `the RPC could not serve the recorded block state (${unavailable}); the checks above do not need it` })
  } else if (!problems.length) {
    conclude('State snapshots', [], `${compared} snapshots and every reverted action's rejection reason match the chain`)
  }
  return findings
}
