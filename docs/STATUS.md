# Current status

Updated October 3, 2026. The core product is locally verified; public release and Buildathon submission are still pending.

## What works

- A wallet-owned contract sandbox runs three controlled fault families: stock split, paused/stale price, and sequencer down/recovery grace. It compares deliberately unsafe synthetic borrowing with a guarded path. No real assets are held.
- The executable lab sits directly after the home page hero. A prominent next action follows actual run state and receipt-backed checks; the underlying controls remain visible. All 15 supported checks can be completed through the browser. Illustrative scenario previews are labeled separately.
- Each run has isolated inputs. Creation, deposits, borrows, expected guard rejections and repayments use real local EVM transactions. The guarded path fails closed for bad pricing while repayment remains available.
- Pending transactions are stored per chain/factory/wallet for confirmation after reload. Confirmation never rebroadcasts. A dropped or unconfirmable submission can be discarded without counting it. Switching or reconnecting warns before clearing confirmed action history; download a report before leaving a run.
- Exported cruxmark-evidence/2 JSON contains exact integer inputs, source/compiler settings, contract addresses, block snapshots, calldata and receipts. Partial coverage remains partial. The independent report verifier rechecks transaction and deployment facts on-chain, with optional historical state comparison.
- Public-build code withholds the disposable local account. Factory bytecode must match this build, and writes accept only chain IDs 31337, 46630 or 421614. Local accounts require a loopback app, loopback RPC and local chain.

## Checks completed on October 3

- pnpm run doctor passed: pinned Node, pnpm, Foundry tools, required docs and Chrome.
- pnpm run check passed: production TypeScript/build, Solidity formatting, 41 contract tests, and 41 confirmed local actions covering all 15 checks with two independent owners.
- pnpm run ui:test passed in real Chrome: guided split flow, a browser-produced report independently verified against the local chain, an injected browser-wallet provider signing local transactions after a rejected signature, wrong-network add/switch, plain-language errors, pending recovery/discard, refusal to clear evidence when a run switch is canceled, and the public-build local-account boundary. The two new wallet assertions failed when their respective behavior was deliberately removed, then passed when restored.
- UI_FULL=1 pnpm run ui:test passed: 24 guided clicks, 29 confirmed actions, all 15 checks, and a complete report verified against local receipts and historical state.
- [Hosted CI for e032394](https://github.com/0xuser64bit/CRUXMARK/actions/runs/37130085739) passed: the required full-browser job and the build/contract/execution job are both green.
- Read-only public checks: factory dry-run simulations succeeded on Robinhood Chain Testnet (46630) and Arbitrum Sepolia (421614) on October 2, and Robinhood chain ID and factory simulation were rechecked October 3. The latest Robinhood estimate was 3,876,458 gas at 0.020000001 gwei, about 0.00007753 ETH; nothing was broadcast. Robinhood's public RPC served the measured short burst; Arbitrum Sepolia rate-limited some reads. Public RPCs prune historical state, so verify reports promptly or use an archive endpoint for --state.

## Limits and next release gate

The contracts test our own mock feed, token status and sequencer inputs. No live stock-token address, production oracle, third-party integration, real custody, liquidation, mainnet deployment, discovered exploit, audit or customer traction has been verified. An injected EIP-1193 provider exercised browser signing locally; an actual browser extension and a fresh public-wallet run remain untested. A receipt hash alone is never treated as a passed check.

The official [HackQuest event page](https://www.hackquest.io/hackathons/Arbitrum-Open-House-Singapore-Online-Buildathon) displayed registration closing October 4 at 21:28 IST and submission closing October 4 at 21:29 IST when checked October 3. Registration, eligibility, team/prize wallet details and submission are unconfirmed. See HACKATHON.md and SUBMISSION.md for the outstanding requirements.

Next: obtain a dedicated test wallet and faucet ETH, deploy and verify the factory on Robinhood Chain Testnet, publish a free static demo with its verified address, run a fresh browser-wallet scenario, verify the downloaded evidence, and submit before the event cutoff. RELEASE.md has the exact procedure. Wallet secrets must stay outside source, chat, tool output, logs and reports.
