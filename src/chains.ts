import { defineChain, createPublicClient, http } from 'viem'
import { arbitrumSepolia, foundry } from 'viem/chains'

const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://explorer.testnet.chain.robinhood.com' } },
  testnet: true,
})

const networks = { local: { ...foundry, name: 'Local sandbox' }, 'robinhood-testnet': robinhoodTestnet, 'arbitrum-sepolia': arbitrumSepolia }
const selected = import.meta.env.VITE_NETWORK || 'local'
if (!Object.hasOwn(networks, selected)) throw new Error('VITE_NETWORK must be local, robinhood-testnet, or arbitrum-sepolia')
export const chain = networks[selected as keyof typeof networks]
const override = import.meta.env.VITE_RPC_URL?.trim()
if (override && !/^https?:\/\//.test(override)) throw new Error('VITE_RPC_URL must be an HTTP(S) URL')
export const publicClient = createPublicClient({ chain, transport: http(override || undefined, { timeout: 8000, retryCount: 0 }) })
