# Current status

Updated October 2, 2026. Repository: `/Users/user64bit/Code/cruxmark`.

## Shipped locally

- Responsive landing page with labeled illustrative previews, original SVG artwork, self-hosted fonts, keyboard focus and reduced-motion support.
- Factory-only deployment, on-chain deployment-network allowlist, live receipt/creation-calldata/historical-and-current-bytecode verification, source-linked manifests and automatic local configuration. `docs/RELEASE.md` documents the public release gates; basic static hosting security headers are included.
- Owner-isolated factory/instances, controlled mock feeds and token status, guarded and deliberately unsafe synthetic borrowing consumers. No real asset custody.
- Atomic chain-timed healthy/split/paused/stale/sequencer-down/recovery-grace configuration; fault transitions clear unrelated inputs. Healthy restores a fresh price and simulates a historical post-grace recovery.
- Wallet connection, network switch/add, owned run selection, receipt-derived creation, deposits, borrows, safe repayment and block-consistent state reads for all three families.
- The execution lab names the next control from the selected family and the checks recorded in the current browser session. Pending and unrestored transactions stay ahead of that suggestion.
- Explicit local test-account connection requires both the app and RPC on loopback and chain 31337. It uses disposable unlocked Anvil accounts without reading keys; signing requests are never automatically retried. Public sites retain browser-wallet signing.
- Unresolved transaction metadata persists per chain/factory/wallet. Reload recovery re-reads the original block and confirms the same hash without rebroadcasting. Mined replacements with different calldata never verify a check; confirmed action history is scoped to the current selected browser run, so keep/download completed evidence before switching.
- A saved transaction that can never be confirmed (dropped, or its block state pruned by the RPC) can be discarded after a confirmation prompt, from the pending panel or the failed-recovery panel. It is never counted. Before this, such a record locked every control (including reconnect) until browser site data was cleared; that was reproduced in the real UI with a dropped Anvil transaction and fixed.
- Wallet account/network events invalidate the current run. Writes verify the RPC chain and compiled factory runtime hash. Guarded pricing rejection preserves readable collateral/debt and repayment controls.
- Expected borrow rejection is preflight-decoded exactly, then deliberately submitted with bounded gas for a real reverted test transaction. Reports distinguish receipt status from the decoded same-block replay; gas/signature/RPC failures never verify a guard check.
- The evidence panel shows the age of the price and of the sequencer recovery timestamp at the observed block against the guard's max age and grace, and the lab warns that seeded healthy prices expire with chain time. Checked in a real browser: the stale seed reads 301s against 300s, the healthy sequencer seed 3601s against 3600s, no overflow at 390px.
- Wallet rejection, missing gas funds, wrong network, contract guard rejection, receipt timeout and RPC failure/rate-limit/timeout are described from real viem error types with one actionable message each (previously the UI showed viem's raw, duplicated text and the unused string-matching classifier was bypassed). A guard rejection of an expired healthy input tells the user to seed again.
- Versioned `cruxmark-evidence/2` JSON: source revision/dirty flag/compiler, chain/run/contracts, exact integer inputs, before/after snapshots, block hashes/times, calldata, receipts, recorded replay errors and observed coverage. Incomplete coverage stays partial; no six-transaction truncation or fixed deposit/attempt claims.
- CI runs strict TypeScript/build, Solidity formatting/regressions and the real local execution/report checks. Exact dependency pins and the $0 additional spend boundary remain.

## Verified in this hardening pass

- `pnpm run doctor` passes with Node 24.21.0, pnpm 11.24.0 and the project-local Foundry tools.
- `pnpm run check` passes: production build, strict TypeScript, Solidity formatting, 35 contract tests (including 256-run fuzz tests), and an isolated Anvil execution check.
- A repeated release check caught a timestamp-dependent gas-estimate failure when configuration changes additional slots in the next block. The shared sender now adds 20% plus 30,000 gas to successful-action estimates; the execution regression advances chain time between every estimate and signing. The full check passes with that deterministic timing regression. Expected revert tests retain their separately bounded 300,000 gas limit.
- `pnpm run execution:test` deploys a fresh factory and two independent owners. 41 confirmed actions verify all 15 coverage checks: split valuation/caps and borrow outcomes; paused/stale/down/grace unsafe vs guarded behavior; healthy reopening; repayment while pricing is blocked.
- Pending metadata serialization/restoration, wrong-wallet recovery, wrong-chain receipt confirmation, replaced-action rejection, zero-amount validation and RPC-read failure are also checked.
- Checks reject wrong-chain/empty/mismatched factory code, cross-owner run reads, wrong expected reverts, incomplete receipts, wrong-owner/cross-chain evidence, calldata/amount changes, duplicate hashes and inconsistent block hashes. A 30-digit integer survives report serialization exactly.
- Wallet-provider checks cover invalid accounts, account/network changes and chain-4902 add/switch behavior. The local execution check uses unlocked ephemeral Anvil accounts without reading or handling private keys.
- `pnpm run deploy:local` passed against a fresh loopback chain: one successful factory creation, source-matching runtime at the receipt/current blocks, verified manifest in ignored `work/deployment/local.json`, and public local app settings written to ignored `.env.local`.
- Browser checks at 320/390/768/1440px found no horizontal overflow. Scenario selection, disabled writes without a wallet, missing-wallet feedback and actual local chain/block connectivity work; no browser errors/warnings were observed.
- The actual browser UI executed 39 actions through the explicit local account: all 15 suite checks verified, including five mined guard rejections and repayment to zero in both consumers. The downloaded report passed schema/consistency validation, and every recorded receipt status/block hash/sender/destination/calldata matched the live local chain. Browser-extension signing remains unverified; this browser has no extension wallet provider.
- The opt-in local provider rejects remote app/RPC hosts and unsupported signing/admin methods. These restrictions and actual local account/session reads are in the runnable execution check.
- The same execution check asserts the lab’s next control for synthetic positions, including a blocked repayment that is still outstanding, and for prefixes of the 41-action sequence. A headless browser at 1440, 390, and 320px rendered that guidance with no horizontal overflow. The scenario preview and family select still respond, and the page reported no console exceptions.
- The generated complete local report is in ignored `work/verification/local-evidence.json`; the isolated verification chain is stopped after each check. This is local mock evidence, not a public deployment.
- Browser evidence and its screenshot are in ignored `work/verification/browser-evidence.json` and `browser-result.png`. This captured development report correctly labels its source as dirty; a public release requires a clean build and fresh public evidence.
- Forge lint reports timestamp comparisons (intentional chain-time checks) and signed-to-unsigned casts (answers are checked positive before conversion). No guard checks were removed or warnings suppressed to make checks pass.

## Remaining release work

- Normal browser-wallet signing and public fresh-wallet runs against the new execution UI.
- Public testnet deployment and source verification, free static hosting, CI for the new release, fresh-wallet public scenario runs and a backup demo recording.
- The existing private GitHub repository was confirmed read-only. Its prior `aa6248f` CI run succeeded; these new commits are local and have not run remote CI.
- HackQuest registration/submission and eligibility/prize-wallet details remain unconfirmed. No external deployment/publication/submission has been performed in this pass.

## Next concrete step

Finish public deployment/signing, free hosting and the submission gates in `RELEASE.md`. Public deployment requires the user's dedicated test wallet and faucet funds; wallet secrets must stay outside chat/source/output. The authenticated GitHub CLI is the chosen repository integration; the user previously declined the GitHub plugin.
