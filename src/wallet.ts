import { createWalletClient, custom } from 'viem'
import { chain } from './chains'

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

export function getProvider(): EthereumProvider | undefined {
  return window.ethereum
}

export async function connectAccount(): Promise<`0x${string}`> {
  const provider = getProvider()
  if (!provider) throw new Error('No wallet found. Install a browser wallet to continue.')
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
  if (!accounts || accounts.length === 0) throw new Error('No accounts authorized in the wallet.')
  return accounts[0] as `0x${string}`
}

export async function readWalletChainId(): Promise<number> {
  const provider = getProvider()
  if (!provider) throw new Error('No wallet found.')
  const hex = (await provider.request({ method: 'eth_chainId' })) as string
  return Number.parseInt(hex, 16)
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
    const message = errorMessage(error)
    // 4902: chain not added to the wallet. Add test/local chains on demand.
    if (!message.includes('4902') && !message.toLowerCase().includes('not added')) throw error
    const rpc = (import.meta.env.VITE_RPC_URL as string | undefined)?.trim()
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
  }
}

export function getWalletClient(account: `0x${string}`) {
  const provider = getProvider()
  if (!provider) throw new Error('No wallet found.')
  return createWalletClient({ account, chain, transport: custom(provider) })
}

export type FailureKind =
  | 'rejected'
  | 'wrong-network'
  | 'reverted'
  | 'rpc'
  | 'config'
  | 'unknown'

export function classifyError(error: unknown): { kind: FailureKind; message: string } {
  const message = errorMessage(error)
  const lower = message.toLowerCase()
  if (
    lower.includes('user rejected') ||
    lower.includes('user denied') ||
    lower.includes('rejected the request') ||
    lower.includes('4001')
  ) {
    return { kind: 'rejected', message: 'Signature rejected in the wallet. No transaction was sent.' }
  }
  if (lower.includes('chain') && (lower.includes('mismatch') || lower.includes('wrong network'))) {
    return { kind: 'wrong-network', message: 'The wallet is on the wrong network. Switch and retry.' }
  }
  if (
    lower.includes('revert') ||
    lower.includes('exceeds') ||
    lower.includes('borrowexceedscap') ||
    lower.includes('priceunavailable') ||
    lower.includes('sequencerunavailable') ||
    lower.includes('only scenario owner')
  ) {
    return { kind: 'reverted', message: message.slice(0, 280) }
  }
  if (
    lower.includes('fetch') ||
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('rpc') ||
    lower.includes('failed to fetch') ||
    lower.includes('could not connect')
  ) {
    return { kind: 'rpc', message: 'RPC request failed. Check the network and retry.' }
  }
  return { kind: 'unknown', message: message.slice(0, 280) }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause
    if (typeof cause === 'string') return cause
    if (cause instanceof Error) return cause.message + ' — ' + error.message
    // Viem attaches a human-readable shortMessage on contract errors.
    const short = (error as { shortMessage?: unknown }).shortMessage
    if (typeof short === 'string') return short + ' — ' + error.message
    return error.message
  }
  return String(error)
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
