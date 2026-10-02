import { parseArgs } from 'node:util'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { createPublicClient, http, keccak256 } from 'viem'
import { loopbackHosts, networks } from '../src/chains.ts'
import { verifyFactory } from '../src/execution.ts'

const { values } = parseArgs({ options: {
  network: { type: 'string', default: 'local' },
  'rpc-url': { type: 'string' }, broadcast: { type: 'string' }, output: { type: 'string' },
  'configure-local': { type: 'boolean', default: false },
} })
try {
  if (!Object.hasOwn(networks, values.network)) throw new Error('Select local, robinhood-testnet, or arbitrum-sepolia.')
  const chain = networks[values.network]
  const rpcUrl = values['rpc-url'] || chain.rpcUrls.default.http[0]
  const rpc = new URL(rpcUrl)
  if (!['http:', 'https:'].includes(rpc.protocol) || rpc.username || rpc.password) throw new Error('Use a public HTTP(S) RPC URL without embedded credentials.')
  if (values['configure-local'] && (chain.id !== 31337 || !loopbackHosts.includes(rpc.hostname))) throw new Error('Automatic browser configuration is restricted to a verified loopback local chain.')
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()
  if (dirty && chain.id !== 31337) throw new Error('Public deployment evidence requires a clean committed source revision.')
  const artifact = JSON.parse(readFileSync('contracts/out/ScenarioFactory.sol/ScenarioFactory.json', 'utf8'))
  const metadata = artifact.metadata
  if (!metadata.compiler.version.startsWith('0.8.30+') || metadata.settings.evmVersion !== 'paris' || !metadata.settings.optimizer.enabled || metadata.settings.optimizer.runs !== 200) throw new Error('Compiler settings do not match the supported release.')
  const broadcast = JSON.parse(readFileSync(values.broadcast || `contracts/broadcast/DeploySandbox.s.sol/${chain.id}/run-latest.json`, 'utf8'))
  const deployments = broadcast.transactions.filter((item) => item.contractName === 'ScenarioFactory' && item.contractAddress)
  if (deployments.length !== 1) throw new Error('The broadcast must identify exactly one ScenarioFactory deployment.')
  const deployed = deployments[0]
  const client = createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 0, timeout: 8000 }), cacheTime: 0 })
  const runtimeHash = keccak256(artifact.deployedBytecode.object)
  await verifyFactory(client, deployed.contractAddress, chain.id, runtimeHash)
  const receipt = await client.getTransactionReceipt({ hash: deployed.hash })
  const transaction = await client.getTransaction({ hash: deployed.hash })
  const block = await client.getBlock({ blockNumber: receipt.blockNumber })
  if (receipt.status !== 'success' || receipt.contractAddress?.toLowerCase() !== deployed.contractAddress.toLowerCase() || block.hash !== receipt.blockHash) throw new Error('Deployment receipt or block is invalid. A hash alone is not success.')
  if (transaction.to !== null || transaction.input !== artifact.bytecode.object || transaction.value !== 0n || transaction.from.toLowerCase() !== receipt.from.toLowerCase()) throw new Error('Creation transaction does not match the compiled factory.')
  const creationCode = await client.getCode({ address: deployed.contractAddress, blockNumber: receipt.blockNumber })
  if (!creationCode || keccak256(creationCode) !== runtimeHash) throw new Error('Bytecode at the deployment block does not match the release.')
  const manifest = {
    schemaVersion: 'cruxmark-deployment/1',
    chain: { id: chain.id, name: chain.name },
    source: { revision, dirty, compiler: metadata.compiler.version, evmVersion: metadata.settings.evmVersion, optimizer: metadata.settings.optimizer },
    factory: { address: receipt.contractAddress, runtimeCodeHash: runtimeHash, runtimeBytes: (creationCode.length - 2) / 2, purpose: 'Creates wallet-owned isolated mock scenarios', ownership: 'Factory has no privileged owner; each instance is owned by its creating wallet.' },
    deployment: { hash: receipt.transactionHash, deployer: receipt.from, status: receipt.status, blockNumber: receipt.blockNumber.toString(), blockHash: receipt.blockHash, timestamp: block.timestamp.toString() },
    explorer: chain.blockExplorers?.default.url || null,
    scope: 'Controlled synthetic stock-collateral sandbox. No real feed/token compatibility or explorer source verification is asserted by this manifest.',
  }
  const output = values.output || `work/deployment/${values.network}.json`
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n')
  if (values['configure-local']) {
    let env = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : ''
    for (const [key, value] of Object.entries({ VITE_NETWORK: 'local', VITE_RPC_URL: rpcUrl, VITE_FACTORY_ADDRESS: receipt.contractAddress })) {
      const line = `${key}=${value}`
      const match = new RegExp(`^${key}=.*$`, 'm')
      env = match.test(env) ? env.replace(match, line) : `${env.trimEnd()}\n${line}\n`
    }
    writeFileSync('.env.local', env.trimStart())
  }
  console.log(`Verified ${chain.name} factory ${receipt.contractAddress}; successful receipt, matching bytecode and source settings. Manifest: ${output}${values['configure-local'] ? '. Local browser configuration updated; restart the web server.' : '.'}`)
} catch (error) {
  console.error(error.shortMessage || error.message)
  process.exitCode = 1
}
