import {
  BaseError, ContractFunctionRevertedError, encodeFunctionData, keccak256,
  type Address, type Hash, type PublicClient, type WalletClient,
} from 'viem'
import { consumerAbi, executionAbi, factoryAbi, feedAbi, guardAbi, instanceAbi, tokenAbi } from './contracts.ts'

export const faults = ['Healthy', 'Stock split', 'Paused price', 'Stale price', 'Sequencer down', 'Recovery grace'] as const
export type Fault = 0 | 1 | 2 | 3 | 4 | 5
export type GuardError = 'BorrowExceedsCap' | 'PriceUnavailable' | 'SequencerUnavailable' | 'RepayExceedsDebt'
export interface RunContracts {
  factory: Address
  instance: Address
  price: Address
  sequencer: Address
  token: Address
  guard: Address
  unsafe: Address
  guarded: Address
}
export interface BlockEvidence { number: bigint; hash: Hash; timestamp: bigint }
export interface Position {
  collateral: bigint; debt: bigint; value?: bigint; cap?: bigint; error?: GuardError
}
export interface Snapshot {
  block: BlockEvidence
  inputs: {
    multiplier: bigint; paused: boolean; priceDecimals: number
    price: { answer: bigint; startedAt: bigint; updatedAt: bigint }
    sequencer: { status: bigint; startedAt: bigint; updatedAt: bigint }
    maxAge: bigint; gracePeriod: bigint
  }
  unsafe: Position
  guarded: Position
}
export type Action = { type: 'configure'; fault: Fault } | {
  type: 'deposit' | 'borrow' | 'repay'; consumer: 'unsafe' | 'guarded'; amount: bigint
  expectedError?: GuardError
}
export interface PendingAction {
  hash: Hash; chainId: number; owner: Address; contracts: RunContracts; action: Action; before: Snapshot
}
export interface ConfirmedAction extends PendingAction {
  receipt: { hash: Hash; status: 'success' | 'reverted'; block: BlockEvidence; from: Address; to: Address; data: Hash }
  after: Snapshot
  replayError?: GuardError
}

export class SupersededTransactionError extends Error {}

export function contractError(error: unknown): GuardError | undefined {
  if (!(error instanceof BaseError)) return undefined
  const cause = error.walk((item) => item instanceof ContractFunctionRevertedError)
  if (!(cause instanceof ContractFunctionRevertedError)) return undefined
  const name = cause.data?.errorName
  return name === 'BorrowExceedsCap' || name === 'PriceUnavailable' || name === 'SequencerUnavailable' || name === 'RepayExceedsDebt' ? name : undefined
}

export async function verifyFactory(client: PublicClient, factory: Address, chainId: number, codeHash: Hash) {
  if (![31337, 46630, 421614].includes(chainId) || await client.getChainId() !== chainId) {
    throw new Error('Wrong network: the RPC does not match the selected test chain.')
  }
  const code = await client.getCode({ address: factory })
  if (!code || code === '0x' || keccak256(code) !== codeHash) {
    throw new Error('Factory bytecode does not match this build. Verify the deployment and rebuild before signing.')
  }
}

export async function loadOwnedRuns(client: PublicClient, factory: Address, account: Address) {
  const count = await client.readContract({ address: factory, abi: factoryAbi, functionName: 'scenarioCount', args: [account] })
  // ponytail: list only the newest 20 runs; add paging when reviewing older runs is needed.
  const start = count > 20n ? count - 20n : 0n
  return Promise.all(Array.from({ length: Number(count - start) }, (_, i) => client.readContract({
    address: factory, abi: factoryAbi, functionName: 'scenarios', args: [account, start + BigInt(i)],
  })))
}

export async function loadRun(client: PublicClient, factory: Address, instance: Address, owner: Address): Promise<RunContracts> {
  const names = ['owner', 'price', 'sequencer', 'token', 'guard', 'unsafeConsumer', 'guardedConsumer'] as const
  const values = await Promise.all(names.map((functionName) => client.readContract({ address: instance, abi: instanceAbi, functionName })))
  if (values[0].toLowerCase() !== owner.toLowerCase()) throw new Error('This scenario belongs to another wallet.')
  const [, price, sequencer, token, guard, unsafe, guarded] = values
  const codes = await Promise.all([instance, price, sequencer, token, guard, unsafe, guarded].map((address) => client.getCode({ address })))
  if (codes.some((code) => !code || code === '0x')) throw new Error('Scenario deployment is incomplete. Create a fresh run.')
  return { factory, instance, price, sequencer, token, guard, unsafe, guarded }
}

export async function readSnapshot(client: PublicClient, run: RunContracts, owner: Address, blockNumber?: bigint): Promise<Snapshot> {
  const block = await client.getBlock(blockNumber === undefined ? { blockTag: 'latest' } : { blockNumber })
  const at = { blockNumber: block.number }
  const [multiplier, paused, priceDecimals, price, sequencer, maxAge, gracePeriod] = await Promise.all([
    client.readContract({ address: run.token, abi: tokenAbi, functionName: 'uiMultiplier', ...at }),
    client.readContract({ address: run.token, abi: tokenAbi, functionName: 'oraclePaused', ...at }),
    client.readContract({ address: run.price, abi: feedAbi, functionName: 'decimals', ...at }),
    client.readContract({ address: run.price, abi: feedAbi, functionName: 'latestRoundData', ...at }),
    client.readContract({ address: run.sequencer, abi: feedAbi, functionName: 'latestRoundData', ...at }),
    client.readContract({ address: run.guard, abi: guardAbi, functionName: 'maxAge', ...at }),
    client.readContract({ address: run.guard, abi: guardAbi, functionName: 'gracePeriod', ...at }),
  ])
  async function position(address: Address): Promise<Position> {
    const [collateral, debt] = await Promise.all([
      client.readContract({ address, abi: consumerAbi, functionName: 'collateral', args: [owner], ...at }),
      client.readContract({ address, abi: consumerAbi, functionName: 'debt', args: [owner], ...at }),
    ])
    try {
      const [value, cap] = await Promise.all([
        client.readContract({ address, abi: consumerAbi, functionName: 'collateralValue', args: [owner], ...at }),
        client.readContract({ address, abi: consumerAbi, functionName: 'maxBorrow', args: [owner], ...at }),
      ])
      return { collateral, debt, value, cap }
    } catch (error) {
      const reason = contractError(error)
      if (!reason) throw error // An RPC failure is unknown, never a successful guard rejection.
      return { collateral, debt, error: reason }
    }
  }
  const [unsafe, guarded] = await Promise.all([position(run.unsafe), position(run.guarded)])
  if ((await client.getBlock({ blockNumber: block.number })).hash !== block.hash) throw new Error('Chain reorganized during reads. Refresh before continuing.')
  return {
    block: { number: block.number, hash: block.hash, timestamp: block.timestamp },
    inputs: { multiplier, paused, priceDecimals, price: { answer: price[1], startedAt: price[2], updatedAt: price[3] },
      sequencer: { status: sequencer[1], startedAt: sequencer[2], updatedAt: sequencer[3] }, maxAge, gracePeriod },
    unsafe, guarded,
  }
}

function requestFor(run: RunContracts, action: Action) {
  return action.type === 'configure'
    ? { address: run.instance, abi: executionAbi, functionName: 'configureScenario' as const, args: [action.fault] as const }
    : { address: run[action.consumer], abi: executionAbi, functionName: action.type, args: [action.amount] as const }
}

export async function submitAction(client: PublicClient, wallet: WalletClient, owner: Address, run: RunContracts, action: Action, factoryCodeHash: Hash): Promise<PendingAction> {
  const chainId = wallet.chain?.id
  if (!chainId) throw new Error('Select an allowed test chain before signing.')
  await verifyFactory(client, run.factory, chainId, factoryCodeHash)
  if (action.type === 'configure') {
    if (!Number.isInteger(action.fault) || action.fault < 0 || action.fault > 5) throw new Error('Invalid fault selection.')
  } else if (action.amount <= 0n) throw new Error('Action amount must be positive.')
  const before = await readSnapshot(client, run, owner)
  const request = requestFor(run, action)
  try {
    await (request.functionName === 'configureScenario'
      ? client.simulateContract({ ...request, account: owner, blockNumber: before.block.number })
      : client.simulateContract({ ...request, account: owner, blockNumber: before.block.number }))
    if (action.type !== 'configure' && action.expectedError) throw new Error('Guard did not reject this input. Refresh the fault and retry; no transaction was sent.')
  } catch (error) {
    if (action.type === 'configure' || !action.expectedError || contractError(error) !== action.expectedError) throw error
  }
  // Only an exactly decoded expected guard rejection may bypass gas estimation.
  // This deliberately mines a reverted testnet action, with explicit UI disclosure.
  let gas: bigint
  if (action.type !== 'configure' && action.expectedError) gas = 300_000n
  else {
    const estimate = await (request.functionName === 'configureScenario'
      ? client.estimateContractGas({ ...request, account: owner })
      : client.estimateContractGas({ ...request, account: owner }))
    // The next timestamp can change slots that estimation left unchanged.
    gas = estimate + estimate / 5n + 30_000n
  }
  if (await wallet.getChainId() !== chainId || !(await wallet.getAddresses()).some((address) => address.toLowerCase() === owner.toLowerCase())) {
    throw new Error('Wallet network or authorized account changed before signing.')
  }
  const hash = await (request.functionName === 'configureScenario'
    ? wallet.writeContract({ ...request, account: owner, chain: wallet.chain, gas })
    : wallet.writeContract({ ...request, account: owner, chain: wallet.chain, gas }))
  return { hash, chainId, owner, contracts: run, action, before }
}

export async function confirmAction(client: PublicClient, pending: PendingAction): Promise<ConfirmedAction> {
  if (![31337, 46630, 421614].includes(pending.chainId) || await client.getChainId() !== pending.chainId) throw new Error('Wrong network: receipt confirmation requires the recorded test chain.')
  const receipt = await client.waitForTransactionReceipt({ hash: pending.hash, timeout: 90_000, pollingInterval: 1500 })
  const request = requestFor(pending.contracts, pending.action)
  const data = encodeFunctionData(request)
  const transaction = await client.getTransaction({ hash: receipt.transactionHash })
  if (transaction.from.toLowerCase() !== pending.owner.toLowerCase() || transaction.to?.toLowerCase() !== request.address.toLowerCase() || transaction.input !== data || transaction.value !== 0n) {
    throw new SupersededTransactionError('Transaction was replaced with a different action. No scenario result recorded; refresh before retrying.')
  }
  const after = await readSnapshot(client, pending.contracts, pending.owner, receipt.blockNumber)
  if (after.block.hash !== receipt.blockHash) throw new Error('Receipt block changed. Refresh confirmation before exporting.')
  let replayError: GuardError | undefined
  if (receipt.status === 'reverted') {
    try {
      await (request.functionName === 'configureScenario'
        ? client.simulateContract({ ...request, account: pending.owner, blockNumber: receipt.blockNumber })
        : client.simulateContract({ ...request, account: pending.owner, blockNumber: receipt.blockNumber }))
    } catch (error) {
      replayError = contractError(error)
    }
  }
  return { ...pending, hash: receipt.transactionHash, receipt: {
    hash: receipt.transactionHash, status: receipt.status, block: after.block,
    from: transaction.from, to: request.address, data,
  }, after, ...(replayError ? { replayError } : {}) }
}

export function actionOutcome(record: ConfirmedAction): 'confirmed' | 'blocked' | 'unexpected' {
  const { action, receipt } = record
  if (action.type !== 'configure' && action.expectedError) {
    return receipt.status === 'reverted' && record.replayError === action.expectedError ? 'blocked' : 'unexpected'
  }
  return receipt.status === 'success' ? 'confirmed' : 'unexpected'
}

export type Submission = { type: 'action'; value: PendingAction } | { type: 'create'; hash: Hash; owner: Address; chainId: number }
export function encodeSubmission(submission: Submission): string {
  return JSON.stringify(submission.type === 'create' ? submission : {
    type: 'action', value: { ...submission.value, before: undefined, beforeBlock: submission.value.before.block.number.toString() },
  }, (_, value) => typeof value === 'bigint' ? value.toString() : value)
}

/** Restore only signing metadata; reconstruct the observation from the chain. Never broadcast here. */
export async function restoreSubmission(client: PublicClient, raw: string, owner: Address, factory: Address, chainId: number, codeHash: Hash): Promise<Submission> {
  await verifyFactory(client, factory, chainId, codeHash)
  const submission = JSON.parse(raw)
  const saved = submission.type === 'create' ? submission : submission.type === 'action' ? submission.value : undefined
  if (!saved || !/^0x[0-9a-f]{64}$/i.test(saved.hash) || saved.chainId !== chainId || saved.owner?.toLowerCase() !== owner.toLowerCase()) throw new Error('Saved confirmation belongs to a different wallet or chain.')
  if (submission.type === 'create') return { type: 'create', hash: saved.hash, owner, chainId }
  const contracts = await loadRun(client, factory, saved.contracts.instance, owner)
  if (Object.keys(contracts).some((key) => contracts[key as keyof RunContracts].toLowerCase() !== saved.contracts[key]?.toLowerCase())) throw new Error('Saved confirmation contract addresses do not match the owned run.')
  if (typeof saved.beforeBlock !== 'string' || !/^\d+$/.test(saved.beforeBlock)) throw new Error('Saved confirmation block is invalid.')
  const action = saved.action as Action
  if (action.type === 'configure') {
    if (!Number.isInteger(action.fault) || action.fault < 0 || action.fault > 5) throw new Error('Saved fault is invalid.')
  } else {
    const amount = (saved.action as { amount: unknown }).amount
    if (!['deposit', 'borrow', 'repay'].includes(action.type) || !['unsafe', 'guarded'].includes(action.consumer) || typeof amount !== 'string' || !/^[1-9]\d*$/.test(amount)) throw new Error('Saved action is invalid.')
    action.amount = BigInt(amount)
    if (action.expectedError && (action.type !== 'borrow' || !['BorrowExceedsCap', 'PriceUnavailable', 'SequencerUnavailable'].includes(action.expectedError))) throw new Error('Saved guard expectation is invalid.')
  }
  const before = await readSnapshot(client, contracts, owner, BigInt(saved.beforeBlock))
  return { type: 'action', value: { hash: saved.hash, chainId, owner, contracts, action, before } }
}
