# Build plan

Build a complete demonstration before adding breadth. This is the execution order; each milestone must leave a runnable result and update `STATUS.md`.

## Progress

M0–M4 are implemented and verified locally: 41 contract regressions and a 41-action isolated-Anvil check cover all 15 observed suite checks. A browser wallet deployed the factory to Robinhood Chain Testnet and its receipt/bytecode were verified. The public static demo is live and its chain connection was checked. A public scenario run and submission remain M5 release gates. See `STATUS.md` for the actual verified state.

## M0 — Foundation

Deliver project instructions/skill routing, product and event context, pinned packages, static app, network config, tested price guard and mocks, local deployment script, and CI configuration. Confirm install, doctor, build/tests, local chain and deployment. Public hosting/testnet/submission are separate states.

## M1 — Make the split failure executable end to end

Implement the smallest owned unsafe and guarded stock-collateral consumer. Unsafe applies `uiMultiplier()` twice; guarded reads the per-token feed once. Give each run isolated inputs. Use synthetic balances first and label them; add an ERC-20 only if the demo actually needs transfers.

Acceptance: 100 tokens at $100 produce $10k vs $20k after the seeded split, and the 60% caps are $6k vs $12k. Show a contract action that the incorrect cap permits and the correct cap rejects. Healthy inputs work in both versions. Test authorization, decimal scaling, boundary amounts and safe repayment behavior. Never send real assets to the unsafe consumer.

## M2 — Connect the real user flow

Add browser wallet connection, allowed-chain switch, scenario creation, signed fault/action transactions, receipt handling and actual result reads. Viem is already installed; add a wallet library only if multiple providers/mobile access justify it.

Acceptance: connect → select/create owned sandbox → run split → inspect failure → use protected variant → rerun works from a fresh wallet. Show pending, rejected signature, wrong network, reverted action, failed RPC and retry states. Result badges depend on observed data. The page's current sample values remain explicitly illustrative until replaced.

## M3 — Add unavailable-price and recovery scenarios

Reuse the existing guard and mock inputs; expose the defined scenario families in the same flow. Validate input age against chain time and capture parameters. Do not pretend to interrupt a real sequencer.

Acceptance: positive stale price and positive paused price block unsafe price-dependent behavior; down/recovery-grace behavior is blocked; a healthy post-grace control succeeds. Repayment works when price-dependent borrowing is blocked. Independent users cannot change each other's recorded run.

## M4 — Evidence and repeatability

Export a versioned JSON report using the architecture's evidence fields and readable explanations. Record inputs and observations at known blocks. Include explorer links for public runs; show local evidence as local. Add one report behavioral check ensuring large integer amounts roundtrip and incomplete receipts cannot count as passes.

Acceptance: a reviewer can reproduce a reported scenario from the code/configuration and inspect its matching transactions. Source commit/network/contracts are explicit. A download contains no secret or manufactured successful outcome. A registry contract is optional.

## M5 — Public deployment and submission

Obtain a dedicated test wallet/faucet funds, dry-run the existing deployment script on the selected public testnet, broadcast with wallet authorization, confirm receipts/bytecode/ownership, and record a public deployment manifest. Verify each scenario from the published app using a fresh run.

Use the free GitHub Pages demo at `https://0xuser64bit.github.io/cruxmark-demo/`, published from a separate public repository containing only built static files. Build with the verified public network/factory settings and Vite base `/cruxmark-demo/`. No paid backend or domain. If build-time secrets become necessary, stop exposing them via Vite and revisit the architecture. Put contract execution in the local/CI or on-chain flow; static hosting does not compile Solidity.

Acceptance: public URL, source/reviewer access, labeled addresses, reproducible scenarios and checklist complete. Prepare a short recording, but check actual submission fields before asserting a duration requirement. Submit before the documented cutoff and capture submission confirmation.

## Time and priorities

The setup date was October 2, 2026. The public event page checked October 3 displays registration closing October 4 at 21:28 IST and project submission one minute later; the user confirmed registration. M0–M4 are locally verified and the static demo is hosted, so prioritize a real testnet run, public evidence and the release checklist. Freeze code well before cutoff; reserve time for faucets, explorer indexing, recording, uploads and fresh-wallet testing. A new dashboard feature does not outrank a broken core flow.

If time becomes constrained, publish one complete split scenario and accurately disclose unfinished coverage. The product still targets three families; a partial demo must never be marketed as all three shipped. A public Arbitrum deployment remains necessary for the event; local-only checks do not satisfy it.

## After the hackathon

Validate buyer demand, then add one concrete external integration adapter. Consider live metadata/CI reporting and broader coverage based on demonstrated use. Always-on monitoring, subscriptions, customer accounts, an audit-business workflow and mainnet hardening need their own scope and budget. Add them after the current loop works.
