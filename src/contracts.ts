import type { Abi } from 'viem'

export const factoryAbi = [
  {
    type: 'function',
    name: 'createScenario',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'myScenarios',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
] as const satisfies Abi

export const instanceAbi = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'price', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'token', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'guard', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function',
    name: 'unsafeConsumer',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'guardedConsumer',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'setSplitMultiplier',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'multiplier', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setTokenState',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'paused', type: 'bool' },
      { name: 'multiplier', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setSequencerRound',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'status', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
    ],
    outputs: [],
  },
] as const satisfies Abi

export const consumerAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'borrow',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'repay',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'collateral',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'debt',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'collateralValue',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'maxBorrow',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const satisfies Abi

export const tokenAbi = [
  {
    type: 'function',
    name: 'uiMultiplier',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'oraclePaused',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
] as const satisfies Abi

const rawFactory = import.meta.env.VITE_FACTORY_ADDRESS?.trim() as string | undefined

export const factoryAddress =
  rawFactory && /^0x[0-9a-fA-F]{40}$/.test(rawFactory)
    ? (rawFactory as `0x${string}`)
    : undefined

export const ONE_E18 = 10n ** 18n
export const DEPOSIT_AMOUNT = 100n * ONE_E18
export const BORROW_INCORRECT = 12_000n * ONE_E18
export const BORROW_CORRECT = 6_000n * ONE_E18
export const MULTIPLIER_SPLIT = 2n * ONE_E18
export const MULTIPLIER_HEALTHY = 1n * ONE_E18

/** Format a USD18 bigint as whole dollars without floating-point math. */
export function formatUsd18(value: bigint): string {
  const dollars = value / ONE_E18
  return '$' + dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function truncateAddress(address: string): string {
  return address.slice(0, 6) + '…' + address.slice(-4)
}
