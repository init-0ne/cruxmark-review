import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { chain, publicClient } from './chains'
import './style.css'

function App() {
  const [status, setStatus] = useState('Connection has not been checked.')
  const [checking, setChecking] = useState(false)

  async function checkNetwork() {
    setChecking(true)
    setStatus('Checking the selected network…')
    try {
      const actualId = await publicClient.getChainId()
      if (actualId !== chain.id) {
        setStatus('This connection points to a different network. Check the selected network and try again.')
        return
      }
      const block = await publicClient.getBlockNumber()
      setStatus(`Connected to ${chain.name}. Latest block: ${block.toLocaleString()}.`)
    } catch {
      setStatus(`Could not connect. ${chain.id === 31337 ? 'Start the local chain and try again.' : 'Try again or change the public endpoint.'}`)
    } finally {
      setChecking(false)
    }
  }

  return <main>
    <header><a className="brand" href="/">CRUXMARK<span className="mark" aria-hidden="true">×</span></a><span className="badge">Development workspace</span></header>
    <section className="intro">
      <p className="eyebrow">Tokenized finance / integration testing</p>
      <h1>Find the fault.<br /><span>Before the funds.</span></h1>
      <p className="lede">Stress-test stock token integrations against corporate actions, unavailable prices, and sequencer recovery.</p>
    </section>
    <section className="experiment" aria-labelledby="experiment-title">
      <div><p className="eyebrow">The first experiment</p><h2 id="experiment-title">A stock split should not<br />double your borrowing power.</h2><p>100 tokens. A $100 per-token price. The feed already includes the split adjustment.</p></div>
      <div className="comparison"><div><span>Correct collateral value</span><strong>$10,000</strong></div><div className="fault"><span>With the seeded multiplier error</span><strong>$20,000</strong></div><p>Illustrative example. Contract reproduction is in the local test suite.</p></div>
    </section>
    <section className="workspace" aria-labelledby="workspace-title">
      <div><p className="eyebrow">Build status</p><h2 id="workspace-title">Foundation ready.</h2><p>The web workspace and tested price guard are in place. Running scenarios from this page, wallet signing, and evidence export are the next build steps.</p></div>
      <div className="network"><span className="label">Selected network</span><h3>{chain.name}</h3><p>Chain {chain.id} · Test assets only</p><button onClick={checkNetwork} disabled={checking}>{checking ? 'Checking…' : 'Check connection'}</button><p className="status" role="status">{status}</p></div>
    </section>
    <footer><span>Stress-test tokenized finance.</span><span>Controlled scenarios. Reproducible evidence.</span></footer>
  </main>
}

createRoot(document.getElementById('root')!).render(<App />)
