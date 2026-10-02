# Current status

Updated: October 2, 2026. Project location: `/Users/user64bit/Code/cruxmark`.

## Current hardening pass

- Added owner-only atomic scenario configuration for healthy, split, paused, stale, sequencer-down and recovery-grace inputs. Timestamps come from the executing block; switching faults clears prior faults and refreshes the price. Healthy recovery is explicitly simulated, not an actual chain outage.
- `pnpm run doctor` passed. Baseline `pnpm run check` passed with 31 tests; after the atomic scenario change it passes with 34 tests, including cross-run isolation, fault transitions, healthy reopening and repayment during unavailable-price/downtime/recovery inputs.
- Next: repair wallet/RPC identity checks, exact revert classification, block-consistent reads and report provenance before completing all web scenario controls. Public deployment still needs a dedicated signing wallet and faucet funds.

## Implemented in the foundation

- Product, architecture, build plan, hackathon and submission context.
- Repository `AGENTS.md` and scoped `cruxmark-build` skill.
- Premium responsive landing page with original SVG stress-chamber artwork, self-hosted Sora/Manrope fonts and licenses, three interactive illustrative scenario previews, keyboard controls, reduced-motion support, and an expandable local guide.
- Pinned React/TypeScript/Vite/Viem workspace with local/testnet configuration and real RPC connection check; RPC library loads on demand.
- pnpm 11.24.0 migration: imported lockfile preserves pinned package versions; scripts, doctor, CI and setup/deployment docs use pnpm. Only the three Foundry installation scripts are allowed, with exact-version release-age exceptions for the already-pinned Viem/Vite packages.
- Solidity price guard, owned mock fault inputs and contract regression/fuzz checks.
- Owned unsafe/guarded synthetic borrowing consumers with deposit/borrow/repay actions and per-account isolation.
- Local sandbox deployment script (guard, mocks, both consumers), test-network allowlist and ignored secrets/generated files.
- Project commands, readiness check and GitHub Actions check configuration.

## Verification

Foundation baseline observed on October 2, 2026, before the pnpm migration:

| Check | Result |
| --- | --- |
| Clean `npm ci` | Passed; locked dependencies installed; package audit reported zero known vulnerabilities |
| `npm run doctor` | Passed: Node, Git, project-local Forge/Cast/Anvil and context files available |
| `npm run check` | Passed: strict TypeScript, production web build, Solidity formatting, contract tests |
| Contract suite | 14 passing tests, including 256 fuzz runs; no failures/skips |
| Project skill validator | Passed with Skill Creator's validator; its PyYAML helper installed only in ignored `work/skill-validation` |
| `npm run deploy:local` | Passed on Anvil chain 31337; six successful transaction receipts checked |
| Deployed guard call | 100 raw tokens at $100 per token returned `10000000000000000000000` (USD18 = $10,000) |
| Browser smoke check | Starter rendered; **Check connection** confirmed local chain/block 3 and handled a stopped chain with a recovery message |
| Development refresh | App component separated from the mount entrypoint; refresh preserved UI state with no new browser errors |

The local deployment used owned mocks. Addresses/receipts live in ignored `contracts/broadcast/DeploySandbox.s.sol/31337/run-latest.json` and are transient local evidence, not public testnet addresses. The baseline test servers were stopped after verification; the landing-page preview is described below. Package audit results are not a contract audit. A configured workflow is not a completed remote CI run.

## Landing page and pnpm verification

October 2, 2026:

- Clean `pnpm install --frozen-lockfile` passed after moving the previous generated dependencies into ignored `work/pnpm-baseline`; no pinned direct dependency versions changed.
- `pnpm run doctor` passed with Node 24.21.0, pnpm 11.24.0 and all three project-local Foundry tools. `pnpm run check` passed: strict TypeScript, production build, Solidity formatting and 14 contract tests, including 256 fuzz runs.
- The three previews correctly switch between faulty and guarded expectations; selecting a different scenario resets the comparison to the seeded fault. Enter activates the native comparison buttons.
- Mobile/tablet/desktop checks at 320, 390, 768 and 1440 pixels; no horizontal overflow after correcting the illustration width at tablet size.
- The actual network check connected to local chain 31337 at block 0, showed a stopped-chain recovery message, and rejected a temporary chain-1337 endpoint. These were read-only checks, not scenario executions or deployment verification.
- Deferring the RPC library reduced the initial minified JavaScript from about 505 KB to 245 KB (76 KB gzip); the RPC chunk loads on request. Fonts are served locally with no external font requests.
- Scenario execution, wallets and exported reports remain unimplemented. Landing-page values and comparison diagrams are illustrative; no synthetic pass/fail badges, traction, customer claims or live exploit claims were added.
- The production build was browser-checked: all three fault/guard comparisons and the deferred RPC client worked, with no browser errors or warnings. Desktop/full-page captures are in ignored `work/landing-review/`.
- CI was migrated to pnpm's official setup action with a required frozen lockfile and the pinned Node version. Remote CI has not run.
- Local production preview is left running at `http://127.0.0.1:5175/`. The temporary Anvil verification process is stopped. Run `pnpm run dev` for automatic refresh during edits.

## Not yet implemented/provisioned

- Report exporter and complete end-to-end public demo (execution evidence is shown on screen; no downloadable JSON yet).
- Public testnet deployment, funded test wallet, hosting or remote repository.
- HackQuest registration/submission, legal eligibility review and confirmed prize wallet.
- Customer validation or domain/trademark clearance.

## Next concrete task

M5 in `BUILD_PLAN.md`: public testnet deployment and submission — dedicated test wallet, faucet funds, dry-run and broadcast the existing deployment script on the selected public testnet, confirm receipts/bytecode/ownership, publish the static site with `VITE_NETWORK` and `VITE_FACTORY_ADDRESS`, and verify each scenario from the published app with a fresh run. The user declined the GitHub plugin for this request. Use the authenticated GitHub CLI for authorized repository operations; plugin installation is not a pending setup task.

## Evidence export verification

October 2, 2026:

- `src/evidence.ts` builds a versioned (`cruxmark-evidence/1`) JSON report from observed execution state only: schema/scenario/run IDs, chain, contract addresses, adapter description, max-age/grace assumptions, decimal-string inputs/observations, confirmed transactions with hashes/blocks/receipt status, limitations and reproduction steps. The execution panel offers a download gated on complete observed state, and the report records only borrow amounts actually attempted in that run.
- Behavioral checks executed against the compiled module: a 30-digit integer roundtrips exactly through decimal strings, a fully confirmed report validates true, a pending/incomplete receipt validates false, and building with zero transactions throws. `pnpm run check` passed (strict TypeScript, production build, formatting, 31 contract tests).
- A rejected-signature or unconfirmed hash can never appear as a pass: only confirmed `success` receipts are recorded, and mined reverts on the expected-guarded borrow now surface as confirmed guard evidence. The report hash, if ever added, would be tamper evidence only, not attestation.

## Sequencer control per instance

October 2, 2026:

- `ScenarioInstance.setSequencerRound` lets the scenario owner drive downtime/recovery inputs without touching another run. Covered: sequencer-down blocks guarded borrowing (`SequencerUnavailable`) while the seeded unsafe consumer still permits it; restoring a pre-grace timestamp and advancing past the grace window reopens guarded borrowing. Non-owners are rejected. `pnpm run check` (31 tests) and `pnpm run deploy:local` both pass.

## Live split execution verification

October 2, 2026:

- The landing page now includes a live execution section (`src/ExecutionPanel.tsx` with `src/contracts.ts`/`src/wallet.ts`): connect test wallet → verify/switch to the selected chain → `ScenarioFactory.createScenario` → inject/clear the 2× split → deposit 100 synthetic tokens into both consumers → borrow $12k unsafe (expects success), $12k guarded (expects `BorrowExceedsCap` revert), $6k guarded (expects success) → repay → refresh reads. All badges/values derive from confirmed receipts and contract reads; rejected signatures, wrong network, reverts and RPC failures each have explicit states. No wallet library was added; native EIP-1193 via Viem is used.
- End-to-end flow verified on a fresh local Anvil run with cast-driven transactions against a user-owned instance: unsafe value `20000000000000000000000` ($20,000), guarded `10000000000000000000000` ($10,000); caps 12,000/6,000; unsafe 12k borrow confirmed, guarded 12k borrow reverted with `0x197f42e9` (`BorrowExceedsCap()`), guarded 6k borrow confirmed; both debts repaid to zero. The frontend uses the same ABIs/function names/arguments.
- Browser wallet signing was not exercised in this environment (no browser automation available); the UI's pending/rejected/wrong-network/reverted/RPC states are implemented but only the contract behavior underneath is verified. Set `VITE_FACTORY_ADDRESS` in `.env.local` to the deployed factory and restart the dev server to enable the panel; without it the section shows configuration instructions instead of claiming execution.
- Production build grew to ~408 KB minified (~127 KB gzip) because wallet execution imports Viem up front; the earlier 245 KB deferred-RPC optimization no longer applies once execution ships. `pnpm run check` result is recorded below.

## Isolated scenario factory verification

October 2, 2026:

- `ScenarioFactory`/`ScenarioInstance` give every wallet its own mocks, guard and consumers. `createScenario` records the caller as owner; only that owner can inject split/pause/price faults. Alice's multiplier-2 fault leaves Bob's sandbox at multiplier 1, and cross-owner mutation reverts.
- `pnpm run check` passed: strict TypeScript, production web build, Solidity formatting, 30 contract tests (14 guard + 12 consumer + 4 factory), including 256-run fuzz suites.
- `pnpm run deploy:local` passed on Anvil chain 31337; the sandbox now deploys the shared mocks/guard/consumers plus the factory (nine transactions) in ignored broadcast output. Addresses there remain transient local evidence.
- Frontend wallet execution against a user-owned instance is still unimplemented; landing-page comparisons remain illustrative.

## M1 split harness verification

October 2, 2026:

- `pnpm run check` passed: strict TypeScript, production web build, Solidity formatting, 26 contract tests (14 guard + 12 consumer), including 256-run fuzz suites for multiplier independence.
- Split behavior is now an explicit contract action: with multiplier 2 and a $100 per-token feed, 100 tokens value at $20,000 unsafe vs $10,000 guarded; 60% caps are $12,000 vs $6,000. A 12,000 borrow succeeds on the unsafe consumer and reverts with `BorrowExceedsCap` on the guarded consumer; a 6,000 borrow succeeds on the guarded consumer.
- Healthy multiplier-1 inputs succeed and repay cleanly in both consumers. Guarded borrowing rejects paused inputs while repayment stays callable; the unsafe consumer still permits the paused borrow, demonstrating the fault. Per-account collateral/debt isolation, 6-decimal scaling, unsupported-decimal rejection, zero-collateral and exact-cap boundaries, over-repay rejection, and invalid-configuration rejection are covered.
- `pnpm run deploy:local` passed on Anvil chain 31337; eight successful transactions (three mock deployments, two mock initializations, guard + unsafe + guarded deployments) in ignored `contracts/broadcast/DeploySandbox.s.sol/31337/run-latest.json`. Addresses there are transient local evidence, not public testnet addresses.
- Landing-page comparisons remain illustrative until the frontend wiring lands; no wallet, report export, public deployment, or submission state has changed.
