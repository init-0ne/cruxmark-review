import { parseAbi, isAddress, zeroAddress } from 'viem'

export const factoryAbi = parseAbi([
  'function createScenario() returns (address)',
  'function myScenarios() view returns (address[])',
  'function scenarioCount(address user) view returns (uint256)',
  'function scenarios(address user, uint256 index) view returns (address)',
  'event ScenarioCreated(address indexed owner, address indexed instance, uint256 index)',
])
export const instanceAbi = parseAbi([
  'function owner() view returns (address)',
  'function price() view returns (address)',
  'function sequencer() view returns (address)',
  'function token() view returns (address)',
  'function guard() view returns (address)',
  'function unsafeConsumer() view returns (address)',
  'function guardedConsumer() view returns (address)',
  'function configureScenario(uint8 fault)',
])
export const consumerAbi = parseAbi([
  'function deposit(uint256 amount)',
  'function borrow(uint256 amount)',
  'function repay(uint256 amount)',
  'function collateral(address user) view returns (uint256)',
  'function debt(address user) view returns (uint256)',
  'function collateralValue(address user) view returns (uint256)',
  'function maxBorrow(address user) view returns (uint256)',
  'error BorrowExceedsCap()',
  'error RepayExceedsDebt()',
  'error PriceUnavailable()',
  'error SequencerUnavailable()',
])
export const tokenAbi = parseAbi([
  'function uiMultiplier() view returns (uint256)',
  'function oraclePaused() view returns (bool)',
])
export const feedAbi = parseAbi([
  'function decimals() view returns (uint8)',
  'function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)',
])
export const guardAbi = parseAbi([
  'function maxAge() view returns (uint256)',
  'function gracePeriod() view returns (uint256)',
])
export const executionAbi = [...instanceAbi, ...consumerAbi] as const
const rawFactory = import.meta.env?.VITE_FACTORY_ADDRESS?.trim() as string | undefined
export const factoryAddress = rawFactory && isAddress(rawFactory) && rawFactory !== zeroAddress
  ? rawFactory : undefined
export const factoryConfigError = rawFactory && !factoryAddress
  ? 'The configured factory address is invalid. Correct VITE_FACTORY_ADDRESS and rebuild.' : undefined

export const ONE_E18 = 10n ** 18n
export const DEPOSIT_AMOUNT = 100n * ONE_E18
export const BORROW_INCORRECT = 12_000n * ONE_E18
export const BORROW_CORRECT = 6_000n * ONE_E18
export const BORROW_PROBE = 1_000n * ONE_E18
export const MULTIPLIER_SPLIT = 2n * ONE_E18
export const MULTIPLIER_HEALTHY = ONE_E18

export function formatUsd18(value: bigint): string {
  const dollars = value / ONE_E18
  return '$' + dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
export function truncateAddress(address: string): string {
  return address.slice(0, 6) + '…' + address.slice(-4)
}
