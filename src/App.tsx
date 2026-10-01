import { useState } from 'react'
import { chain, getPublicClient } from './chains'

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? 'M6 18 18 6M6 6h12v12' : 'M4 12h15m-6-6 6 6-6 6'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function Mark() {
  return <svg className="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 4h8l3 8 3-8h8l-7 12 7 12h-8l-3-8-3 8H5l7-12L5 4Z" fill="currentColor" /></svg>
}

function StressChamber() {
  return <div className="chamber">
    <div className="chamber-heading"><span className="mono">CRUXMARK / STRESS CHAMBER</span><span className="mono">FIG. A</span></div>
    <svg className="chamber-art" viewBox="0 0 640 590" role="img" aria-labelledby="chamber-title chamber-description">
      <title id="chamber-title">A pricing integration under pressure</title>
      <desc id="chamber-description">An illustrative cross-section: a per-token price enters the integration, a seeded multiplier fault distorts it, and a guard preserves the original value.</desc>
      <defs>
        <linearGradient id="plane" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#8ed4e9" stopOpacity=".3" /><stop offset="1" stopColor="#354e63" stopOpacity=".08" /></linearGradient>
        <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#94ddf2" stopOpacity=".7" /><stop offset="1" stopColor="#94ddf2" stopOpacity=".04" /></linearGradient>
        <linearGradient id="fault-plane"><stop stopColor="#ed9a79" stopOpacity=".65" /><stop offset="1" stopColor="#ed9a79" stopOpacity=".1" /></linearGradient>
        <radialGradient id="chamber-glow"><stop stopColor="#4c99b9" stopOpacity=".2" /><stop offset="1" stopColor="#4c99b9" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="320" cy="310" rx="280" ry="255" fill="url(#chamber-glow)" />
      <g fill="none" stroke="#334c5e" strokeWidth=".7">
        {Array.from({ length: 11 }, (_, i) => <g key={i}><path d={`M${70 + i * 24} ${445 - i * 13}l240 130`} /><path d={`M${310 + i * 24} ${575 - i * 13}l-240-130`} /></g>)}
      </g>
      <g fill="none" stroke="#64849a" strokeWidth=".8">
        <path d="m320 50 190 102v278L320 532 130 430V152L320 50Zm0 0v278m-190-176 190 102 190-102M320 254v278" strokeDasharray="4 7" opacity=".4" />
        <path d="m116 155-15-8v288l219 117 219-117V147l-15 8M101 207l9 5m-9 43 9 5m-9 43 9 5m-9 43 9 5m-9 43 9 5" opacity=".5" />
      </g>
      <g className="chamber-input">
        <path d="m320 124 145 78-145 78-145-78 145-78Z" fill="url(#plane)" stroke="#94ddf2" strokeOpacity=".55" />
        <path d="M175 202v20l145 78 145-78v-20l-145 78-145-78Z" fill="#192f40" stroke="#74b4c9" strokeOpacity=".35" />
        {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${213 + i * 15} ${181 - i * 8}l105 57`} stroke="#94ddf2" strokeOpacity=".3" />)}
        <path d="m320 149 96 53-96 52-96-52 96-53Z" fill="#0e2635" stroke="#94ddf2" strokeOpacity=".75" />
        <path d="m320 167 62 35-62 34-62-34 62-35Z" fill="#94ddf2" fillOpacity=".13" stroke="#94ddf2" />
        <path d="m292 201 18 10 38-20m-20-14v48" fill="none" stroke="#c5edf8" strokeWidth="2" />
      </g>
      <g className="chamber-fault">
        <path d="m351 250 145 78-145 78-145-78 145-78Z" fill="url(#fault-plane)" stroke="#ed9a79" strokeOpacity=".8" />
        <path d="m206 328 145 78v16l-145-78v-16Zm145 78 145-78v16l-145 78v-16Z" fill="#693f36" fillOpacity=".6" stroke="#ed9a79" strokeOpacity=".5" />
        <path d="m263 296 127 68m-99-82 127 68" stroke="#ed9a79" strokeWidth="2" />
        <path d="m351 275 99 53-99 53-99-53 99-53Z" fill="none" stroke="#ffb89d" strokeDasharray="4 5" />
      </g>
      <g className="chamber-guard">
        <path d="m320 352 145 78-145 78-145-78 145-78Z" fill="url(#plane)" stroke="#94ddf2" strokeOpacity=".8" />
        <path d="M175 430v17l145 78 145-78v-17l-145 78-145-78Z" fill="#1e4455" stroke="#94ddf2" strokeOpacity=".5" />
        <path d="m320 372 108 58-108 58-108-58 108-58Z" fill="#94ddf2" fillOpacity=".1" stroke="#94ddf2" strokeOpacity=".65" />
        <path d="m299 427 16 9 29-16" fill="none" stroke="#c5edf8" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g fill="none" strokeWidth="1">
        <path d="M408 153h88l20-20" stroke="#94ddf2" strokeOpacity=".5" /><circle cx="408" cy="153" r="3" fill="#94ddf2" />
        <path d="M442 297h67l18 18" stroke="#ed9a79" strokeOpacity=".6" /><circle cx="442" cy="297" r="3" fill="#ed9a79" />
        <path d="M229 430h-83l-20 20" stroke="#94ddf2" strokeOpacity=".5" /><circle cx="229" cy="430" r="3" fill="#94ddf2" />
        <path d="M320 302v35m0 0-4-7m4 7 4-7" stroke="url(#edge)" />
      </g>
      <g className="diagram-type" fill="#a2b8c7">
        <text x="473" y="108">PER-TOKEN FEED</text><text x="473" y="126" className="diagram-value" fill="#dcf3fa">$100.00</text>
        <text x="505" y="337" fill="#ed9a79">SEEDED FAULT</text><text x="505" y="355" className="diagram-value" fill="#ffc2aa">× 2 AGAIN</text>
        <text x="42" y="473">GUARDED VALUE</text><text x="42" y="491" className="diagram-value" fill="#dcf3fa">$100.00</text>
      </g>
    </svg>
    <div className="chamber-caption"><span><i className="signal-dot" />One input. Two very different outcomes.</span><span className="mono">ILLUSTRATION</span></div>
  </div>
}

const scenarios = [
  { name: 'Stock split', category: 'Corporate actions', icon: 'split', title: 'Same tokens. Twice the collateral?', description: 'A two-for-one split changes the shares per token. An adjusted per-token feed already accounts for it. Applying the multiplier again creates borrowing power that should never exist.', inputs: [['Token balance', '100 tokens'], ['Per-token feed', '$100.00'], ['Shares per token', '2× after split']], fault: '$20,000', guarded: '$10,000', metric: 'Illustrative collateral value', faultLabel: 'Multiplier applied twice', guardLabel: 'Per-token price used once', faultNote: 'At an illustrative 60% limit, the faulty formula permits $12,000 of debt against $10,000 of collateral.', guardNote: 'The correct collateral stays $10,000. At the same 60% limit, borrowing power stays $6,000.' },
  { name: 'Unavailable price', category: 'Oracle availability', icon: 'price', title: 'A positive price can still be unusable.', description: 'A feed can return a positive answer while the token is paused or the price is too old. Check availability and timestamps before a price-dependent action.', inputs: [['Feed answer', '$100.00'], ['Fault input', 'Paused or stale'], ['Sandbox max age', '300 seconds']], fault: 'Keeps pricing', guarded: 'Rejects pricing', metric: 'Expected price-dependent behavior', faultLabel: 'Availability checks omitted', guardLabel: 'Pause and freshness checked', faultNote: 'The seeded consumer trusts the positive answer, even when the input is unavailable.', guardNote: 'The guard rejects paused inputs and prices older than the configured limit. Healthy data can proceed.' },
  { name: 'Sequencer recovery', category: 'Market access', icon: 'sequencer', title: 'Back online is only the beginning.', description: 'After downtime, markets need time to recover. A controlled sequencer-status input lets the lab examine downtime and the exact recovery-grace boundary.', inputs: [['Status input', 'Controlled mock'], ['Sandbox grace', '3,600 seconds'], ['Recovery boundary', '≤ grace rejected']], fault: 'Opens too early', guarded: 'Waits for recovery', metric: 'Expected price-dependent behavior', faultLabel: 'Recovery grace ignored', guardLabel: 'Downtime and grace checked', faultNote: 'The seeded consumer would allow pricing during downtime or inside the recovery window.', guardNote: 'The guard rejects downtime and the entire grace window. A healthy control can proceed after the boundary.' },
] as const

function ScenarioIcon({ type }: { type: string }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={type === 'split' ? 'M5 12h6m0 0 5-6h4m-9 6 5 6h4M17 3l3 3-3 3m0 6 3 3-3 3' : type === 'price' ? 'M3 12h4l3-7 4 14 3-7h4' : 'M5 8a9 9 0 0 1 15 1m0-5v5h-5M19 16a9 9 0 0 1-15-1m0 5v-5h5'} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

export default function App() {
  const [selected, setSelected] = useState(0)
  const [guarded, setGuarded] = useState(false)
  const [status, setStatus] = useState('Connection not checked yet.')
  const [checking, setChecking] = useState(false)
  const [connected, setConnected] = useState(false)
  const scenario = scenarios[selected]

  async function checkNetwork() {
    setChecking(true)
    setConnected(false)
    setStatus('Checking the selected network…')
    try {
      const publicClient = await getPublicClient()
      const actualId = await publicClient.getChainId()
      if (actualId !== chain.id) {
        setStatus('This connection points to a different network. Check the selected network and try again.')
        return
      }
      const block = await publicClient.getBlockNumber()
      setConnected(true)
      setStatus(`Connected to ${chain.name}. Latest block: ${block.toLocaleString()}.`)
    } catch {
      setStatus(`Could not connect. ${chain.id === 31337 ? 'Start the local chain and try again.' : 'Try again or change the public endpoint.'}`)
    } finally {
      setChecking(false)
    }
  }

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header wrap">
      <a className="brand" href="#" aria-label="Cruxmark home"><Mark />cruxmark<span className="brand-period">.</span></a>
      <nav aria-label="Main navigation"><a href="#lab">The lab</a><a href="#method">How it works</a><a href="#documentation">Documentation</a></nav>
      <a className="button button-small button-outline header-cta" href="#lab">Explore the lab <Arrow diagonal /></a>
    </header>
    <main id="main">
      <section className="hero wrap" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="tiny-cross">+</span> THE STOCK-TOKEN COMPATIBILITY LAB</p>
          <h1 id="hero-title">Stress-test<br /><span className="hero-muted">tokenized</span><br /><span className="hero-accent">finance.</span></h1>
          <p className="hero-description">Markets move. Splits happen. Oracles pause.<br className="desktop-break" /> Know how your integration behaves under pressure.</p>
          <div className="hero-actions"><a className="button button-primary" href="#lab">Explore the scenarios <Arrow /></a><a className="text-link" href="#method"><span className="play-icon" aria-hidden="true">▷</span> See the approach</a></div>
          <p className="hero-footnote"><span className="signal-dot" />Controlled faults. Clear boundaries. No real funds.</p>
        </div>
        <StressChamber />
      </section>
      <div className="scope-strip wrap"><p>Built for the moments<br /><strong>happy-path tests miss.</strong></p><div><ScenarioIcon type="split" /><span>Corporate actions</span></div><div><ScenarioIcon type="price" /><span>Oracle availability</span></div><div><ScenarioIcon type="sequencer" /><span>Sequencer recovery</span></div></div>

      <section id="lab" className="lab-section wrap" aria-labelledby="lab-title">
        <div className="section-heading"><div><p className="eyebrow">INSIDE THE LAB</p><h2 id="lab-title">Good assumptions.<br /><span>Meet bad conditions.</span></h2></div><p>Explore three failure families. See the faulty logic,<br className="desktop-break" /> then examine the guard that changes the outcome.</p></div>
        <div className="lab-window">
          <div className="window-bar"><span><span className="window-symbol" aria-hidden="true">⌘</span> Cruxmark stock-collateral sandbox</span><span className="preview-label"><i /> INTERACTIVE PREVIEW</span></div>
          <div className="lab-body">
            <div className="scenario-sidebar"><p className="mono sidebar-label">SELECT A SCENARIO</p><div className="scenario-options" role="group" aria-label="Scenario preview">{scenarios.map((item, index) => <button key={item.name} className={`scenario-option ${selected === index ? 'selected' : ''}`} aria-pressed={selected === index} onClick={() => { setSelected(index); setGuarded(false) }}><ScenarioIcon type={item.icon} /><span><strong>{item.name}</strong><small>{item.category}</small></span><Arrow /></button>)}</div><div className="sidebar-note"><span className="mono">THE TEST BOUNDARY</span><p>Our contracts. Controlled inputs. Explicit expectations.</p><span className="subtle">No third-party contracts are mutated.</span></div></div>
            <div className={`scenario-detail ${guarded ? 'is-guarded' : ''}`}>
              <div className="scenario-topline"><span className="mono">{scenario.category}</span><span className="example-pill">Illustrative example</span></div>
              <h3>{scenario.title}</h3><p className="scenario-description">{scenario.description}</p>
              <div className="input-strip">{scenario.inputs.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
              <div className="comparison-header"><span className="mono">COMPARE THE LOGIC</span><div className="logic-toggle" role="group" aria-label="Logic preview"><button aria-pressed={!guarded} onClick={() => setGuarded(false)}>Seeded fault</button><button aria-pressed={guarded} onClick={() => setGuarded(true)}>Guarded logic</button></div></div>
              <div className="outcome" aria-live="polite" aria-atomic="true"><div><span className="outcome-label">{scenario.metric}</span><strong className={`outcome-value ${selected > 0 ? 'outcome-words' : ''}`}>{guarded ? scenario.guarded : scenario.fault}</strong><span className="outcome-state"><i />{guarded ? scenario.guardLabel : scenario.faultLabel}</span></div>{selected === 0 && <svg className="outcome-chart" viewBox="0 0 240 95" aria-hidden="true"><path d="M0 75H240M0 40H240M30 0v95m60-95v95m60-95v95m60-95v95" stroke="#263746" strokeWidth=".7" /><path d="M0 75H240" stroke="#7794a5" strokeDasharray="3 5" /><path d={guarded ? 'M0 62H240' : 'M0 62h104l14-40h122'} stroke="currentColor" strokeWidth="2" fill="none" /><circle cx="225" cy={guarded ? 62 : 22} r="4" fill="currentColor" /></svg>}</div>
              <p className="outcome-explanation">{guarded ? scenario.guardNote : scenario.faultNote}</p>
            </div>
          </div>
          <div className="lab-disclosure"><span className="info-icon" aria-hidden="true">i</span><p>This preview explains expected behavior. It does not execute transactions or produce test results. Wallet execution and evidence export are in development.</p></div>
        </div>
      </section>

      <section id="method" className="method-section wrap" aria-labelledby="method-title">
        <div className="section-heading"><div><p className="eyebrow">THE CRUXMARK APPROACH</p><h2 id="method-title">From “should work”<br /><span>to show your work.</span></h2></div><p>A repeatable path from an integration assumption<br className="desktop-break" /> to evidence an engineer can inspect.</p></div>
        <div className="method-steps">
          <article><span className="step-number mono">01 / REPRODUCE</span><div className="step-visual step-fault" aria-hidden="true"><span /><span /><span /></div><h3>Put the fault in focus.</h3><p>Choose a supported integration. Introduce a specific fault with controlled, isolated inputs.</p></article>
          <article><span className="step-number mono">02 / PROTECT</span><div className="step-visual step-guard" aria-hidden="true"><span /><span /><span /></div><h3>Change the logic.</h3><p>Apply a price guard that respects token units, availability, freshness, and recovery windows.</p></article>
          <article><span className="step-number mono">03 / VERIFY</span><div className="step-visual step-verify" aria-hidden="true"><span /><span /><span /></div><h3>Rerun. Then prove it.</h3><p>Repeat the same scenario. The complete flow will capture observed outcomes and export reproducible evidence.</p></article>
        </div>
        <p className="method-note"><span className="signal-dot" />Price guard and local contract tests exist today. The complete scenario-to-report flow is the next build.</p>
      </section>

      <section id="documentation" className="foundation-section wrap" aria-labelledby="foundation-title">
        <div className="foundation-copy"><p className="eyebrow">OPEN THE BLACK BOX</p><h2 id="foundation-title">Precision starts<br /><span>with transparency.</span></h2><p>Cruxmark is an early-stage compatibility lab for stock-token integrations. The local foundation includes a price guard, owned mock inputs, and executable contract regressions.</p><a className="text-link" href="https://docs.robinhood.com/chain/building-with-stock-tokens/" target="_blank" rel="noreferrer">Read the stock-token semantics <Arrow diagonal /></a><details className="local-guide"><summary>Run the local foundation <span aria-hidden="true">+</span></summary><div><p>Use Node 24 and pnpm 11.24.0 from the project directory.</p><pre><code>pnpm install --frozen-lockfile{'\n'}pnpm run doctor{'\n'}pnpm run check</code></pre><p>Start the local chain and web app in separate terminals:</p><pre><code>pnpm run chain{'\n'}pnpm run dev</code></pre><p>Use the README for deployment instructions. All sandbox assets are test assets.</p></div></details></div>
        <div className="network-panel"><div className="network-panel-head"><span className="mono">NETWORK READINESS</span><span className="network-icon" aria-hidden="true">◎</span></div><span className="label">Selected network</span><h3>{chain.name}</h3><p className="network-id mono">CHAIN {chain.id} <span>/</span> TEST ASSETS ONLY</p><div className="network-boundary"><span>Price guard + mock inputs</span><span>Local foundation</span></div><div className="network-boundary"><span>Wallet + scenario execution</span><span>In development</span></div><button className="button button-outline network-button" onClick={checkNetwork} disabled={checking}>{checking ? 'Checking connection…' : 'Check connection'}<Arrow /></button><p className={`network-status ${connected ? 'connected' : ''}`} role="status"><i />{status}</p></div>
      </section>
      <section className="closing wrap" aria-labelledby="closing-title"><div><p className="eyebrow">QUESTION THE ASSUMPTION.</p><h2 id="closing-title">Find the fault.<br /><span>Before the funds.</span></h2></div><div><a className="button button-primary" href="#lab">Explore the lab <Arrow diagonal /></a><p>One supported sandbox. Three defined fault families.<br />A sharper way to test tokenized finance.</p></div></section>
    </main>
    <footer className="site-footer wrap"><div><a className="brand" href="#" aria-label="Cruxmark home"><Mark />cruxmark<span className="brand-period">.</span></a><p>Stress-test tokenized finance.</p></div><div className="footer-links"><a href="#lab">Scenarios</a><a href="#documentation">Documentation</a><a href="#method">Our approach</a></div><div className="footer-bottom"><span>© 2026 Cruxmark</span><p>Controlled scenarios are scoped compatibility checks, not a full audit or a security guarantee.</p><span className="mono">BUILT TO QUESTION.</span></div></footer>
  </>
}
