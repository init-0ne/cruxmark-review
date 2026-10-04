# Cruxmark — submission copy

Use these facts in the signed-in HackQuest submission form. The registered user must review eligibility, legal terms and the Arbitrum One prize wallet themselves. The source repository is public. [Submission checklist](SUBMISSION.md) records what remains open.

## Project

**Name:** Cruxmark

**Tagline:** Stress-test tokenized finance.

**One-line description:** A receipt-backed compatibility lab that shows protocol engineers how a stock-token integration behaves when corporate actions, price availability or sequencer recovery change its assumptions.

**Long description:** Cruxmark runs controlled stock-collateral scenarios against our own wallet-isolated contracts on Robinhood Chain Testnet. In the split case, a $100 per-token feed is already adjusted; multiplying it by the new 2× shares-per-token factor again makes 100 tokens appear worth $20,000 instead of $10,000 and raises a synthetic 60% borrow cap from $6,000 to $12,000. The lab executes both the deliberately faulty consumer and a guarded version, then records their actual contract states and transaction receipts. Paused and stale prices, sequencer-down inputs and recovery grace extend the same suite. Price-dependent borrowing fails closed, while repayment remains available. A downloadable versioned JSON report links exact integer inputs, block reads, transaction outcomes, deployed addresses and source settings so a reviewer can independently recheck the evidence. This is a testnet sandbox with synthetic collateral and controlled mocks; it is not a live Robinhood exploit, an audit or production custody.

**Intended user:** A lending or vault engineer preparing to integrate tokenized stock collateral. Customer demand and pricing have not been validated.

## Links and deployment

- **Frontend/demo:** https://cruxmark.vercel.app/
- **Fallback demo:** https://0xuser64bit.github.io/cruxmark-demo/
- **Source code:** https://github.com/init-0ne/cruxmark-review (public, full commit history)
- **Public demo assets:** https://github.com/0xuser64bit/cruxmark-demo (compiled static files and public evidence JSON only)
- **Complete public evidence:** https://cruxmark.vercel.app/evidence/robinhood-testnet-complete.json (29 on-chain actions; 15/15 checks)
- **Hosted-browser split evidence:** https://cruxmark.vercel.app/evidence/robinhood-testnet-browser-split.json (6 on-chain actions; 4/4 checks)
- **Network:** Robinhood Chain Testnet, chain ID 46630. The [official event page](https://www.hackquest.io/hackathons/Arbitrum-Open-House-Singapore-Online-Buildathon) explicitly lists Robinhood Chain as an eligible Arbitrum chain.
- **Core/factory contract:** `0xabf626f8a3f98e8046d2a85973a36b5a06c0d3fb` — `ScenarioFactory`, creates isolated owned test runs; no privileged factory owner.
- **Factory creation transaction:** `0x6ffe2bc9adbfac5dc582b41d69b9b37edf25285f80c06bc43f9e72651f488afc` — receipt succeeded and exact deployed bytecode was independently verified. [Manifest](deployments/robinhood-testnet.json).
- **Pool:** N/A. The two per-run consumers account for synthetic borrowing, not a liquidity pool.
- **Token contract:** N/A. No transferable collateral or debt token is deployed; the per-run `MockStockStatus` is a controlled status input, not an ERC-20.
- **Complete run:** `0xd2CF058b3ac9840Bf88F09B25d3f71E1fF628ACE`; each `ScenarioInstance` creates its own mock price feed, sequencer feed, stock-status input, price guard and unsafe/guarded consumers. Their exact addresses and roles are in the complete report.
- **Sponsor technology:** Robinhood Chain Testnet for deployment. Do not select USDG, Stylus, a real Robinhood stock token or a production oracle; none is integrated.

## Code produced during the Buildathon

The repository started October 2, 2026, during the September 14–October 4 online Buildathon. Structured commits show the foundation and interface (`205b755`, `339cfa1`), the isolated contract suite (`b3d8132`, `3c26d0c`, `26022e4`), browser-wallet execution and evidence (`b1fe0c5`, `c88584f`, `f12c4f8`), independent deployment/report checks and browser regressions (`0788133`, `fe254cc`, `eb7e2b5`, `f26c606`), and the verified testnet factory/public demo (`c79a449`, `bf1941e`, `c131f3e`, `da4a817`). The public source repository contains the full history. Local `pnpm run check`, `UI_FULL=1 pnpm run ui:test` and `pnpm run doctor` passed for the public evidence release. [Hosted CI for `da4a817`](https://github.com/0xuser64bit/CRUXMARK/actions/runs/37189411117) passed both required jobs, and so did [CI on the public repository](https://github.com/init-0ne/cruxmark-review/actions/runs/37206160133) for `f7fec59`, the revision deployed to the live demo.

## Evidence and limits

**Public scenario evidence:** The complete test-wallet run at [`0xd2CF…8ACE`](https://explorer.testnet.chain.robinhood.com/address/0xd2CF058b3ac9840Bf88F09B25d3f71E1fF628ACE) executed 29 public transactions and covered 15/15 checks across split, paused/stale price and sequencer recovery. Independent `report:verify --state` confirmed all receipts, calldata, block facts, events and 59 historical snapshots/revert replays. A separate run through the GitHub Pages build used an ephemeral EIP-1193 provider in headless Chrome and covered 4/4 split checks, with six receipts and 13 historical snapshots/revert replays verified. The Vercel deployment serves the same app implementation and public reports; its live chain read was checked separately. The user's Brave extension signed the factory deployment; it has not signed a complete browser scenario.

**Reproduce:** Open the demo in a browser with a test wallet on Robinhood Chain Testnet. Choose Stock split, connect, create an isolated run and follow the lab's NEXT action. Download the JSON before refreshing or switching runs. Run `pnpm run report:verify <downloaded-file> --state` promptly against the public RPC; the public RPC prunes historical state. The report verifier separately checks receipts, calldata, block hashes, events, deployment and ownership. A partial report stays labeled partial.

**Scope:** Faults affect only user-owned mocks. The lab has no real token custody, production feed integration, mainnet writes, third-party mutation, discovered exploit or audit conclusion. The landing-page examples are illustrations; pass/fail comes from executed transactions and observed contract state.
