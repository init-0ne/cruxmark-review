import { BaseError, createWalletClient, custom, isAddress } from 'viem'
import { chain, loopbackHosts } from './chains.ts'
import { contractError, guardMessages } from './execution.ts'

export interface EthereumProvider {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>
  on?: (event: string, listener: (...args: unknown[]) => void) => void
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

let localProvider: EthereumProvider | undefined

export function getProvider(): EthereumProvider | undefined {
  return localProvider || window.ethereum
}

export async function connectAccount(): Promise<`0x${string}`> {
  localProvider = undefined
  const provider = getProvider()
  if (!provider) throw new Error('No wallet found. Install a browser wallet to continue.')
  await provider.request({ method: 'eth_requestAccounts' })
  const session = await readWalletSession()
  if (!session.account) throw new Error('No accounts authorized in the wallet.')
  return session.account
}

/** Explicit opt-in to disposable unlocked Anvil accounts; never available on a public site/chain. */
export async function connectLocalAccount(rpcUrl = import.meta.env?.VITE_RPC_URL?.trim() || chain.rpcUrls.default.http[0]): Promise<`0x${string}`> {
  const url = new URL(rpcUrl)
  if (chain.id !== 31337 || !loopbackHosts.includes(window.location.hostname) || !loopbackHosts.includes(url.hostname) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Local test accounts require a loopback app and RPC on chain 31337.')
  }
  const allowed = new Set(['eth_accounts', 'eth_chainId', 'eth_sendTransaction', 'eth_estimateGas', 'eth_gasPrice', 'eth_maxPriorityFeePerGas', 'eth_getBlockByNumber', 'eth_getTransactionCount', 'eth_feeHistory', 'eth_getBalance', 'eth_call', 'eth_blockNumber', 'eth_getTransactionByHash', 'eth_getTransactionReceipt'])
  let id = 0
  const candidate: EthereumProvider = { request: async ({ method, params }) => {
    if (!allowed.has(method)) throw new Error('Unsupported local test-wallet request.')
    const response = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params: params || [] }), signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error('Local RPC request failed. Start the local chain and retry.')
    const payload = await response.json()
    if (payload.error) throw Object.assign(new Error(payload.error.message || 'Local RPC request failed.'), { code: payload.error.code })
    if (!Object.hasOwn(payload, 'result')) throw new Error('Local RPC returned an incomplete response.')
    return payload.result
  } }
  if (await candidate.request({ method: 'eth_chainId' }) !== '0x7a69') throw new Error('Local RPC is on the wrong network; chain 31337 is required.')
  const accounts = await candidate.request({ method: 'eth_accounts' })
  if (!Array.isArray(accounts) || typeof accounts[0] !== 'string' || !isAddress(accounts[0])) throw new Error('No unlocked local test account is available.')
  localProvider = candidate
  return accounts[0]
}

export async function readWalletSession() {
  const provider = getProvider()
  if (!provider) throw new Error('No wallet found.')
  const accounts = await provider.request({ method: 'eth_accounts' })
  if (!Array.isArray(accounts) || accounts.some((value) => typeof value !== 'string' || !isAddress(value))) {
    throw new Error('Wallet returned invalid accounts.')
  }
  return { account: accounts[0] as `0x${string}` | undefined, chainId: await readWalletChainId() }
}

export async function assertWalletSession(account: `0x${string}`) {
  const session = await readWalletSession()
  if (session.chainId !== chain.id) throw new Error('Wrong network: switch the wallet to ' + chain.name + '.')
  if (session.account?.toLowerCase() !== account.toLowerCase()) throw new Error('Wallet account changed. Reconnect before signing.')
}

export async function readWalletChainId(): Promise<number> {
  const provider = getProvider()
  if (!provider) throw new Error('No wallet found.')
  const hex = await provider.request({ method: 'eth_chainId' })
  if (typeof hex !== 'string' || !/^0x[0-9a-f]+$/i.test(hex)) throw new Error('Wallet returned an invalid chain ID.')
  const id = Number(BigInt(hex))
  if (!Number.isSafeInteger(id)) throw new Error('Wallet chain ID exceeds the supported range.')
  return id
}

export async function switchToSelectedChain(): Promise<void> {
  const provider = getProvider()
  if (!provider) throw new Error('No wallet found.')
  const hexId = '0x' + chain.id.toString(16)
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexId }],
    })
  } catch (error) {
    // 4902: chain not added to the wallet. Add test/local chains on demand.
    if (errorCode(error) !== 4902) throw error
    const rpc = (import.meta.env?.VITE_RPC_URL as string | undefined)?.trim()
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: hexId,
          chainName: chain.name,
          rpcUrls: rpc ? [rpc] : chain.rpcUrls.default.http,
          blockExplorerUrls: chain.blockExplorers
            ? [chain.blockExplorers.default.url]
            : undefined,
          nativeCurrency: chain.nativeCurrency,
        },
      ],
    })
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] })
  }
}

function errorCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const value = error as { code?: unknown; cause?: unknown }
  return typeof value.code === 'number' ? value.code : value.cause === error ? undefined : errorCode(value.cause)
}

export function getWalletClient(account: `0x${string}`) {
  const provider = getProvider()
  if (!provider) throw new Error('No wallet found.')
  return createWalletClient({ account, chain, transport: custom(provider, { retryCount: 0 }) })
}

export type FailureKind = 'rejected' | 'funds' | 'wrong-network' | 'reverted' | 'timeout' | 'rpc' | 'unknown'

type Link = { name?: unknown; code?: unknown; status?: unknown; cause?: unknown }
function causeChain(error: unknown): Link[] {
  const chain: Link[] = []
  for (let item = error; item && typeof item === 'object' && chain.length < 10; item = (item as Link).cause) chain.push(item as Link)
  return chain
}

/**
 * Describe a failure from its error type, not its wording. Our own curated
 * errors are plain Errors and pass through unchanged as `unknown`.
 */
export function classifyError(error: unknown): { kind: FailureKind; message: string } {
  const chain = causeChain(error)
  const named = (name: string) => chain.some((link) => link.name === name)
  const raw = errorMessage(error)
  if (named('UserRejectedRequestError') || chain.some((link) => link.code === 4001)) {
    return { kind: 'rejected', message: 'You rejected the request in your wallet. No transaction was sent.' }
  }
  if (named('InsufficientFundsError') || /insufficient funds/i.test(raw)) {
    return { kind: 'funds', message: 'This wallet has too little test ETH for gas. Use the faucet link above, then retry.' }
  }
  if (named('ChainMismatchError') || named('SwitchChainError')) {
    return { kind: 'wrong-network', message: 'The wallet is on the wrong network. Switch and retry.' }
  }
  const guard = contractError(error)
  if (guard) return { kind: 'reverted', message: guardMessages[guard] }
  if (named('ContractFunctionRevertedError')) return { kind: 'reverted', message: raw }
  if (named('WaitForTransactionReceiptTimeoutError')) {
    return { kind: 'timeout', message: 'Timed out waiting for the receipt. The transaction may still confirm, so retry confirmation. If it was dropped, discard it.' }
  }
  const http = chain.find((link) => link.name === 'HttpRequestError')
  if (http) {
    return { kind: 'rpc', message: http.status === 429 ? 'The public RPC is rate-limiting requests. Wait a few seconds, then retry.' : 'RPC request failed. Check the network and retry.' }
  }
  if (named('TimeoutError')) return { kind: 'rpc', message: 'The RPC did not respond in time. Retry.' }
  return { kind: 'unknown', message: raw }
}

/** Viem's concise line (plus the node's detail when it adds something); never its request dump or version footer. */
export function errorMessage(error: unknown): string {
  if (error instanceof BaseError) {
    const detail = typeof error.details === 'string' ? error.details.split('\n')[0] : '' // viem types this as always present; some errors omit it.
    return detail && !error.shortMessage.includes(detail) ? `${error.shortMessage} (${detail})` : error.shortMessage
  }
  const message = error && typeof error === 'object' ? (error as { message?: unknown }).message : undefined
  return typeof message === 'string' ? message : String(error)
}

export function explorerTxUrl(hash: string): string | undefined {
  const explorer = chain.blockExplorers?.default.url
  if (!explorer) return undefined
  return explorer.replace(/\/$/, '') + '/tx/' + hash
}

export function explorerAddressUrl(address: string): string | undefined {
  const explorer = chain.blockExplorers?.default.url
  if (!explorer) return undefined
  return explorer.replace(/\/$/, '') + '/address/' + address
}
