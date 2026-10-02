# Current status

Updated October 2, 2026. Repository: `/Users/user64bit/Code/cruxmark`.

## Shipped locally

- Responsive landing page with labeled illustrative previews, original SVG artwork, self-hosted fonts, keyboard focus and reduced-motion support.
- Owner-isolated factory/instances, controlled mock feeds and token status, guarded and deliberately unsafe synthetic borrowing consumers. No real asset custody.
- Atomic chain-timed healthy/split/paused/stale/sequencer-down/recovery-grace configuration; fault transitions clear unrelated inputs. Healthy restores a fresh price and simulates a historical post-grace recovery.
- Wallet connection, network switch/add, owned run selection, receipt-derived creation, deposits, borrows, safe repayment and block-consistent state reads for all three families.
- Wallet account/network events invalidate the current run. Writes verify the RPC chain and compiled factory runtime hash. Guarded pricing rejection preserves readable collateral/debt and repayment controls.
- Expected borrow rejection is preflight-decoded exactly, then deliberately submitted with bounded gas for a real reverted test transaction. Reports distinguish receipt status from the decoded same-block replay; gas/signature/RPC failures never verify a guard check.
- Versioned `cruxmark-evidence/2` JSON: source revision/dirty flag/compiler, chain/run/contracts, exact integer inputs, before/after snapshots, block hashes/times, calldata, receipts, recorded replay errors and observed coverage. Incomplete coverage stays partial; no six-transaction truncation or fixed deposit/attempt claims.
- CI runs strict TypeScript/build, Solidity formatting/regressions and the real local execution/report checks. Exact dependency pins and the $0 additional spend boundary remain.

## Verified in this hardening pass

- `pnpm run doctor` passes with Node 24.21.0, pnpm 11.24.0 and the project-local Foundry tools.
- `pnpm run check` passes: production build, strict TypeScript, Solidity formatting, 34 contract tests (including 256-run fuzz tests), and an isolated Anvil execution check.
- `pnpm run execution:test` deploys a fresh factory and two independent owners. 41 confirmed actions verify all 15 coverage checks: split valuation/caps and borrow outcomes; paused/stale/down/grace unsafe vs guarded behavior; healthy reopening; repayment while pricing is blocked.
- Checks reject wrong-chain/empty/mismatched factory code, cross-owner run reads, wrong expected reverts, incomplete receipts, wrong-owner/cross-chain evidence, calldata/amount changes, duplicate hashes and inconsistent block hashes. A 30-digit integer survives report serialization exactly.
- Wallet-provider checks cover invalid accounts, account/network changes and chain-4902 add/switch behavior. The local execution check uses unlocked ephemeral Anvil accounts without reading or handling private keys.
- The generated complete local report is in ignored `work/verification/local-evidence.json`; the isolated verification chain is stopped after each check. This is local mock evidence, not a public deployment.
- Forge lint reports timestamp comparisons (intentional chain-time checks) and signed-to-unsigned casts (answers are checked positive before conversion). No guard checks were removed or warnings suppressed to make checks pass.

## Remaining release work

- Browser/mobile inspection and normal browser-wallet signing against the new execution UI.
- Persist and reconcile unresolved transactions across reloads; current confirmation retry works while this browser session remains open.
- Simplify deployment to the isolated factory, verify a release manifest and local bootstrap; check public testnet readiness with the actual signing wallet.
- Public testnet deployment and source verification, free static hosting, remote CI, fresh-wallet public scenario runs and a backup demo recording.
- HackQuest registration/submission and eligibility/prize-wallet details remain unconfirmed. No external deployment/publication/submission has been performed in this pass.

## Next concrete step

Recover unresolved receipts without rebroadcasting, inspect the UI, and finish the reproducible deployment/release path. Public deployment requires the user's dedicated test wallet and faucet funds; wallet secrets must stay outside chat/source/output. The authenticated GitHub CLI is the chosen repository integration; the user previously declined the GitHub plugin.
