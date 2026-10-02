import { parseArgs } from 'node:util'
import { readFileSync } from 'node:fs'
import { createPublicClient, http } from 'viem'
import { networks } from '../src/chains.ts'
import { validateEvidenceReport } from '../src/evidence.ts'
import { verifyReportOnChain } from '../src/verification.ts'

const usage = 'Usage: pnpm run report:verify <report.json> [--rpc-url <url>] [--state]'
const symbol = { pass: '✓', fail: '✗', skipped: '–' }
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { 'rpc-url': { type: 'string' }, state: { type: 'boolean', default: false } } })
  if (positionals.length !== 1) throw new Error(usage)
  const report = JSON.parse(readFileSync(positionals[0], 'utf8'))
  if (!validateEvidenceReport(report)) {
    console.log('✗ Structure: not a consistent cruxmark-evidence/2 report (schema, integers, receipts, calldata or recomputed checks do not agree).')
    process.exit(1)
  }
  const chain = Object.values(networks).find((item) => item.id === report.chain.id)
  if (!chain) throw new Error(`No supported network for chain ${report.chain.id}.`)
  const rpcUrl = values['rpc-url'] || chain.rpcUrls.default.http[0]
  const rpc = new URL(rpcUrl)
  if (!['http:', 'https:'].includes(rpc.protocol) || rpc.username || rpc.password) throw new Error('Use an HTTP(S) RPC URL without embedded credentials.')

  console.log(`Report  cruxmark-evidence/2 · ${report.result} · ${report.chain.name} (${report.chain.id}) · run ${report.run.contracts.instance} · owner ${report.run.owner}`)
  console.log(`Source  ${report.source.revision}${report.source.dirty ? ' (uncommitted changes)' : ''} · RPC ${rpc.origin}${rpc.pathname === '/' ? '' : rpc.pathname}`)
  const client = createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 1, timeout: 15000 }), cacheTime: 0 })
  const findings = [
    { check: 'Structure', status: 'pass', detail: `schema, exact integers and calldata agree, and the ${report.checks.length} coverage checks recompute from the recorded actions (${report.checks.filter((item) => item.status === 'verified').length} verified, ${report.checks.filter((item) => item.status !== 'verified').length} incomplete)` },
    ...await verifyReportOnChain(client, report, { state: values.state }),
  ]
  for (const { check, status, detail } of findings) console.log(`${symbol[status]} ${check.padEnd(17)} ${detail}`)
  const failed = findings.filter((item) => item.status === 'fail').length
  const skipped = findings.filter((item) => item.status === 'skipped').length
  console.log(failed
    ? `\nNOT VERIFIED: ${failed} check(s) disagree with the chain.`
    : `\nVERIFIED against this RPC${skipped ? ` (${skipped} skipped)` : ''}. This trusts the RPC; it is not L1 finality, an attestation or an audit.`)
  process.exitCode = failed ? 1 : 0
} catch (error) {
  console.error(error.shortMessage || error.message)
  process.exitCode = 2
}
