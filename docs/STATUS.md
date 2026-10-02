# Current status

Updated: October 2, 2026. Project location: `/Users/user64bit/Code/cruxmark`.

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

- Isolated public scenario creation (local sandbox still shares one mock set).
- Wallet signing and scenario execution in the web UI.
- Report exporter and complete end-to-end public demo.
- Public testnet deployment, funded test wallet, hosting or remote repository.
- HackQuest registration/submission, legal eligibility review and confirmed prize wallet.
- Customer validation or domain/trademark clearance.

## Next concrete task

M1 remainder in `BUILD_PLAN.md`: wire the completed unsafe/guarded split action into the frontend so the comparison reflects observed contract behavior, then continue to M2 wallet execution. The user declined the GitHub plugin for this request. Use the authenticated GitHub CLI for authorized repository operations; plugin installation is not a pending setup task.

## M1 split harness verification

October 2, 2026:

- `pnpm run check` passed: strict TypeScript, production web build, Solidity formatting, 26 contract tests (14 guard + 12 consumer), including 256-run fuzz suites for multiplier independence.
- Split behavior is now an explicit contract action: with multiplier 2 and a $100 per-token feed, 100 tokens value at $20,000 unsafe vs $10,000 guarded; 60% caps are $12,000 vs $6,000. A 12,000 borrow succeeds on the unsafe consumer and reverts with `BorrowExceedsCap` on the guarded consumer; a 6,000 borrow succeeds on the guarded consumer.
- Healthy multiplier-1 inputs succeed and repay cleanly in both consumers. Guarded borrowing rejects paused inputs while repayment stays callable; the unsafe consumer still permits the paused borrow, demonstrating the fault. Per-account collateral/debt isolation, 6-decimal scaling, unsupported-decimal rejection, zero-collateral and exact-cap boundaries, over-repay rejection, and invalid-configuration rejection are covered.
- `pnpm run deploy:local` passed on Anvil chain 31337; eight successful transactions (three mock deployments, two mock initializations, guard + unsafe + guarded deployments) in ignored `contracts/broadcast/DeploySandbox.s.sol/31337/run-latest.json`. Addresses there are transient local evidence, not public testnet addresses.
- Landing-page comparisons remain illustrative until the frontend wiring lands; no wallet, report export, public deployment, or submission state has changed.
