import { useCallback, useState } from 'react'
import {
  BORROW_CORRECT,
  BORROW_INCORRECT,
  DEPOSIT_AMOUNT,
  MULTIPLIER_HEALTHY,
  MULTIPLIER_SPLIT,
  consumerAbi,
  factoryAddress,
  factoryAbi,
  formatUsd18,
  instanceAbi,
  tokenAbi,
  truncateAddress,
} from './contracts'
import { chain, getPublicClient } from './chains'
import { buildEvidenceReport } from './evidence'
import {
  classifyError,
  connectAccount,
  errorMessage,
  explorerAddressUrl,
  explorerTxUrl,
  getProvider,
  getWalletClient,
  readWalletChainId,
  switchToSelectedChain,
} from './wallet'

type Address = `0x${string}`

interface Children {
  token: Address
  unsafe: Address
  guarded: Address
}

interface Positions {
  unsafeValue: bigint
  unsafeCap: bigint
  unsafeDebt: bigint
  guardedValue: bigint
  guardedCap: bigint
  guardedDebt: bigint
}

interface TxRecord {
  label: string
  hash: string
  block: string
  status: string
}

interface Notice {
  tone: 'info' | 'success' | 'error'
  text: string
}

function toAddress(value: unknown): Address {
  return value as Address
}

export default function ExecutionPanel() {
  const [account, setAccount] = useState<Address | undefined>()
  const [chainOk, setChainOk] = useState<boolean | undefined>()
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [instance, setInstance] = useState<Address | undefined>()
  const [children, setChildren] = useState<Children | undefined>()
  const [instances, setInstances] = useState<Address[]>([])
  const [multiplier, setMultiplier] = useState<bigint | undefined>()
  const [positions, setPositions] = useState<Positions | undefined>()
  const [txs, setTxs] = useState<TxRecord[]>([])

  function recordTx(label: string, hash: string, blockNumber: bigint, status: string) {
    setTxs((prev) =>
      [{ label, hash, block: blockNumber.toString(), status }, ...prev].slice(0, 6),
    )
  }

  const loadInstances = useCallback(async () => {
    if (!factoryAddress) return
    const publicClient = await getPublicClient()
    const list = (await publicClient.readContract({
      address: factoryAddress,
      abi: factoryAbi,
      functionName: 'myScenarios',
    })) as Address[]
    setInstances(list)
  }, [])

  const loadChildren = useCallback(async (instanceAddress: Address) => {
    const publicClient = await getPublicClient()
    const [token, unsafe, guarded] = await Promise.all([
      publicClient.readContract({ address: instanceAddress, abi: instanceAbi, functionName: 'token' }),
      publicClient.readContract({
        address: instanceAddress,
        abi: instanceAbi,
        functionName: 'unsafeConsumer',
      }),
      publicClient.readContract({
        address: instanceAddress,
        abi: instanceAbi,
        functionName: 'guardedConsumer',
      }),
    ])
    setChildren({ token: toAddress(token), unsafe: toAddress(unsafe), guarded: toAddress(guarded) })
    return { token: toAddress(token), unsafe: toAddress(unsafe), guarded: toAddress(guarded) }
  }, [])

  const refreshState = useCallback(
    async (instanceAddress: Address, user: Address, resolved?: Children) => {
      const kids = resolved ?? (await loadChildren(instanceAddress))
      const publicClient = await getPublicClient()
      const [mult, unsafeValue, unsafeCap, unsafeDebt, guardedValue, guardedCap, guardedDebt] =
        await Promise.all([
          publicClient.readContract({ address: kids.token, abi: tokenAbi, functionName: 'uiMultiplier' }),
          publicClient.readContract({
            address: kids.unsafe,
            abi: consumerAbi,
            functionName: 'collateralValue',
            args: [user],
          }),
          publicClient.readContract({
            address: kids.unsafe,
            abi: consumerAbi,
            functionName: 'maxBorrow',
            args: [user],
          }),
          publicClient.readContract({
            address: kids.unsafe,
            abi: consumerAbi,
            functionName: 'debt',
            args: [user],
          }),
          publicClient.readContract({
            address: kids.guarded,
            abi: consumerAbi,
            functionName: 'collateralValue',
            args: [user],
          }),
          publicClient.readContract({
            address: kids.guarded,
            abi: consumerAbi,
            functionName: 'maxBorrow',
            args: [user],
          }),
          publicClient.readContract({
            address: kids.guarded,
            abi: consumerAbi,
            functionName: 'debt',
            args: [user],
          }),
        ])
      setMultiplier(mult as bigint)
      setPositions({
        unsafeValue: unsafeValue as bigint,
        unsafeCap: unsafeCap as bigint,
        unsafeDebt: unsafeDebt as bigint,
        guardedValue: guardedValue as bigint,
        guardedCap: guardedCap as bigint,
        guardedDebt: guardedDebt as bigint,
      })
    },
    [loadChildren],
  )

  async function sendTransaction(
    label: string,
    run: (wallet: ReturnType<typeof getWalletClient>) => Promise<`0x${string}`>,
    opts?: { expectedRevert?: string },
  ): Promise<boolean> {
    if (!account) {
      setNotice({ tone: 'error', text: 'Connect a wallet before sending transactions.' })
      return false
    }
    setBusy(label)
    setNotice({ tone: 'info', text: label + ' — waiting for wallet signature…' })
    try {
      const wallet = getWalletClient(account)
      const hash = await run(wallet)
      setNotice({ tone: 'info', text: label + ' submitted. Waiting for confirmation…' })
      const publicClient = await getPublicClient()
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status === 'reverted') {
        if (opts?.expectedRevert) {
          recordTx(label, hash, receipt.blockNumber, receipt.status)
          setNotice({ tone: 'success', text: opts.expectedRevert + ' Confirmed on-chain revert in block ' + receipt.blockNumber.toString() + '.' })
          return true
        }
        setNotice({ tone: 'error', text: label + ' reverted on chain. Retry from the current state.' })
        return false
      }
      recordTx(label, hash, receipt.blockNumber, receipt.status)
      setNotice({ tone: 'success', text: label + ' confirmed in block ' + receipt.blockNumber.toString() + '.' })
      return true
    } catch (error) {
      const classified = classifyError(error)
      if (classified.kind === 'rejected') {
        setNotice({ tone: 'error', text: classified.message + ' No transaction was sent.' })
      } else if (classified.kind === 'reverted' && opts?.expectedRevert) {
        setNotice({ tone: 'success', text: opts.expectedRevert + ' Observed revert: ' + classified.message })
        return true
      } else if (classified.kind === 'reverted') {
        setNotice({ tone: 'error', text: 'Transaction reverted: ' + classified.message })
      } else if (classified.kind === 'rpc') {
        setNotice({ tone: 'error', text: classified.message + ' Use Refresh to retry the read.' })
      } else {
        setNotice({ tone: 'error', text: errorMessage(error).slice(0, 280) })
      }
      return false
    } finally {
      setBusy(null)
    }
  }

  async function handleConnect() {
    setBusy('Connect wallet')
    setNotice(null)
    try {
      if (!getProvider()) {
        setNotice({ tone: 'error', text: 'No wallet found. Install a browser wallet to continue.' })
        return
      }
      const address = await connectAccount()
      setAccount(address)
      const walletChain = await readWalletChainId()
      setChainOk(walletChain === chain.id)
      if (walletChain !== chain.id) {
        setNotice({
          tone: 'error',
          text: 'Wallet is on chain ' + walletChain + '; this app targets ' + chain.name + ' (' + chain.id + ').',
        })
      } else {
        setNotice({ tone: 'success', text: 'Connected as ' + truncateAddress(address) + '.' })
      }
      await loadInstances()
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error).slice(0, 280) })
    } finally {
      setBusy(null)
    }
  }

  async function handleSwitch() {
    setBusy('Switch network')
    try {
      await switchToSelectedChain()
      const walletChain = await readWalletChainId()
      setChainOk(walletChain === chain.id)
      setNotice(
        walletChain === chain.id
          ? { tone: 'success', text: 'Wallet is now on ' + chain.name + '.' }
          : { tone: 'error', text: 'Wallet is still on chain ' + walletChain + '. Switch and retry.' },
      )
    } catch (error) {
      const classified = classifyError(error)
      setNotice({ tone: 'error', text: classified.message })
    } finally {
      setBusy(null)
    }
  }

  async function handleCreate() {
    const factory = factoryAddress
    if (!factory || !account) return
    const currentAccount: Address = account
    const ok = await sendTransaction('Create scenario', (wallet) =>
      wallet.writeContract({ address: factory, abi: factoryAbi, functionName: 'createScenario', account: currentAccount, chain }),
    )
    if (!ok) return
    try {
      const publicClient = await getPublicClient()
      const list = (await publicClient.readContract({
        address: factory,
        abi: factoryAbi,
        functionName: 'myScenarios',
      })) as Address[]
      setInstances(list)
      const newest = list[list.length - 1]
      if (!newest) {
        setNotice({ tone: 'error', text: 'Scenario transaction confirmed but no instance was returned.' })
        return
      }
      setInstance(newest)
      const kids = await loadChildren(newest)
      await refreshState(newest, account, kids)
      setNotice({
        tone: 'success',
        text: 'Isolated scenario ready at ' + truncateAddress(newest) + '. Inject the split to begin.',
      })
    } catch (error) {
      setNotice({ tone: 'error', text: 'Created, but reading the new instance failed: ' + errorMessage(error).slice(0, 200) })
    }
  }

  async function handleSelect(address: Address) {
    if (!account) return
    setInstance(address)
    setBusy('Load scenario')
    try {
      const kids = await loadChildren(address)
      await refreshState(address, account, kids)
      setNotice({ tone: 'info', text: 'Loaded scenario ' + truncateAddress(address) + '.' })
    } catch (error) {
      setNotice({ tone: 'error', text: 'Could not read that scenario: ' + errorMessage(error).slice(0, 200) })
    } finally {
      setBusy(null)
    }
  }

  async function handleSplit(inject: boolean) {
    if (!instance || !account) return
    const label = inject ? 'Inject split (multiplier 2×)' : 'Clear split (multiplier 1×)'
    const ok = await sendTransaction(label, (wallet) =>
      wallet.writeContract({
        address: instance,
        abi: instanceAbi,
        functionName: 'setSplitMultiplier',
        args: [inject ? MULTIPLIER_SPLIT : MULTIPLIER_HEALTHY],
        account,
        chain,
      }),
    )
    if (ok) await refreshState(instance, account)
  }

  async function handleDeposit() {
    if (!instance || !account || !children) return
    const okUnsafe = await sendTransaction('Deposit 100 into unsafe', (wallet) =>
      wallet.writeContract({
        address: children.unsafe,
        abi: consumerAbi,
        functionName: 'deposit',
        args: [DEPOSIT_AMOUNT],
        account,
        chain,
      }),
    )
    if (!okUnsafe) return
    const okGuarded = await sendTransaction('Deposit 100 into guarded', (wallet) =>
      wallet.writeContract({
        address: children.guarded,
        abi: consumerAbi,
        functionName: 'deposit',
        args: [DEPOSIT_AMOUNT],
        account,
        chain,
      }),
    )
    if (okGuarded) await refreshState(instance, account, children)
  }

  async function handleBorrow(kind: 'unsafe-incorrect' | 'guarded-incorrect' | 'guarded-correct') {
    if (!instance || !account || !children) return
    if (kind === 'unsafe-incorrect') {
      const ok = await sendTransaction('Borrow $12,000 on unsafe', (wallet) =>
        wallet.writeContract({
          address: children.unsafe,
          abi: consumerAbi,
          functionName: 'borrow',
          args: [BORROW_INCORRECT],
          account,
          chain,
        }),
      )
      if (ok) await refreshState(instance, account, children)
    } else if (kind === 'guarded-incorrect') {
      const ok = await sendTransaction(
        'Borrow $12,000 on guarded',
        (wallet) =>
          wallet.writeContract({
            address: children.guarded,
            abi: consumerAbi,
            functionName: 'borrow',
            args: [BORROW_INCORRECT],
            account,
            chain,
          }),
        { expectedRevert: 'Guard rejected the incorrect cap as expected.' },
      )
      if (ok) await refreshState(instance, account, children)
    } else {
      const ok = await sendTransaction('Borrow $6,000 on guarded', (wallet) =>
        wallet.writeContract({
          address: children.guarded,
          abi: consumerAbi,
          functionName: 'borrow',
          args: [BORROW_CORRECT],
          account,
          chain,
        }),
      )
      if (ok) await refreshState(instance, account, children)
    }
  }

  async function handleRepay() {
    if (!instance || !account || !children || !positions) return
    if (positions.unsafeDebt > 0n) {
      const amount = positions.unsafeDebt
      const ok = await sendTransaction('Repay unsafe debt', (wallet) =>
        wallet.writeContract({
          address: children.unsafe,
          abi: consumerAbi,
          functionName: 'repay',
          args: [amount],
          account,
          chain,
        }),
      )
      if (!ok) return
    }
    if (positions.guardedDebt > 0n) {
      const amount = positions.guardedDebt
      const ok = await sendTransaction('Repay guarded debt', (wallet) =>
        wallet.writeContract({
          address: children.guarded,
          abi: consumerAbi,
          functionName: 'repay',
          args: [amount],
          account,
          chain,
        }),
      )
      if (!ok) return
    }
    await refreshState(instance, account, children)
  }

  async function handleRefresh() {
    if (!instance || !account) return
    setBusy('Refresh reads')
    try {
      await refreshState(instance, account)
      setNotice({ tone: 'info', text: 'Reads refreshed at the latest block.' })
    } catch {
      setNotice({ tone: 'error', text: 'RPC read failed. Check the network and retry.' })
    } finally {
      setBusy(null)
    }
  }

  function handleDownload() {
    if (!instance || !account || !children || !positions || multiplier === undefined) {
      setNotice({ tone: 'error', text: 'No complete observed run to export yet.' })
      return
    }
    try {
      const report = buildEvidenceReport({
        owner: account,
        instance,
        chainId: chain.id,
        chainName: chain.name,
        ...(factoryAddress ? { factory: factoryAddress } : {}),
        token: children.token,
        unsafe: children.unsafe,
        guarded: children.guarded,
        multiplier,
        deposit: DEPOSIT_AMOUNT,
        borrows: [BORROW_INCORRECT, BORROW_CORRECT],
        positions,
        transactions: txs,
      })
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'cruxmark-evidence-' + instance.slice(0, 10) + '.json'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setNotice({ tone: 'success', text: 'Evidence report downloaded. It contains only confirmed receipts.' })
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error).slice(0, 280) })
    }
  }

  if (!factoryAddress) {
    return (
      <section id="execute" className="exec-section wrap" aria-labelledby="execute-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LIVE EXECUTION</p>
            <h2 id="execute-title">
              Run the split.
              <br />
              <span>On chain, not in copy.</span>
            </h2>
          </div>
          <p>
            Deployment not configured.
            <br className="desktop-break" /> Set the factory address to enable execution.
          </p>
        </div>
        <div className="exec-panel">
          <p className="exec-empty">
            No factory address is configured. Deploy the sandbox with{' '}
            <span className="mono">pnpm run deploy:local</span>, then set{' '}
            <span className="mono">VITE_FACTORY_ADDRESS</span> to the deployed{' '}
            <span className="mono">ScenarioFactory</span> address in{' '}
            <span className="mono">.env.local</span> and restart the dev server.
          </p>
        </div>
      </section>
    )
  }

  const splitActive = multiplier === MULTIPLIER_SPLIT
  const ready = account && chainOk && instance && children

  return (
    <section id="execute" className="exec-section wrap" aria-labelledby="execute-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">LIVE EXECUTION</p>
          <h2 id="execute-title">
            Run the split.
            <br />
            <span>On chain, not in copy.</span>
          </h2>
        </div>
        <p>
          Connect a test wallet, create an isolated scenario,
          <br className="desktop-break" /> then observe the faulty and guarded outcomes.
        </p>
      </div>
      <div className="exec-panel">
        <div className="exec-grid">
          <div className="exec-step">
            <p className="mono exec-label">01 / WALLET</p>
            <h3>Connect a test wallet</h3>
            <p>
              Target: {chain.name} (chain {chain.id}). Test assets only. Never connect with real funds.
            </p>
            {!account ? (
              <button className="button button-primary" onClick={handleConnect} disabled={busy !== null}>
                {busy === 'Connect wallet' ? 'Requesting…' : 'Connect wallet'}
              </button>
            ) : (
              <div className="exec-row">
                <span className="mono exec-account">{truncateAddress(account)}</span>
                {chainOk ? (
                  <span className="exec-badge ok">Correct network</span>
                ) : (
                  <button className="button button-small button-outline" onClick={handleSwitch} disabled={busy !== null}>
                    Switch to {chain.name}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="exec-step">
            <p className="mono exec-label">02 / SCENARIO</p>
            <h3>Create an isolated run</h3>
            <p>Each wallet owns its mocks. Faults never cross runs.</p>
            <div className="exec-row">
              <button
                className="button button-outline"
                onClick={handleCreate}
                disabled={!account || !chainOk || busy !== null}
              >
                {busy === 'Create scenario' ? 'Creating…' : 'Create scenario'}
              </button>
              {instances.length > 0 && (
                <select
                  aria-label="Select a scenario instance"
                  value={instance ?? ''}
                  onChange={(event) => handleSelect(event.target.value as Address)}
                  disabled={busy !== null}
                >
                  <option value="" disabled>
                    Select instance ({instances.length})
                  </option>
                  {instances.map((address) => (
                    <option key={address} value={address}>
                      {truncateAddress(address)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {instance && (
              <p className="mono exec-address">
                Instance {truncateAddress(instance)}
                {explorerAddressUrl(instance) && (
                  <>
                    {' '}
                    <a href={explorerAddressUrl(instance)} target="_blank" rel="noreferrer">
                      View ↗
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
          <div className="exec-step">
            <p className="mono exec-label">03 / FAULT</p>
            <h3>Inject the split</h3>
            <p>Multiplier 1× is healthy. 2× reproduces the seeded split.</p>
            <div className="exec-row">
              <button
                className="button button-outline"
                onClick={() => handleSplit(true)}
                disabled={!ready || busy !== null}
              >
                Inject 2×
              </button>
              <button
                className="button button-small button-outline"
                onClick={() => handleSplit(false)}
                disabled={!ready || busy !== null}
              >
                Clear to 1×
              </button>
              {multiplier !== undefined && (
                <span className={`exec-badge ${splitActive ? 'fault' : 'ok'}`}>
                  {splitActive ? 'Split active (2×)' : 'Healthy (1×)'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="exec-grid">
          <div className="exec-step">
            <p className="mono exec-label">04 / COLLATERAL</p>
            <h3>Deposit 100 tokens</h3>
            <p>Synthetic balances. No real transfers.</p>
            <div className="exec-row">
              <button className="button button-outline" onClick={handleDeposit} disabled={!ready || busy !== null}>
                Deposit into both
              </button>
              <button className="button button-small button-outline" onClick={handleRefresh} disabled={!ready || busy !== null}>
                Refresh reads
              </button>
            </div>
          </div>
          <div className="exec-step">
            <p className="mono exec-label">05 / BORROW</p>
            <h3>Attempt the action</h3>
            <p>The incorrect cap permits what the correct cap rejects.</p>
            <div className="exec-actions">
              <button
                className="button button-small button-outline"
                onClick={() => handleBorrow('unsafe-incorrect')}
                disabled={!ready || busy !== null}
              >
                Borrow $12k unsafe
              </button>
              <button
                className="button button-small button-outline"
                onClick={() => handleBorrow('guarded-incorrect')}
                disabled={!ready || busy !== null}
              >
                Borrow $12k guarded
              </button>
              <button
                className="button button-small button-outline"
                onClick={() => handleBorrow('guarded-correct')}
                disabled={!ready || busy !== null}
              >
                Borrow $6k guarded
              </button>
              <button
                className="button button-small button-outline"
                onClick={handleRepay}
                disabled={!ready || busy !== null}
              >
                Repay all
              </button>
            </div>
          </div>
        </div>

        <div className="exec-results" aria-live="polite" aria-atomic="true">
          {notice && <p className={`exec-notice ${notice.tone}`}>{notice.text}</p>}
          {positions ? (
            <div className="exec-values">
              <div>
                <span>Unsafe value</span>
                <strong>{formatUsd18(positions.unsafeValue)}</strong>
                <small>
                  Cap {formatUsd18(positions.unsafeCap)} · Debt {formatUsd18(positions.unsafeDebt)}
                </small>
              </div>
              <div>
                <span>Guarded value</span>
                <strong>{formatUsd18(positions.guardedValue)}</strong>
                <small>
                  Cap {formatUsd18(positions.guardedCap)} · Debt {formatUsd18(positions.guardedDebt)}
                </small>
              </div>
              <div>
                <span>Raw evidence</span>
                <small className="mono">
                  unsafe {positions.unsafeValue.toString()} / guarded {positions.guardedValue.toString()}
                </small>
                <small>Integer USD18 decimal strings. No floating-point math.</small>
              </div>
            </div>
          ) : (
            <p className="exec-empty">
              No observed outcomes yet. Create a scenario, inject the split, and deposit to populate executed
              values. Illustrative previews above are expectations, not results.
            </p>
          )}
          {txs.length > 0 && (
            <ul className="exec-txs">
              {txs.map((tx) => (
                <li key={tx.hash}>
                  <span>{tx.label}</span>
                  <span className="mono">
                    {explorerTxUrl(tx.hash) ? (
                      <a href={explorerTxUrl(tx.hash)} target="_blank" rel="noreferrer">
                        {tx.hash.slice(0, 10)}… ↗
                      </a>
                    ) : (
                      tx.hash.slice(0, 10) + '…'
                    )}{' '}
                    · block {tx.block} · {tx.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="exec-row">
            <button
              className="button button-small button-outline"
              onClick={handleDownload}
              disabled={!positions || !instance || busy !== null}
            >
              Download evidence JSON
            </button>
            <small className="exec-hint">Versioned report. Decimal-string amounts. Confirmed receipts only.</small>
          </div>
        </div>
        <div className="lab-disclosure">
          <span className="info-icon" aria-hidden="true">
            i
          </span>
          <p>
            Executed results only: badges and values above derive from confirmed receipts and contract reads.
            A rejected signature is not a guard success. A hash without a receipt is pending, not pass.
          </p>
        </div>
      </div>
    </section>
  )
}
