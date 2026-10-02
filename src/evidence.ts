import { encodeFunctionData, type Hash } from 'viem'
import { executionAbi, ONE_E18 } from './contracts.ts'
import { actionOutcome, type ConfirmedAction, type RunContracts, type Snapshot } from './execution.ts'

export const EVIDENCE_SCHEMA = 'cruxmark-evidence/2' as const
type Serialized<T> = T extends bigint ? string : T extends (infer U)[] ? Serialized<U>[] : T extends object ? { [K in keyof T]: Serialized<T[K]> } : T
export interface SourceInfo { revision: string; dirty: boolean; compiler: string; evmVersion: string; optimizerRuns: number; factoryCodeHash: Hash }
export interface EvidenceCheck { id: string; status: 'verified' | 'incomplete'; transactionHashes: Hash[] }
export interface EvidenceReport {
  schemaVersion: typeof EVIDENCE_SCHEMA
  scenario: { id: 'stock-collateral-suite'; version: 2 }
  run: { id: string; owner: string; contracts: RunContracts }
  chain: { id: number; name: string }
  source: SourceInfo
  adapter: string
  observations: Serialized<Snapshot>
  actions: Serialized<ConfirmedAction>[]
  checks: EvidenceCheck[]
  result: 'complete' | 'partial'
  limitations: string[]
  reproduction: string[]
}
export function serialize<T>(value: T): Serialized<T> {
  return JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item))
}

export function observedFault(snapshot: Snapshot): 'healthy' | 'split' | 'paused' | 'stale' | 'down' | 'grace' | 'other' {
  const { inputs, block } = snapshot
  const { sequencer, price } = inputs
  if (sequencer.status !== 0n) return 'down'
  if (sequencer.startedAt === 0n || sequencer.startedAt > block.timestamp) return 'other'
  if (block.timestamp - sequencer.startedAt <= inputs.gracePeriod) return 'grace'
  if (inputs.paused) return 'paused'
  if (price.answer <= 0n || price.updatedAt === 0n || price.updatedAt > block.timestamp) return 'other'
  if (block.timestamp - price.updatedAt > inputs.maxAge) return 'stale'
  return inputs.multiplier === 2n * ONE_E18 ? 'split' : inputs.multiplier === ONE_E18 ? 'healthy' : 'other'
}

export function evaluateChecks(records: ConfirmedAction[]): EvidenceCheck[] {
  const checks: EvidenceCheck[] = []
  function add(id: string, predicate: (record: ConfirmedAction) => boolean) {
    const matches = records.filter(predicate)
    checks.push({ id, status: matches.length ? 'verified' : 'incomplete', transactionHashes: matches.map((item) => item.hash) })
  }
  function borrow(record: ConfirmedAction, consumer: 'unsafe' | 'guarded', fault: ReturnType<typeof observedFault>, amount: bigint, blocked = false) {
    const { action, before, after } = record
    if (action.type !== 'borrow' || action.consumer !== consumer || action.amount !== amount || observedFault(after) !== fault) return false
    return blocked
      ? actionOutcome(record) === 'blocked' && before[consumer].debt === after[consumer].debt
      : actionOutcome(record) === 'confirmed' && after[consumer].debt === before[consumer].debt + amount
  }
  add('split: correct $10k/$20k valuation and $6k/$12k caps', ({ after, receipt }) => receipt.status === 'success' && observedFault(after) === 'split' && after.unsafe.collateral === 100n * ONE_E18 && after.guarded.collateral === 100n * ONE_E18 && after.unsafe.value === 20_000n * ONE_E18 && after.guarded.value === 10_000n * ONE_E18 && after.unsafe.cap === 12_000n * ONE_E18 && after.guarded.cap === 6_000n * ONE_E18)
  add('split: unsafe $12k borrow confirmed', (record) => borrow(record, 'unsafe', 'split', 12_000n * ONE_E18))
  add('split: guarded $12k borrow rejected', (record) => borrow(record, 'guarded', 'split', 12_000n * ONE_E18, true) && record.replayError === 'BorrowExceedsCap' && record.after.guarded.debt + 12_000n * ONE_E18 > (record.after.guarded.cap ?? 0n))
  add('split: guarded $6k control confirmed', (record) => borrow(record, 'guarded', 'split', 6_000n * ONE_E18))
  for (const fault of ['paused', 'stale', 'down', 'grace'] as const) {
    add(fault + ': unsafe $1k borrow confirmed', (record) => borrow(record, 'unsafe', fault, 1_000n * ONE_E18))
    add(fault + ': guarded $1k borrow rejected', (record) => borrow(record, 'guarded', fault, 1_000n * ONE_E18, true) && record.replayError === (fault === 'paused' || fault === 'stale' ? 'PriceUnavailable' : 'SequencerUnavailable'))
  }
  add('healthy: guarded $1k control confirmed', (record) => borrow(record, 'guarded', 'healthy', 1_000n * ONE_E18))
  for (const [name, faultSet] of [['unavailable-price', ['paused', 'stale']], ['sequencer', ['down', 'grace']]] as const) {
    add(name + ': guarded debt repaid while blocked', ({ action, before, after, receipt }) => action.type === 'repay' && action.consumer === 'guarded' && action.amount > 0n && receipt.status === 'success' && (faultSet as readonly string[]).includes(observedFault(before)) && before.guarded.debt === after.guarded.debt + action.amount)
  }
  return checks
}

const address = /^0x[0-9a-fA-F]{40}$/
const hash = /^0x[0-9a-fA-F]{64}$/
function integer(value: unknown, signed = false): value is string {
  return typeof value === 'string' && (signed ? /^-?\d+$/ : /^\d+$/).test(value) && BigInt(value).toString() === value
}
function validBlock(block: Serialized<Snapshot>['block']) {
  return integer(block.number) && hash.test(block.hash) && integer(block.timestamp) && BigInt(block.timestamp) > 0n
}
function reviveSnapshot(value: Serialized<Snapshot>): Snapshot {
  if (!validBlock(value.block)) throw new Error('Invalid observation block.')
  const input = value.inputs
  if (typeof input.paused !== 'boolean' || !Number.isInteger(input.priceDecimals) || input.priceDecimals < 0 || input.priceDecimals > 255) throw new Error('Invalid input metadata.')
  for (const item of [input.multiplier, input.maxAge, input.gracePeriod, input.price.startedAt, input.price.updatedAt, input.sequencer.startedAt, input.sequencer.updatedAt]) if (!integer(item)) throw new Error('Invalid integer input.')
  if (!integer(input.price.answer, true) || !integer(input.sequencer.status, true)) throw new Error('Invalid signed input.')
  function position(item: Serialized<Snapshot>['unsafe']) {
    if (!integer(item.collateral) || !integer(item.debt)) throw new Error('Invalid position amount.')
    if (item.error) {
      if (!['BorrowExceedsCap', 'PriceUnavailable', 'SequencerUnavailable', 'RepayExceedsDebt'].includes(item.error) || item.value !== undefined || item.cap !== undefined) throw new Error('Invalid blocked position.')
      return { collateral: BigInt(item.collateral), debt: BigInt(item.debt), error: item.error }
    }
    if (!integer(item.value) || !integer(item.cap)) throw new Error('Incomplete price observation.')
    return { collateral: BigInt(item.collateral), debt: BigInt(item.debt), value: BigInt(item.value), cap: BigInt(item.cap) }
  }
  return { block: { number: BigInt(value.block.number), hash: value.block.hash, timestamp: BigInt(value.block.timestamp) }, inputs: {
    multiplier: BigInt(input.multiplier), paused: input.paused, priceDecimals: input.priceDecimals,
    price: { answer: BigInt(input.price.answer), startedAt: BigInt(input.price.startedAt), updatedAt: BigInt(input.price.updatedAt) },
    sequencer: { status: BigInt(input.sequencer.status), startedAt: BigInt(input.sequencer.startedAt), updatedAt: BigInt(input.sequencer.updatedAt) },
    maxAge: BigInt(input.maxAge), gracePeriod: BigInt(input.gracePeriod),
  }, unsafe: position(value.unsafe), guarded: position(value.guarded) }
}

/** Structural and consistency check, not independent RPC verification or attestation. */
export function validateEvidenceReport(value: unknown): value is EvidenceReport {
  try {
    const report = value as EvidenceReport
    if (report.schemaVersion !== EVIDENCE_SCHEMA || report.scenario.id !== 'stock-collateral-suite' || report.scenario.version !== 2 || ![31337, 46630, 421614].includes(report.chain.id) || !address.test(report.run.owner)) return false
    if (!/^[0-9a-f]{40}$/.test(report.source.revision) || typeof report.source.dirty !== 'boolean' || !hash.test(report.source.factoryCodeHash)) return false
    if (report.source.compiler !== '0.8.30' || report.source.evmVersion !== 'paris' || report.source.optimizerRuns !== 200) return false
    if (report.run.id !== `${report.chain.id}:${report.run.contracts.instance.toLowerCase()}:${report.run.owner.toLowerCase()}` || Object.values(report.run.contracts).length !== 8 || Object.values(report.run.contracts).some((item) => !address.test(item) || /^0x0{40}$/.test(item))) return false
    const latest = reviveSnapshot(report.observations)
    if (!Array.isArray(report.actions) || report.actions.length === 0) return false
    const seen = new Set<string>()
    const records: ConfirmedAction[] = report.actions.map((record) => {
      if (record.chainId !== report.chain.id || !hash.test(record.hash) || record.hash !== record.receipt.hash || seen.has(record.hash)) throw new Error('Invalid chain or duplicate transaction hash.')
      seen.add(record.hash)
      if (!['success', 'reverted'].includes(record.receipt.status) || !validBlock(record.receipt.block) || record.owner.toLowerCase() !== report.run.owner.toLowerCase() || record.receipt.from.toLowerCase() !== report.run.owner.toLowerCase()) throw new Error('Unconfirmed or wrong-owner receipt.')
      if (JSON.stringify(record.contracts) !== JSON.stringify(report.run.contracts)) throw new Error('Cross-run evidence.')
      const before = reviveSnapshot(record.before)
      const after = reviveSnapshot(record.after)
      if (after.block.hash !== record.receipt.block.hash || after.block.number !== BigInt(record.receipt.block.number) || after.block.timestamp !== BigInt(record.receipt.block.timestamp) || before.block.number > after.block.number || latest.block.number < after.block.number) throw new Error('Inconsistent observation block.')
      const action = record.action.type === 'configure' ? record.action : { ...record.action, amount: BigInt(record.action.amount) }
      if (action.type === 'configure') {
        if (!Number.isInteger(action.fault) || action.fault < 0 || action.fault > 5) throw new Error('Invalid fault.')
      } else if (!['deposit', 'borrow', 'repay'].includes(action.type) || !['unsafe', 'guarded'].includes(action.consumer) || !integer((record.action as { amount: string }).amount) || action.amount <= 0n) throw new Error('Invalid action.')
      const target = action.type === 'configure' ? record.contracts.instance : record.contracts[action.consumer]
      const data = action.type === 'configure'
        ? encodeFunctionData({ abi: executionAbi, functionName: 'configureScenario', args: [action.fault] })
        : encodeFunctionData({ abi: executionAbi, functionName: action.type, args: [action.amount] })
      if (record.receipt.to.toLowerCase() !== target.toLowerCase() || record.receipt.data !== data) throw new Error('Action does not match the confirmed transaction.')
      if (record.replayError && !['BorrowExceedsCap', 'PriceUnavailable', 'SequencerUnavailable', 'RepayExceedsDebt'].includes(record.replayError)) throw new Error('Invalid replay reason.')
      return { ...record, action, before, after, receipt: { ...record.receipt, block: after.block } }
    })
    const checks = evaluateChecks(records)
    return JSON.stringify(report.checks) === JSON.stringify(checks) && report.result === (checks.every((item) => item.status === 'verified') ? 'complete' : 'partial')
  } catch { return false }
}

export function buildEvidenceReport(args: {
  owner: string; contracts: RunContracts; chainId: number; chainName: string; source: SourceInfo
  snapshot: Snapshot; actions: ConfirmedAction[]
}): EvidenceReport {
  const checks = evaluateChecks(args.actions)
  const report: EvidenceReport = {
    schemaVersion: EVIDENCE_SCHEMA, scenario: { id: 'stock-collateral-suite', version: 2 },
    run: { id: `${args.chainId}:${args.contracts.instance.toLowerCase()}:${args.owner.toLowerCase()}`, owner: args.owner, contracts: args.contracts },
    chain: { id: args.chainId, name: args.chainName }, source: args.source,
    adapter: 'Controlled per-token USD mock; unsafe reapplies uiMultiplier, guarded uses PriceGuard once.',
    observations: serialize(args.snapshot), actions: serialize(args.actions), checks,
    result: checks.every((item) => item.status === 'verified') ? 'complete' : 'partial',
    limitations: [
      'Controlled owner-isolated mock scenarios, not a live exploit, comprehensive audit, or loss guarantee.',
      'Synthetic collateral and debt; no real token transfers, custody or liquidation execution.',
      'A reverted receipt has no reason field. Replay errors come from an eth_call at the receipt block, after all transactions in that block; they are not transaction traces.',
      'RPC observations and receipt inclusion are not L1 finality or independent attestation. Recheck block hashes and transactions on the selected chain.',
      'Recovery controls simulate timestamps while the chain is operating; they do not interrupt a real sequencer.',
      'Only verified checks have matching executed behavior; partial reports disclose unexecuted coverage.',
    ],
    reproduction: [
      `Check out source ${args.source.revision}${args.source.dirty ? ' plus the uncommitted changes used for this build (not a clean release)' : ''}; pnpm install --frozen-lockfile; pnpm run check.`,
      `Use chain ${args.chainId}, verify factory bytecode hash ${args.source.factoryCodeHash}, then connect a test wallet and create its own isolated run.`,
      'Deposit 100 synthetic tokens into each consumer. Never send real assets to these contracts.',
      ...args.actions.map(({ action, receipt }) => action.type === 'configure'
        ? `configureScenario(${action.fault}) on the owned instance; observed receipt ${receipt.status}.`
        : `${action.type}(${action.amount}) on ${action.consumer}; observed receipt ${receipt.status}.`),
      'Compare receipts, calldata, input timestamps and block hashes against this report. Unavailable-price and recovery outcomes depend on the recorded chain time.',
    ],
  }
  if (!validateEvidenceReport(report)) throw new Error('Incomplete or inconsistent execution evidence; refresh confirmed reads before exporting.')
  return report
}
