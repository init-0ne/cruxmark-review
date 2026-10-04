import { useEffect, useRef, useState } from 'react'
import { encodeFunctionData, isAddress, parseEventLogs, type Address, type Hash } from 'viem'
import { chain, getPublicClient, loopbackHosts } from './chains.ts'
import { buildInfo } from './buildInfo.ts'
import {
  BORROW_CORRECT, BORROW_INCORRECT, BORROW_PROBE, DEPOSIT_AMOUNT,
  factoryAbi, factoryAddress, factoryConfigError, formatUsd18, truncateAddress,
} from './contracts.ts'
import {
  actionOutcome, confirmAction, encodeSubmission, faults, loadOwnedRuns, loadRun, readSnapshot, restoreSubmission, submitAction, SupersededTransactionError, verifyFactory,
  type Action, type ConfirmedAction, type Fault, type GuardError, type RunContracts, type Snapshot, type Submission,
} from './execution.ts'
import { buildEvidenceReport, evaluateChecks, nextLabInstruction, observedFault } from './evidence.ts'
import {
  assertWalletSession, classifyError, connectAccount, connectLocalAccount, explorerAddressUrl, explorerTxUrl,
  getProvider, getWalletClient, readWalletSession, switchToSelectedChain,
} from './wallet.ts'

interface Notice { tone: 'info' | 'success' | 'error'; text: string }

/** How long before the snapshot block a chain timestamp was set; a future-dated input is shown as such, never as a negative age. */
function ago(now: bigint, then: bigint) { return then > now ? 'in the future' : `${now - then}s ago` }

export default function ExecutionPanel() {
  const [account, setAccount] = useState<Address>()
  const [chainOk, setChainOk] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>()
  const [instances, setInstances] = useState<Address[]>([])
  const [run, setRun] = useState<RunContracts>()
  const [snapshot, setSnapshot] = useState<Snapshot>()
  const [records, setRecords] = useState<ConfirmedAction[]>([])
  const [pending, setPending] = useState<Submission>()
  const [recoveryBlocked, setRecoveryBlocked] = useState(false)
  const [family, setFamily] = useState<'split' | 'price' | 'sequencer'>('split')
  const lock = useRef(false)
  const epoch = useRef(0)
  const accountRef = useRef<Address | undefined>(undefined)

  function clearRun() { setRun(undefined); setSnapshot(undefined); setRecords([]); setInstances([]); setPending(undefined); setRecoveryBlocked(false) }
  function pendingKey(owner: Address) { return `cruxmark:pending:1:${chain.id}:${factoryAddress}:${owner.toLowerCase()}` }
  function saveSubmission(value: Submission) {
    const owner = value.type === 'create' ? value.owner : value.value.owner
    try { localStorage.setItem(pendingKey(owner), encodeSubmission(value)) }
    catch { setNotice({ tone: 'info', text: 'Browser storage is unavailable. Keep this tab open until confirmation completes.' }) }
  }
  function clearSubmission(owner: Address) {
    setPending(undefined)
    try { localStorage.removeItem(pendingKey(owner)) } catch { /* Storage may be disabled. */ }
  }
  useEffect(() => {
    const provider = getProvider()
    if (!provider?.on) return
    function invalidate() {
      epoch.current++
      clearRun()
      lock.current = false
      setBusy(null)
    }
    function accountsChanged(value: unknown) {
      if (getProvider() !== provider) return
      if (!accountRef.current) return
      const next = Array.isArray(value) && typeof value[0] === 'string' && isAddress(value[0]) ? value[0] : undefined
      if (next?.toLowerCase() === accountRef.current.toLowerCase()) return
      invalidate()
      accountRef.current = next
      setAccount(next)
      setChainOk(false)
      setNotice({ tone: 'info', text: 'Wallet account changed. Reconnect to load that wallet’s isolated runs.' })
    }
    function chainChanged(value: unknown) {
      if (getProvider() !== provider) return
      if (!accountRef.current) return
      invalidate()
      setChainOk(typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value) && BigInt(value) === BigInt(chain.id))
      setNotice({ tone: 'info', text: 'Wallet network changed. Reconnect to reload verified runs.' })
    }
    function disconnected() { if (getProvider() !== provider) return; invalidate(); accountRef.current = undefined; setAccount(undefined); setChainOk(false) }
    provider.on('accountsChanged', accountsChanged)
    provider.on('chainChanged', chainChanged)
    provider.on('disconnect', disconnected)
    return () => {
      provider.removeListener?.('accountsChanged', accountsChanged)
      provider.removeListener?.('chainChanged', chainChanged)
      provider.removeListener?.('disconnect', disconnected)
      epoch.current++
    }
  }, [])

  useEffect(() => {
    if (!records.length) return
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeave)
    return () => window.removeEventListener('beforeunload', warnBeforeLeave)
  }, [records.length])

  function showFailure(error: unknown) {
    const failure = classifyError(error)
    // Declining a wallet prompt is a choice, not a malfunction.
    setNotice({ tone: failure.kind === 'rejected' ? 'info' : 'error', text: failure.message.slice(0, 350) })
  }

  async function task(label: string, work: (assertCurrent: () => void) => Promise<void>) {
    if (lock.current) return
    lock.current = true
    const generation = epoch.current
    const assertCurrent = () => { if (generation !== epoch.current) throw new Error('Wallet session changed. Reconnect before continuing.') }
    setBusy(label)
    setNotice({ tone: 'info', text: label + '…' })
    try { await work(assertCurrent) }
    catch (error) {
      if (generation === epoch.current) {
        if (error instanceof SupersededTransactionError && accountRef.current) { clearSubmission(accountRef.current); setSnapshot(undefined) }
        showFailure(error)
      }
    } finally {
      if (generation === epoch.current) { lock.current = false; setBusy(null) }
    }
  }

  async function verifiedClient() {
    if (!factoryAddress) throw new Error('Deployment is not configured.')
    const client = await getPublicClient()
    await verifyFactory(client, factoryAddress, chain.id, buildInfo.factoryCodeHash)
    return client
  }

  function connect(local = false) {
    if (records.length && !window.confirm('Reconnecting clears this browser session’s action history from the current report. Download its evidence JSON first. Continue without it?')) return
    void task('Connect wallet', async (current) => {
      const owner = await (local ? connectLocalAccount() : connectAccount())
      current()
      const session = await readWalletSession()
      current()
      clearRun()
      accountRef.current = owner
      setAccount(owner)
      setChainOk(session.chainId === chain.id)
      if (session.chainId !== chain.id) throw new Error(`Wallet is on chain ${session.chainId}. Switch to ${chain.name}, then reconnect.`)
      const client = await verifiedClient()
      const list = await loadOwnedRuns(client, factoryAddress!, owner)
      current()
      setInstances(list)
      let saved: string | null = null
      try { saved = localStorage.getItem(pendingKey(owner)) } catch { /* In-memory confirmation still works. */ }
      if (saved) {
        setRecoveryBlocked(true)
        const restored = await restoreSubmission(client, saved, owner, factoryAddress!, chain.id, buildInfo.factoryCodeHash)
        current()
        setPending(restored); setRecoveryBlocked(false)
        if (restored.type === 'action') { setRun(restored.value.contracts); setSnapshot(restored.value.before) }
        setNotice({ tone: 'info', text: 'Recovered a submitted transaction. Retry confirmation before sending another action.' })
        return
      }
      setNotice({ tone: 'success', text: 'Wallet and factory verified. Choose a scenario family and create a fresh run.' })
    })
  }

  function switchNetwork() {
    void task('Switch network', async () => {
      await switchToSelectedChain()
      const session = await readWalletSession()
      setChainOk(session.chainId === chain.id)
      setNotice({ tone: 'info', text: `Wallet is on ${chain.name}. Create a fresh run, or reconnect to load earlier runs.` })
    })
  }

  async function finishCreate(client: Awaited<ReturnType<typeof getPublicClient>>, hash: Hash, owner: Address, current: () => void) {
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90_000, pollingInterval: 1500 })
    current()
    const transaction = await client.getTransaction({ hash: receipt.transactionHash })
    if (transaction.from.toLowerCase() !== owner.toLowerCase() || transaction.to?.toLowerCase() !== factoryAddress?.toLowerCase() || transaction.input !== encodeFunctionData({ abi: factoryAbi, functionName: 'createScenario' }) || transaction.value !== 0n) throw new SupersededTransactionError('Creation transaction was replaced by a different action. No run accepted; retry from the current state.')
    if (receipt.status !== 'success') { clearSubmission(owner); throw new Error('Scenario creation reverted. No run created.') }
    const event = parseEventLogs({ abi: factoryAbi, logs: receipt.logs, eventName: 'ScenarioCreated' }).find((item) => item.address.toLowerCase() === factoryAddress?.toLowerCase() && item.args.owner.toLowerCase() === owner.toLowerCase())
    if (!event) throw new Error('Creation receipt has no matching scenario event. No run accepted.')
    const contracts = await loadRun(client, factoryAddress!, event.args.instance, owner)
    const observed = await readSnapshot(client, contracts, owner)
    const list = await loadOwnedRuns(client, factoryAddress!, owner)
    current()
    setRun(contracts); setSnapshot(observed); setRecords([]); setInstances(list); clearSubmission(owner)
    setNotice({ tone: 'success', text: 'Fresh isolated run created and verified. Deposit collateral, then seed the chosen fault.' })
  }

  function create() {
    if (!account || pending || recoveryBlocked) return
    if (records.length && !window.confirm('This run has confirmed actions that will leave the current report when you create a new run. Download its evidence JSON first. Continue without it?')) return
    void task('Create isolated run', async (current) => {
      await assertWalletSession(account)
      const client = await verifiedClient()
      await client.simulateContract({ address: factoryAddress!, abi: factoryAbi, functionName: 'createScenario', account })
      current()
      const hash = await getWalletClient(account).writeContract({ address: factoryAddress!, abi: factoryAbi, functionName: 'createScenario', account, chain })
      const submitted = { type: 'create' as const, hash, owner: account, chainId: chain.id }
      saveSubmission(submitted)
      current()
      setPending(submitted)
      setNotice({ tone: 'info', text: 'Creation submitted. Waiting for its receipt; do not create a duplicate.' })
      await finishCreate(client, hash, account, current)
    })
  }

  function select(address: Address) {
    if (!account || pending) return
    if (address === run?.instance && records.length > 0) return
    if (records.length && !window.confirm('Switching runs clears this browser session’s action history from the current report. Download its evidence JSON first. Continue without it?')) return
    setSnapshot(undefined); setRun(undefined); setRecords([])
    void task('Load owned run', async (current) => {
      const client = await verifiedClient()
      if (!instances.includes(address)) throw new Error('Select a run owned by this wallet.')
      const contracts = await loadRun(client, factoryAddress!, address, account)
      const observed = await readSnapshot(client, contracts, account)
      current()
      setRun(contracts); setSnapshot(observed)
      setNotice({ tone: 'info', text: 'Run loaded. Earlier browser-session actions are outside this report; execute fresh checks to add evidence.' })
    })
  }

  async function execute(action: Action, current: () => void) {
    if (!account || !run) throw new Error('Connect and create an isolated run first.')
    await assertWalletSession(account)
    const client = await verifiedClient()
    current()
    const submitted = await submitAction(client, getWalletClient(account), account, run, action, buildInfo.factoryCodeHash)
    saveSubmission({ type: 'action', value: submitted })
    current()
    setPending({ type: 'action', value: submitted })
    setNotice({ tone: 'info', text: 'Transaction submitted. Waiting for the receipt; further writes are locked.' })
    const confirmed = await confirmAction(client, submitted)
    current()
    setRecords((previous) => [...previous, confirmed]); setSnapshot(confirmed.after); clearSubmission(account)
    const result = actionOutcome(confirmed)
    setNotice(result === 'blocked'
      ? { tone: 'success', text: `Borrow reverted on chain. Same-block replay decoded ${confirmed.replayError}; debt stayed ${formatUsd18(confirmed.after.guarded.debt)}.` }
      : result === 'confirmed'
        ? { tone: 'success', text: 'Action confirmed. Inputs and positions captured at block ' + confirmed.after.block.number + '.' }
        : { tone: 'error', text: 'Observed an unexpected outcome. Receipt retained; this action does not verify the expected check.' })
    return confirmed
  }

  function configure(fault: Fault) {
    if (pending) return
    void task('Seed ' + faults[fault].toLowerCase(), (current) => execute({ type: 'configure', fault }, current).then(() => {}))
  }
  function deposit() {
    if (!run || !account || pending) return
    void task('Deposit synthetic collateral', async (current) => {
      const client = await verifiedClient()
      const observed = await readSnapshot(client, run, account)
      current()
      for (const consumer of ['unsafe', 'guarded'] as const) {
        const amount = DEPOSIT_AMOUNT - observed[consumer].collateral
        if (amount > 0n) {
          const result = await execute({ type: 'deposit', consumer, amount }, current)
          if (result.receipt.status !== 'success') return
        }
      }
      setNotice({ tone: 'success', text: 'Both positions have at least 100 synthetic tokens. Repeated deposits only top up missing collateral.' })
    })
  }
  function borrow(consumer: 'unsafe' | 'guarded', amount: bigint, expectedError?: GuardError) {
    if (pending) return
    void task('Borrow on ' + consumer, (current) => execute({ type: 'borrow', consumer, amount, ...(expectedError ? { expectedError } : {}) }, current).then(() => {}))
  }
  function repay() {
    if (!run || !account || pending) return
    void task('Repay synthetic debt', async (current) => {
      const client = await verifiedClient()
      const observed = await readSnapshot(client, run, account)
      current()
      for (const consumer of ['unsafe', 'guarded'] as const) {
        const amount = observed[consumer].debt
        if (amount > 0n) {
          const result = await execute({ type: 'repay', consumer, amount }, current)
          if (result.receipt.status !== 'success') return
        }
      }
      setNotice({ tone: 'success', text: 'Debt repaid. Repayment stays available while guarded pricing is blocked.' })
    })
  }
  function refresh() {
    void task(pending ? 'Confirm submitted transaction' : 'Refresh block reads', async (current) => {
      const client = await verifiedClient()
      if (pending?.type === 'create') { await finishCreate(client, pending.hash, pending.owner, current); return }
      if (pending?.type === 'action') {
        const confirmed = await confirmAction(client, pending.value)
        current()
        setRecords((previous) => [...previous, confirmed]); setSnapshot(confirmed.after); clearSubmission(pending.value.owner)
        setNotice({ tone: actionOutcome(confirmed) === 'unexpected' ? 'error' : 'success', text: 'Receipt confirmed. The recorded outcome is ' + actionOutcome(confirmed) + '.' })
        return
      }
      if (!run || !account) return
      setSnapshot(undefined)
      const observed = await readSnapshot(client, run, account)
      current()
      setSnapshot(observed)
      setNotice({ tone: 'info', text: 'Inputs and positions read at block ' + observed.block.number + '.' })
    })
  }
  /** Escape for a submission that can never be confirmed (dropped, or its block state pruned by the RPC). Never counts toward evidence. */
  function discard() {
    const owner = accountRef.current
    if (!owner || !window.confirm('Discard the saved transaction? It is never counted as evidence. If it is still pending it may confirm later and change this run; check the explorer first if unsure.')) return
    epoch.current++ // Drop any in-flight confirmation so it cannot record a discarded action.
    lock.current = false
    setBusy(null)
    clearSubmission(owner)
    setRecoveryBlocked(false)
    setNotice({ tone: 'info', text: 'Saved transaction discarded and not counted. Select a run or use Refresh reads to continue from the chain’s current state.' })
  }
  function download() {
    if (!account || !run || !snapshot || pending) return
    try {
      const report = buildEvidenceReport({ owner: account, contracts: run, chainId: chain.id, chainName: chain.name, source: buildInfo, snapshot, actions: records })
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url; link.download = `cruxmark-${run.instance.slice(0, 10)}.json`
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice({ tone: 'success', text: report.result === 'complete' ? 'Complete evidence downloaded. All 15 supported checks have matching recorded actions.' : 'Partial evidence downloaded. Unexecuted checks remain explicitly incomplete.' })
    } catch (error) { showFailure(error) }
  }

  const localDemo = chain.id === 31337 && loopbackHosts.includes(window.location.hostname)
  const disabled = !account || !chainOk || !run || !!busy || !!pending || recoveryBlocked
  const checks = evaluateChecks(records)
  const visibleChecks = checks.filter((item) => family === 'split' ? item.id.startsWith('split:') : family === 'price' ? /^(paused|stale|healthy|unavailable-price):/.test(item.id) : /^(down|grace|healthy|sequencer):/.test(item.id))
  const observed = snapshot ? observedFault(snapshot) : undefined
  const priceError = family === 'price' ? 'PriceUnavailable' : 'SequencerUnavailable'
  const pendingHash = pending?.type === 'action' ? pending.value.hash : pending?.hash
  const instruction = nextLabInstruction(family, snapshot, records)
  const guidance = recoveryBlocked
    ? 'Reconnect to restore the saved transaction, or discard it, before sending another action.'
    : pending
      ? 'A transaction is submitted. Wait for its receipt, or retry confirmation. Do not send a duplicate; discard it only if it can never confirm.'
      : !account ? 'Connect a test wallet to start an isolated run.'
        : !chainOk ? `Switch your wallet to ${chain.name}, then reconnect.`
          : instruction.text
  const suggested = account && chainOk && !busy && !pending && !recoveryBlocked && (!run || snapshot) ? instruction.command : undefined
  function runSuggested() {
    if (!account) { connect(localDemo); return }
    if (!chainOk) { switchNetwork(); return }
    if (pending) { refresh(); return }
    if (!suggested) { if (records.length) download(); return }
    if (suggested === 'create') create()
    else if (suggested === 'deposit') deposit()
    else if (suggested === 'repay') repay()
    else if (suggested.type === 'configure') configure(suggested.fault)
    else if (suggested.type === 'borrow') borrow(suggested.consumer, suggested.amount, suggested.expectedError)
  }
  const suggestedLabel = !account ? (localDemo ? 'Start with local test account' : 'Connect test wallet')
    : !chainOk ? `Switch to ${chain.name}`
      : pending ? 'Retry confirmation'
      : suggested === 'create' ? 'Create isolated run'
        : suggested === 'deposit' ? 'Prepare both positions'
          : suggested === 'repay' ? 'Repay all debt'
            : suggested?.type === 'configure' ? (suggested.fault === 0 && family === 'sequencer' ? 'Simulate post-grace control' : suggested.fault === 0 ? 'Restore healthy inputs' : `Seed ${faults[suggested.fault]}`)
              : suggested?.type === 'borrow' ? `${suggested.expectedError ? 'Test' : 'Borrow'} ${formatUsd18(suggested.amount)} ${suggested.consumer}${suggested.expectedError ? ' rejection' : ''}` : records.length ? 'Download evidence JSON' : undefined

  return <section id="execute" className="exec-section wrap" aria-labelledby="execute-title">
    <div className="section-heading"><div><p className="eyebrow">EXECUTION LAB</p><h2 id="execute-title">Reproduce. Protect.<br /><span>Keep the evidence.</span></h2></div><p>One supported stock-collateral sandbox.<br />Owned mocks. Synthetic balances. Observed results.</p></div>
    <div className="exec-panel">
      <div className="exec-toolbar"><span className="mono">{chain.name} / {chain.id}</span><span className="example-pill">Controlled testnet sandbox</span></div>
      {!factoryAddress ? <div className="exec-results"><p className="exec-empty">{factoryConfigError || 'Execution deployment is not configured. The local setup guide below explains how to start the sandbox.'}</p><a className="text-link" href="#documentation">Open setup guide ↓</a></div> : <>
        <div className="exec-focus">
          <div className="exec-focus-copy"><p className="mono exec-label">{family === 'split' ? 'STOCK SPLIT' : family === 'price' ? 'UNAVAILABLE PRICE' : 'SEQUENCER RECOVERY'} · {visibleChecks.filter((item) => item.status === 'verified').length}/{visibleChecks.length} CHECKS VERIFIED</p><p className="exec-next" id="lab-next"><span className="mono">NEXT</span> {guidance}</p></div>
          {suggestedLabel && <button className="button button-primary exec-focus-button" onClick={runSuggested} disabled={!!busy || recoveryBlocked}>{suggestedLabel} <span aria-hidden="true">→</span></button>}
        </div>
        {chain.id === 46630 && <aside className="exec-proof" aria-label="Verified public testnet examples">
          <div><p className="mono exec-label">VERIFIED PUBLIC RUN · CONTROLLED MOCKS</p><p className="exec-proof-title"><strong>15 / 15 checks verified.</strong></p><p className="exec-proof-detail">One complete run on Robinhood Chain Testnet: 29 on-chain actions across split, price availability and sequencer recovery. Receipts, events and 59 state snapshots matched an independent RPC check. A separate hosted-browser split run verified 4 / 4 checks.</p></div>
          <div className="exec-proof-links"><a href={`${import.meta.env.BASE_URL}evidence/robinhood-testnet-complete.json`} download="cruxmark-robinhood-complete.json">Full suite evidence ↓</a><a href={`${import.meta.env.BASE_URL}evidence/robinhood-testnet-browser-split.json`} download="cruxmark-robinhood-browser-split.json">Browser split evidence ↓</a><a href="https://explorer.testnet.chain.robinhood.com/address/0xd2CF058b3ac9840Bf88F09B25d3f71E1fF628ACE" target="_blank" rel="noreferrer">Inspect the run ↗</a></div>
        </aside>}
        <div className="exec-grid">
          <div className="exec-step"><p className="mono exec-label">01 / CONNECT</p><h3>Your test wallet</h3><p>{chain.name}. Test ETH pays gas; collateral and debt are synthetic.</p><div className="exec-row"><button className="button button-primary" onClick={() => connect()} disabled={!!busy || !!pending}>{account ? 'Reconnect wallet' : 'Connect wallet'}</button>{localDemo && <button className="button button-small button-outline" onClick={() => connect(true)} disabled={!!busy || !!pending}>Use local test account</button>}{account && <span className="mono exec-account">{truncateAddress(account)}</span>}</div>{localDemo && <p className="exec-hint">The local option uses a disposable unlocked test account. No wallet installation or key import is needed.</p>}{account && !chainOk && <button className="button button-small button-outline" disabled={!!busy || !!pending} onClick={switchNetwork}>Switch to {chain.name}</button>}{chainOk && <p className="exec-hint">Wallet on selected test chain</p>}{chain.id !== 31337 && <a className="text-link" href={chain.id === 46630 ? 'https://faucet.testnet.chain.robinhood.com' : 'https://arbitrum.faucet.dev/'} target="_blank" rel="noreferrer">Get free test ETH ↗</a>}</div>
          <div className="exec-step"><p className="mono exec-label">02 / SELECT</p><h3>Choose the fault family</h3><div className="exec-row"><select aria-label="Scenario family" value={family} disabled={!!busy || !!pending} onChange={(event) => setFamily(event.target.value as typeof family)}><option value="split">Stock split</option><option value="price">Unavailable price</option><option value="sequencer">Sequencer recovery</option></select></div><p>{family === 'split' ? 'An adjusted $100 price must stay $100 after a 2× split.' : family === 'price' ? 'Positive paused and stale prices must reject borrowing.' : 'Down and recovering inputs must reject borrowing until grace expires.'}</p></div>
          <div className="exec-step"><p className="mono exec-label">03 / ISOLATE</p><h3>Create a fresh run</h3><p>Your wallet alone controls this run’s faults.</p><div className="exec-row"><button className="button button-outline" onClick={create} disabled={!account || !chainOk || !!busy || !!pending || recoveryBlocked}>Create isolated run</button>{instances.length > 0 && <select aria-label="Owned scenario instance" value={run?.instance ?? ''} disabled={!!busy || !!pending} onChange={(event) => select(event.target.value as Address)}><option value="" disabled>Recent owned runs ({instances.length})</option>{instances.map((value) => <option value={value} key={value}>{truncateAddress(value)}</option>)}</select>}</div>{run && <p className="exec-address mono">Instance {explorerAddressUrl(run.instance) ? <a href={explorerAddressUrl(run.instance)} target="_blank" rel="noreferrer">{truncateAddress(run.instance)} ↗</a> : run.instance}</p>}{records.length > 0 && <p className="exec-hint">Download this run’s evidence before switching runs, refreshing or closing this tab. Action history is kept only in this browser session.</p>}</div>
        </div>
        <div className="exec-grid">
          <div className="exec-step"><p className="mono exec-label">04 / PREPARE</p><h3>100 tokens. Two consumers.</h3><p>Deposit identical synthetic collateral into the seeded unsafe and guarded versions.</p><div className="exec-row"><button className="button button-outline" onClick={deposit} disabled={disabled}>Prepare 100 tokens each</button><button className="button button-small button-outline" onClick={refresh} disabled={!run || !!busy || !!pending}>Refresh reads</button></div>{family !== 'split' && <p className="exec-hint">For repayment evidence: seed healthy inputs, borrow $1k guarded, then seed a fault and repay while pricing is blocked.</p>}</div>
          <div className="exec-step"><p className="mono exec-label">05 / STRESS</p><h3>Seed the controlled input</h3><div className="exec-actions">{(family === 'split' ? [1] : family === 'price' ? [2, 3] : [4, 5]).map((fault) => <button className="button button-small button-outline" key={fault} onClick={() => configure(fault as Fault)} disabled={disabled}>{faults[fault]}</button>)}<button className="button button-small button-outline" onClick={() => configure(0)} disabled={disabled}>{family === 'sequencer' ? 'Simulate post-grace control' : 'Restore healthy inputs'}</button></div><p className="exec-hint">Each seed clears other faults and uses chain time. Healthy refreshes the $100 mock price, which then expires with chain time (see its age under Input evidence); seed it again if a borrow is rejected as unavailable.{family === 'sequencer' && ' Post-grace sets a historical recovery timestamp; it does not wait an hour or interrupt the real sequencer.'}</p>{observed && <span className={`exec-badge ${observed === 'healthy' ? 'ok' : 'fault'}`}>Observed input: {observed}</span>}</div>
        </div>
        <div className="exec-step exec-borrow"><p className="mono exec-label">06 / COMPARE</p><h3>Execute the same action through both paths</h3><div className="exec-actions">{family === 'split' ? <><button className="button button-small button-outline" disabled={disabled} onClick={() => borrow('unsafe', BORROW_INCORRECT)}>Borrow $12k unsafe</button><button className="button button-small button-outline" disabled={disabled} onClick={() => borrow('guarded', BORROW_INCORRECT, 'BorrowExceedsCap')}>Test $12k guarded rejection</button><button className="button button-small button-outline" disabled={disabled} onClick={() => borrow('guarded', BORROW_CORRECT)}>Borrow $6k guarded control</button></> : <><button className="button button-small button-outline" disabled={disabled} onClick={() => borrow('unsafe', BORROW_PROBE)}>Borrow $1k unsafe</button><button className="button button-small button-outline" disabled={disabled} onClick={() => borrow('guarded', BORROW_PROBE, priceError)}>Test $1k guarded rejection</button><button className="button button-small button-outline" disabled={disabled} onClick={() => borrow('guarded', BORROW_PROBE)}>Borrow $1k healthy control</button></>}<button className="button button-small button-outline" disabled={disabled} onClick={repay}>Repay all debt</button></div><p className="exec-hint">Rejection tests deliberately submit a reverted transaction after an exact guard check. This consumes test ETH for gas. Browser wallets ask to sign; the local option uses an unlocked test account. A rejected signature verifies no check.</p></div>
        <div className="exec-results">
          <div role="status" aria-live="polite" aria-atomic="true">{notice && <p className={`exec-notice ${notice.tone}`}>{busy && <span className="exec-spinner" aria-hidden="true" />}{notice.text}</p>}</div>
          {recoveryBlocked && <div className="exec-pending"><p>A saved transaction could not be restored. Public RPCs prune old block state, so this can be permanent. Reconnect to retry its chain reads, or discard it. Writes stay locked until then to prevent a duplicate.</p><div className="exec-row"><button className="button button-small button-outline" onClick={discard}>Discard saved transaction</button></div></div>}
          {pendingHash && <div className="exec-pending"><p>Submitted transaction {explorerTxUrl(pendingHash) ? <a href={explorerTxUrl(pendingHash)} target="_blank" rel="noreferrer">{truncateAddress(pendingHash)} ↗</a> : <span className="mono">{pendingHash}</span>}. Confirmation is incomplete; no result is counted. If the transaction was dropped or the RPC no longer serves its block state, discard it to continue.</p><div className="exec-row"><button className="button button-small button-outline" disabled={!!busy} onClick={refresh}>Retry confirmation</button><button className="button button-small button-outline" onClick={discard}>Discard saved transaction</button></div></div>}
          {snapshot ? <><p className="exec-hint mono">OBSERVED BLOCK {snapshot.block.number.toString()} · CHAIN TIME {snapshot.block.timestamp.toString()}</p><div className="exec-values">{(['unsafe', 'guarded'] as const).map((consumer) => <div key={consumer}><span>{consumer === 'unsafe' ? 'Seeded unsafe' : 'Guarded'} value</span><strong>{snapshot[consumer].value === undefined ? 'Blocked' : formatUsd18(snapshot[consumer].value!)}</strong><small>{snapshot[consumer].error || `Cap ${formatUsd18(snapshot[consumer].cap!)}`}</small><small>Debt {formatUsd18(snapshot[consumer].debt)} · Collateral {(snapshot[consumer].collateral / 10n ** 18n).toString()} tokens</small></div>)}<div><span>Input evidence</span><small className="mono">price {snapshot.inputs.price.answer.toString()} / {snapshot.inputs.priceDecimals} decimals<br />updated {snapshot.inputs.price.updatedAt.toString()} ({ago(snapshot.block.timestamp, snapshot.inputs.price.updatedAt)}; max age {snapshot.inputs.maxAge.toString()}s)<br />multiplier {snapshot.inputs.multiplier.toString()}<br />paused {String(snapshot.inputs.paused)}<br />sequencer {snapshot.inputs.sequencer.status.toString()} / started {snapshot.inputs.sequencer.startedAt.toString()} ({ago(snapshot.block.timestamp, snapshot.inputs.sequencer.startedAt)}; grace {snapshot.inputs.gracePeriod.toString()}s)</small></div></div></> : <p className="exec-empty">Create or select an owned run to read inputs and positions. Results appear only after real contract reads.</p>}
          <div className="exec-checks"><p className="mono exec-label">OBSERVED COVERAGE · {visibleChecks.filter((item) => item.status === 'verified').length}/{visibleChecks.length}</p><ul>{visibleChecks.map((item) => <li key={item.id}><span className={`exec-badge ${item.status === 'verified' ? 'ok' : ''}`}>{item.status === 'verified' ? 'Verified' : 'Incomplete'}</span><span>{item.id.replace(': ', ' · ')}</span></li>)}</ul></div>
          {records.length > 0 && <details className="exec-history"><summary>Confirmed action history ({records.length})</summary><ul className="exec-txs">{records.map((record) => <li key={record.hash}><span>{record.action.type === 'configure' ? faults[record.action.fault] : `${record.action.type} ${record.action.consumer}`} · {actionOutcome(record)}{record.replayError && ` (${record.replayError})`}</span><span className="mono">{explorerTxUrl(record.hash) ? <a href={explorerTxUrl(record.hash)} target="_blank" rel="noreferrer">{truncateAddress(record.hash)} ↗</a> : truncateAddress(record.hash)} · block {record.receipt.block.number.toString()} · {record.receipt.status}</span></li>)}</ul></details>}
          <div className="exec-row"><button className="button button-outline" onClick={download} disabled={!snapshot || records.length === 0 || !!busy || !!pending}>Download evidence JSON</button><small className="exec-hint">Source revision, exact integer inputs, block snapshots and receipt outcomes. Partial runs stay partial.</small></div>
        </div>
      </>}
      <div className="lab-disclosure"><span className="info-icon" aria-hidden="true">i</span><p>Controlled sandbox only. These checks do not establish production compatibility or describe a discovered exploit. Guarded debt remains readable and repayable while pricing is blocked.</p></div>
    </div>
  </section>
}
