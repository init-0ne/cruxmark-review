// Real-browser regression check for the execution lab: a local chain, production builds of the app, and a
// headless Chrome driven over CDP. Not part of `pnpm run check` because it needs Chrome (set CHROME_PATH).
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'node:net'
import { extname, resolve, sep } from 'node:path'
import { setTimeout as pause } from 'node:timers/promises'
import { createPublicClient, createWalletClient, http, keccak256 } from 'viem'
import { foundry } from 'viem/chains'
import { validateEvidenceReport } from '../src/evidence.ts'
import { verifyReportOnChain } from '../src/verification.ts'
import { launchBrowser } from './cdp.mjs'

async function freePort() {
  const probe = createServer()
  await new Promise((done) => probe.listen(0, '127.0.0.1', done))
  const { port } = probe.address()
  await new Promise((done) => probe.close(done))
  return port
}
const build = (outDir, env) => execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'], { env: { ...process.env, ...env }, stdio: 'pipe' })
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.txt': 'text/plain' }
async function serve(directory) {
  const root = resolve(directory)
  const server = createHttpServer((request, response) => {
    const file = resolve(root, `.${new URL(request.url, 'http://localhost').pathname}`)
    const target = file === root ? resolve(root, 'index.html') : file
    if (!target.startsWith(root + sep) || !existsSync(target) || !statSync(target).isFile()) { response.statusCode = 404; response.end(); return }
    response.setHeader('content-type', types[extname(target)] ?? 'application/octet-stream')
    createReadStream(target).pipe(response)
  })
  const port = await freePort()
  await new Promise((done) => server.listen(port, '127.0.0.1', done))
  return { url: `http://127.0.0.1:${port}/`, close: () => { server.closeAllConnections(); server.close() } }
}

const chainPort = await freePort()
const rpcUrl = `http://127.0.0.1:${chainPort}`
const anvil = spawn('anvil', ['--host', '127.0.0.1', '--port', String(chainPort), '--chain-id', '31337', '--hardfork', 'paris', '--silent'], { stdio: 'ignore' })
const rpc = async (method, params = []) => (await (await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json()).result
const client = createPublicClient({ chain: foundry, transport: http(rpcUrl, { retryCount: 0, timeout: 5000 }), cacheTime: 0 })
const servers = []
let page
try {
  for (let i = 0; i < 100 && !(await client.getChainId().then(() => true, () => false)); i++) await pause(50)
  const wallet = createWalletClient({ chain: foundry, transport: http(rpcUrl) })
  const [deployer] = await wallet.getAddresses()
  const artifact = JSON.parse(readFileSync('contracts/out/ScenarioFactory.sol/ScenarioFactory.json', 'utf8'))
  const deployed = await client.waitForTransactionReceipt({ hash: await wallet.deployContract({ account: deployer, abi: artifact.abi, bytecode: artifact.bytecode.object }) })
  assert.equal(keccak256(await client.getCode({ address: deployed.contractAddress })), keccak256(artifact.deployedBytecode.object))

  build('work/ui-local', { VITE_NETWORK: 'local', VITE_RPC_URL: rpcUrl, VITE_FACTORY_ADDRESS: deployed.contractAddress })
  build('work/ui-public', { VITE_NETWORK: 'robinhood-testnet', VITE_RPC_URL: '', VITE_FACTORY_ADDRESS: '0x1111111111111111111111111111111111111111' })
  const local = await serve('work/ui-local')
  const publicSite = await serve('work/ui-public')
  servers.push(local, publicSite)
  page = await launchBrowser()

  const notice = (text, timeout = 40000) => page.waitFor(`document.querySelector('.exec-notice')?.innerText.includes(${JSON.stringify(text)}) && !document.querySelector('.exec-spinner')`, timeout, `notice "${text}"`)
  const open = async (url) => { await page.goto(url); await page.waitFor(`[...document.querySelectorAll('#execute button')].some((x) => x.textContent.includes('Connect wallet'))`, 20000, 'lab loaded') }
  const useLocalAccount = async () => { await page.waitFor(`[...document.querySelectorAll('#execute button')].some((x) => x.textContent.includes('Use local test account') && !x.disabled)`, 20000, 'local account offered'); await page.click('Use local test account') }
  const connect = async () => { await useLocalAccount(); await notice('verified', 20000) }
  const freshRun = async () => { await connect(); await page.click('Create isolated run'); await notice('Fresh isolated run'); await page.click('Prepare 100 tokens each'); await notice('Both positions') }
  const pendingKey = () => page.eval(`Object.keys(localStorage).find((key) => key.startsWith('cruxmark:pending:'))`)
  const locked = () => page.eval(`[...document.querySelectorAll('#execute button')].find((x) => x.textContent.includes('Create isolated run')).disabled`)
  const stepLog = (name) => console.log(`  ${name}`)

  console.log('Scenario 1: the split flow through the UI, then the downloaded evidence is verified against the chain')
  await open(local.url)
  await freshRun()
  await page.click('Stock split', '.exec-actions'); await notice('Action confirmed')
  await page.click('Borrow $12k unsafe', '.exec-borrow'); await notice('Action confirmed')
  await page.click('Test $12k guarded rejection', '.exec-borrow'); await notice('Borrow reverted on chain')
  await page.click('Borrow $6k guarded control', '.exec-borrow'); await notice('Action confirmed')
  assert.match(await page.text('.exec-checks .exec-label'), /4\/4/)
  assert.match(await page.text('.exec-values'), /\$20,000[\s\S]*\$10,000/)
  assert.match(await page.text('.exec-values'), /\(\d+s ago; max age 300s\)[\s\S]*\(\d+s ago; grace 3600s\)/, 'the ages the guard compares are shown')
  await page.eval(`window.__download = null; const make = URL.createObjectURL.bind(URL); URL.createObjectURL = (blob) => { window.__download = blob; return make(blob) }`)
  await page.click('Download evidence JSON')
  await page.waitFor('window.__download', 5000, 'evidence download')
  const report = JSON.parse(await page.eval('window.__download.text()'))
  assert(validateEvidenceReport(report), 'the file the browser produced must be a consistent report')
  assert.equal(report.actions.length, 6)
  const findings = await verifyReportOnChain(client, report, { state: true })
  assert.deepEqual(findings.filter((item) => item.status !== 'pass'), [], JSON.stringify(findings))
  stepLog('4/4 split checks verified in the UI; a browser-produced report verifies on-chain including state')

  console.log('Scenario 2: a refused action is explained, not dumped')
  await open(local.url)
  await freshRun()
  await page.select('select[aria-label="Scenario family"]', 'price')
  await page.click('Paused price', '.exec-actions'); await notice('Action confirmed')
  await page.click('Borrow $1k healthy control', '.exec-borrow')
  await page.waitFor(`document.querySelector('.exec-notice.error')`, 20000, 'error notice')
  const refusal = await page.text('.exec-notice')
  assert.match(refusal, /no usable price/)
  assert.doesNotMatch(refusal, /Request Arguments|Version: viem|0x[0-9a-f]{40}/)
  stepLog('guard rejection reads as plain language with the next step')

  console.log('Scenario 3: a transaction that vanishes cannot lock the lab, and discarding never counts it')
  await open(local.url)
  await freshRun()
  await rpc('evm_setAutomine', [false])
  await page.click('Stock split', '.exec-actions')
  await page.waitFor(`document.querySelector('.exec-pending')`, 20000, 'pending panel')
  const key = await pendingKey()
  const saved = JSON.parse(await page.eval(`localStorage.getItem(${JSON.stringify(key)})`))
  assert.equal(await rpc('anvil_dropTransaction', [saved.value.hash]), saved.value.hash)
  await rpc('evm_setAutomine', [true])
  await open(local.url)   // a reload is the "closed the tab and came back" path
  await useLocalAccount()
  await notice('Recovered', 20000)
  assert(await locked(), 'a saved transaction must lock writes until resolved')
  page.acceptDialogs = false
  await page.click('Discard saved transaction')
  await pause(300)
  assert(await pendingKey() && await locked(), 'declining the confirmation changes nothing')
  page.acceptDialogs = true
  await page.click('Discard saved transaction')
  await page.waitFor(`!document.querySelector('.exec-pending')`, 5000, 'pending panel closed')
  assert(!(await pendingKey()) && !(await locked()), 'discarding clears the record and unlocks the lab')
  assert.match(await page.text('.exec-notice'), /not counted/)
  assert.equal(await page.eval(`!!document.querySelector('.exec-history')`), false, 'nothing is recorded for a discarded transaction')
  await page.eval(`(() => { const s = document.querySelector('select[aria-label="Owned scenario instance"]'); const last = [...s.options].map((o) => o.value).filter(Boolean).pop(); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, last); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await notice('Run loaded', 20000)
  await page.click('Stock split', '.exec-actions'); await notice('Action confirmed')
  // The other way in: recovery itself fails (the saved block can no longer be read), which is what RPC pruning does.
  await rpc('evm_setAutomine', [false])
  await page.click('Restore healthy inputs', '.exec-actions')
  await page.waitFor(`document.querySelector('.exec-pending')`, 20000, 'second pending panel')
  const second = JSON.parse(await page.eval(`localStorage.getItem(${JSON.stringify(key)})`))
  second.value.beforeBlock = '99999999'
  await page.eval(`localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(JSON.stringify(second))})`)
  await rpc('evm_setAutomine', [true]); await rpc('evm_mine')
  await open(local.url)
  await useLocalAccount()
  await page.waitFor(`document.querySelector('.exec-pending')?.innerText.includes('could not be restored')`, 20000, 'failed-recovery panel')
  assert(await locked())
  await page.click('Discard saved transaction')
  await page.waitFor(`!document.querySelector('.exec-pending')`, 5000)
  assert(!(await locked()), 'the failed-recovery panel offers the same exit')
  stepLog('dropped transaction and unreadable saved block both recover; cancelling the prompt is a no-op')

  console.log('Scenario 4: a public-network build never offers the local test account')
  await open(publicSite.url)
  assert.equal(await page.text('.network-panel h3'), 'Robinhood Chain Testnet')
  assert.equal(await page.eval(`[...document.querySelectorAll('#execute button')].some((x) => x.textContent.includes('Use local test account'))`), false)
  assert.equal(await page.eval(`[...document.querySelectorAll('#execute a')].some((a) => a.href.startsWith('https://faucet.testnet.chain.robinhood.com'))`), true)
  await page.click('Connect wallet')
  await notice('No wallet found', 10000)
  stepLog('no local account on a public chain; faucet offered; a missing wallet is explained')

  if (process.env.UI_FULL) {
    // Opt-in (UI_FULL=1, about 3 minutes): the lab's own NEXT line is the oracle. Click whatever it names until every family
    // is recorded, then verify the complete report on-chain. A wrong, looping or impossible suggestion fails here.
    console.log('Scenario 5: follow the lab\'s NEXT guidance through all three families until all 15 checks verify')
    await open(local.url)
    await freshRun()
    const mapped = (next) => {
      if (/^Prepare 100 tokens/.test(next)) return ['Prepare 100 tokens each', '#execute']
      if (/^Seed /.test(next)) return [next.slice(5).split(/[.,]/)[0].split(' or ')[0], '.exec-actions']
      if (/^(Restore healthy inputs|Simulate post-grace control)/.test(next)) return [next.match(/^(Restore healthy inputs|Simulate post-grace control)/)[0], '.exec-actions']
      if (/^Repay all debt/.test(next)) return ['Repay all debt', '.exec-borrow']
      const action = next.match(/^(Borrow \$\d+k \w+(?: \w+)?|Test \$\d+k guarded rejection)/)
      assert(action, `Cannot act on the lab's suggestion: "${next}"`)
      return [action[1], '.exec-borrow']
    }
    let clicks = 0
    for (const family of ['split', 'price', 'sequencer']) {
      await page.select('select[aria-label="Scenario family"]', family)
      for (let guard = 0; guard < 40; guard++) {
        const next = (await page.text('#lab-next')).replace(/^NEXT\s*/, '').trim()
        if (/checks are recorded\./.test(next)) break
        const [label, scope] = mapped(next)
        await page.click(label, scope)
        clicks++
        await pause(200)
        await page.waitFor(`!document.querySelector('.exec-spinner')`, 90000, `"${label}" to settle`)
        assert.doesNotMatch(await page.eval(`document.querySelector('.exec-notice.error')?.innerText ?? ''`), /./, `the lab reported an error after "${label}"`)
        assert(guard < 39, `the lab never reached the end of the ${family} family; last suggestion: "${next}"`)
      }
    }
    await page.eval(`window.__download = null; const make = URL.createObjectURL.bind(URL); URL.createObjectURL = (blob) => { window.__download = blob; return make(blob) }`)
    await page.click('Download evidence JSON')
    await page.waitFor('window.__download', 5000, 'evidence download')
    const full = JSON.parse(await page.eval('window.__download.text()'))
    assert(validateEvidenceReport(full))
    assert.equal(full.result, 'complete', JSON.stringify(full.checks.filter((item) => item.status !== 'verified')))
    assert.equal(full.checks.length, 15)
    const fullFindings = await verifyReportOnChain(client, full, { state: true })
    assert.deepEqual(fullFindings.filter((item) => item.status !== 'pass'), [], JSON.stringify(fullFindings))
    stepLog(`${clicks} guided clicks recorded ${full.actions.length} confirmed actions and all 15 checks; the complete report verifies on-chain`)
  }

  assert.deepEqual(page.logs, [], 'the page must not log errors or exceptions')
  console.log('UI checks passed: split flow with browser-produced evidence verified on-chain, failure wording, transaction recovery and discard, public-build boundary, clean console.')
} catch (error) {
  if (page) console.error('Page notice at failure:', await page.text('.exec-notice').catch(() => '(unavailable)'), '| console:', page.logs)
  throw error
} finally {
  await rpc('evm_setAutomine', [true]).catch(() => {})
  await page?.close().catch(() => {})
  for (const server of servers) server.close()
  anvil.kill('SIGTERM')
  await new Promise((done) => (anvil.exitCode !== null ? done() : anvil.once('exit', done)))
}
