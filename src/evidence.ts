export const EVIDENCE_SCHEMA = 'cruxmark-evidence/1' as const

export interface EvidenceTx {
  label: string
  hash: string
  block: string
  status: string
}

export interface EvidencePositions {
  unsafeValue: bigint
  unsafeCap: bigint
  unsafeDebt: bigint
  guardedValue: bigint
  guardedCap: bigint
  guardedDebt: bigint
}

export interface EvidenceReport {
  schemaVersion: typeof EVIDENCE_SCHEMA
  scenario: { id: string; version: number }
  run: { owner: string; instance: string }
  chain: { id: number; name: string }
  contracts: {
    factory?: string
    instance: string
    token: string
    unsafeConsumer: string
    guardedConsumer: string
  }
  adapter: string
  assumptions: {
    maxAgeSec: number
    gracePeriodSec: number
    feedNote: string
    multiplierNote: string
  }
  inputs: {
    depositRaw18: string
    splitMultiplier: string
    borrowAttemptsUsd18: string[]
  }
  observations: {
    unsafeValueUsd18: string
    guardedValueUsd18: string
    unsafeCapUsd18: string
    guardedCapUsd18: string
    unsafeDebtUsd18: string
    guardedDebtUsd18: string
  }
  transactions: EvidenceTx[]
  limitations: string[]
  reproduction: string[]
}

function decimalString(value: bigint): string {
  return value.toString()
}

export function validateEvidenceReport(report: EvidenceReport): boolean {
  try {
    if (report.schemaVersion !== EVIDENCE_SCHEMA) return false
    // Large integer amounts must roundtrip exactly through decimal strings.
    for (const amount of [
      report.inputs.depositRaw18,
      report.inputs.splitMultiplier,
      ...report.inputs.borrowAttemptsUsd18,
      report.observations.unsafeValueUsd18,
      report.observations.guardedValueUsd18,
      report.observations.unsafeCapUsd18,
      report.observations.guardedCapUsd18,
      report.observations.unsafeDebtUsd18,
      report.observations.guardedDebtUsd18,
    ]) {
      if (!/^\d+$/.test(amount)) return false
      if (BigInt(amount).toString() !== amount) return false
    }
    // Incomplete receipts can never count as passes: every recorded
    // transaction needs a block number and a successful receipt.
    if (report.transactions.length === 0) return false
    for (const tx of report.transactions) {
      if (!tx.hash || !tx.block || tx.status !== 'success') return false
    }
    return true
  } catch {
    return false
  }
}

export function buildEvidenceReport(args: {
  owner: string
  instance: string
  chainId: number
  chainName: string
  factory?: string
  token: string
  unsafe: string
  guarded: string
  multiplier: bigint
  deposit: bigint
  borrows: bigint[]
  positions: EvidencePositions
  transactions: EvidenceTx[]
}): EvidenceReport {
  if (args.transactions.length === 0) throw new Error('No confirmed transactions to report yet.')
  for (const tx of args.transactions) {
    if (!tx.block || tx.status !== 'success') {
      throw new Error('Incomplete receipt in evidence set: ' + tx.label + '.')
    }
  }
  const report: EvidenceReport = {
    schemaVersion: EVIDENCE_SCHEMA,
    scenario: { id: 'stock-split', version: 1 },
    run: { owner: args.owner, instance: args.instance },
    chain: { id: args.chainId, name: args.chainName },
    contracts: {
      ...(args.factory ? { factory: args.factory } : {}),
      instance: args.instance,
      token: args.token,
      unsafeConsumer: args.unsafe,
      guardedConsumer: args.guarded,
    },
    adapter: 'guarded-consumer-via-PriceGuard-once vs unsafe-consumer-applies-uiMultiplier-again',
    assumptions: {
      maxAgeSec: 300,
      gracePeriodSec: 3600,
      feedNote: 'Per-token USD feed already includes corporate-action adjustments (controlled mock).',
      multiplierNote: 'Shares-per-token multiplier must never be applied again to a per-token feed.',
    },
    inputs: {
      depositRaw18: decimalString(args.deposit),
      splitMultiplier: decimalString(args.multiplier),
      borrowAttemptsUsd18: args.borrows.map(decimalString),
    },
    observations: {
      unsafeValueUsd18: decimalString(args.positions.unsafeValue),
      guardedValueUsd18: decimalString(args.positions.guardedValue),
      unsafeCapUsd18: decimalString(args.positions.unsafeCap),
      guardedCapUsd18: decimalString(args.positions.guardedCap),
      unsafeDebtUsd18: decimalString(args.positions.unsafeDebt),
      guardedDebtUsd18: decimalString(args.positions.guardedDebt),
    },
    transactions: args.transactions,
    limitations: [
      'Controlled sandbox with owner-mutated mock inputs; not a live exploit, audit, or loss guarantee.',
      'Synthetic balances only; no ERC-20 custody or liquidation execution is modeled.',
      'Sandbox max-age (300s) and grace (3600s) are policy choices, not universal heartbeat settings.',
    ],
    reproduction: [
      'Set VITE_NETWORK and VITE_FACTORY_ADDRESS, then pnpm run dev with a local or testnet chain.',
      'Connect a test wallet, create a scenario, inject the 2x split, deposit 100 tokens into both consumers.',
      'Attempt borrow $12k on unsafe (succeeds) and on guarded (reverts BorrowExceedsCap); borrow $6k on guarded (succeeds).',
      'Compare this report transactions on the block explorer for the recorded chain.',
    ],
  }
  if (!validateEvidenceReport(report)) throw new Error('Built report failed validation.')
  return report
}
