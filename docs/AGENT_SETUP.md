# Agent, skill and tool setup

## How project context is retained

`AGENTS.md` is the repository entrypoint. Product/event/technical decisions live in the linked docs. The project-local `.agents/skills/cruxmark-build/SKILL.md` adds a focused reusable workflow; a fresh Codex session opened on this repository can discover it, and `AGENTS.md` directs agents to read it if automatic discovery is unavailable. Do not assume a plugin or all previous chat messages are loaded just because the project contains instructions.

Use `STATUS.md` to resume verified work and `BUILD_PLAN.md` for priorities. Record a consequential new decision where it belongs and summarize it in status. Avoid multiple conflicting copies of the spec or a separate speculative “memory engine.”

The active workspace is `/Users/user64bit/Code/cruxmark`. Repository-local instructions apply here.

## Skill routing

These are useful capabilities available in the current machine's catalog. Read the skill only when it is relevant; the project does not require every skill to be preloaded. Absolute paths below are machine-local inventory, not runtime dependencies.

| Skill | When to apply | Location |
| --- | --- | --- |
| `cruxmark-build` | Product contracts, scenarios, reports, submission | `.agents/skills/cruxmark-build/SKILL.md` in this repo |
| `ponytail:ponytail` | Keep implementation minimal; preserve validation/security | Use the active runtime skill catalog; plugin cache versions change |
| `frontend-design` | Build the actual scenario UI with intentional visual choices | `/Users/user64bit/.agents/skills/frontend-design/SKILL.md` |
| `impeccable:impeccable` | Requested design critique/refinement | `/Users/user64bit/.codex/plugins/cache/impeccable/impeccable/4.4.0/skills/impeccable/SKILL.md` |
| `plugin-management:plugin-management` | Discover/verify an external integration | `/Users/user64bit/.codex/plugins/cache/openai-curated-remote/plugin-management/0.1.0/skills/plugin-management/SKILL.md` |
| `skill-creator` | Maintain the scoped project skill | `/Users/user64bit/.codex/skills/.system/skill-creator/SKILL.md` |
| `rote` / `rote-shell` | Reusable workflow/process evidence when that is actually needed; ordinary build/package loops can remain native | `/Users/user64bit/.agents/skills/rote/SKILL.md` and `rote-shell/SKILL.md` |
| Browser skills | Observe/test the UI through enabled browser tools; read the matching skill first | `/Users/user64bit/.agents/skills/synced/89f9e4b4-062e-489e-9d15-f5e0463488f6_790b4f39-e62c-4e65-ba92-9af335782fab/built-in-browser/SKILL.md` (or `chrome-browser`) |

No Solidity-specific skill was present in the current catalog. Solidity decisions therefore use the repository's domain skill, tested code and authoritative issuer/Chainlink/Foundry/Arbitrum documentation. Do not install a Solana skill for an EVM project or treat agent instructions as an audit tool.

The landing page uses a precision-instrument identity: navy `#091017`, panels `#101b26`, ice `#94ddf2`, text `#e9f1f5`, muted steel `#9aafbf`, and coral fault accent `#ed9a79`. Sora display and Manrope body fonts are self-hosted under the included SIL Open Font Licenses. The signature SVG stress chamber visualizes a per-token input, seeded multiplier fault, and guarded value. Three interactive previews compare expected faulty/guarded behavior; they never claim executed passes. Use native CSS, responsive layouts, keyboard focus and reduced-motion support. No UI framework or animation dependency is needed.

## Verified tool and plugin state at setup

| Capability | State |
| --- | --- |
| Node / pnpm / Git | Node 24.21.0, pnpm 11.24.0, Git 2.54.0; project package manager pinned in `package.json` |
| Forge / Cast / Anvil | Installed locally through official `@foundry-rs/*` npm packages, version 1.7.1; installation scripts explicitly allowed; commands run inside pnpm scripts |
| Frontend | React 19.3.0, Viem 2.57.2, Vite 8.3.2, TypeScript 7.0.2; exact versions and integrity hashes in lockfile |
| GitHub CLI | Installed and authenticated; active account `0xuser64bit` checked at setup |
| GitHub plugin | **Not installed/connected; declined by the user for this request.** Use the authenticated CLI; do not suggest this plugin again |
| Ponytail / Impeccable | Skills exposed by installed bundles; paths available. They need no chain account |
| Native web / Codex file tools | Available in the session; used for official research and artifacts |
| Browser automation | Tools/skills available; choose enabled surface when UI verification is needed |
| Sites | Tools/skills available but unused; no Sites publication or billing state assumed |
| Wallet, faucet funds, hosting account | Not provisioned or connected by local setup |

Other available skills include voice/media, documents/spreadsheets, 3D, Solana and work pets. None is required by this platform. Leave them available for a relevant request instead of adding dependencies or API keys. No global model, permissions or MCP configuration was changed. There is no hidden background agent or always-on service.

## Operating loop

1. Read the project entrypoint/status and select a concrete unfinished milestone.
2. Inspect the affected source/callers and relevant domain docs.
3. Implement the smallest complete result; preserve correctness, explicit states and scope labels.
4. Run the appropriate checks (`pnpm run check` for code, `doctor` for setup).
5. For a scenario/deployment claim, inspect actual state and receipts at the right chain/block.
6. Review the diff; update status with observed results and the next step.

A contract, frontend and reviewer role can be handled sequentially by one agent. Parallel agents are optional and require active instructions authorizing them; this file does not grant new external permissions or automatic delegation. Never hand off secrets. Never send messages to outside people without authorization.

## $0 additional spend plan

| Need | Chosen approach | Limit/remaining action |
| --- | --- | --- |
| Development/testing | Existing computer; local pinned open-source tooling | First install needs network access/disk, no paid service |
| Public gas | Testnet ETH from an official faucet | Faucet eligibility/rate limits may block; funds not yet acquired |
| Chain reads | Official public RPCs | Best effort and rate-limited; show failures honestly |
| Web hosting | Static Cloudflare Pages free plan/subdomain | Account and publication remain to be done |
| Regression CI | Standard GitHub-hosted runner, bounded job | Workflow configured locally; remote run not yet performed |
| Storage/reports | Downloadable JSON and explorer evidence | No permanent storage service guarantee |
| AI use | No AI API required in the product | Existing Codex plan is separate from incremental app infrastructure cost |

Standard GitHub runners are free for public repositories. Private-repository included quotas depend on the account plan; limit workflows and do not enable additional paid usage. [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

No always-on compilation server, enterprise uptime, production liquidity, custom domain or mainnet deployment is included in the $0 promise. Do not present free tiers as unlimited infrastructure.

## Public testnet deployment procedure

The Robinhood Chain Testnet factory and all three public scenarios are deployed and verified; use `RELEASE.md` for the current release procedure. Local deployment creates only the factory and verifies/configures it automatically. Use a dedicated test wallet, acquire faucet ETH and verify the selected network. Robinhood Chain Testnet is 46630, RPC `https://rpc.testnet.chain.robinhood.com`, explorer `https://explorer.testnet.chain.robinhood.com`. Arbitrum Sepolia is 421614, RPC `https://sepolia-rollup.arbitrum.io/rpc`, explorer `https://sepolia.arbiscan.io`. [Robinhood configuration](https://docs.robinhood.com/chain/connecting/), [Arbitrum configuration](https://docs.arbitrum.io/for-devs/dev-tools-and-resources/chain-info)

An official Robinhood testnet faucet is at [faucet.testnet.chain.robinhood.com](https://faucet.testnet.chain.robinhood.com). Availability/account eligibility is not confirmed. For Sepolia faucet choices consult the current Arbitrum chain page; do not buy test funds or bridge mainnet money for this demo.

For CLI signing, the user can import a dedicated test account into an encrypted keystore interactively:

```sh
pnpm exec cast wallet import cruxmark-testnet --interactive
```

The import prompts are for the user to complete privately; never paste the key into chat, source or a command argument. Set `CRUXMARK_TEST_WALLET` to the actual public address in your terminal. Dry-run with that keystore:

```sh
pnpm exec forge script contracts/script/DeploySandbox.s.sol:DeploySandbox --root contracts --rpc-url https://rpc.testnet.chain.robinhood.com --account cruxmark-testnet --sender "$CRUXMARK_TEST_WALLET"
```

After confirming chain, simulation, funds and intended mock deployment, the same command with `--broadcast` executes the deployment. Wallet/password authorization remains with the user. Sepolia uses its own RPC; never substitute a mainnet URL. Browser wallet signing is preferable once the scenario creation UI exists.

Record the resulting addresses/labels, source commit, owner, chain ID, transaction hashes, successful receipts, block numbers and bytecode. Do not copy the setup's local Anvil addresses into public configuration. Explorer source verification requires the actual compiler/settings; use the explorer's current supported verification method. A configured explorer link does not mean verification succeeded.

Set `.env.local` to `VITE_NETWORK=robinhood-testnet` (or `arbitrum-sepolia`) and restart the dev server. The UI now verifies factory runtime bytecode and executes wallet-owned scenarios. Use `pnpm run deployment:verify --network <target>` for live receipt/bytecode/source evidence; addresses alone do not complete the platform. See `RELEASE.md` for the current release procedure.

Free static hosting: use Node 24, install `pnpm install --frozen-lockfile`, build `pnpm run build`, publish `dist`, and set the public `VITE_NETWORK` before building. No runtime private key, paid backend, Cloudflare Worker or custom domain is required. Confirm the account is on the free plan before publication.

## Primary references

- [Arbitrum chain configuration](https://docs.arbitrum.io/for-devs/dev-tools-and-resources/chain-info)
- [Robinhood Chain configuration](https://docs.robinhood.com/chain/connecting/)
- [Stock-token integration guide](https://docs.robinhood.com/chain/building-with-stock-tokens/)
- [Oracle guide](https://docs.robinhood.com/chain/oracles-and-price-feeds/)
- [Stock-token HTTP API semantics](https://docs.robinhood.com/chain/stock-token-apis/)
- [Chainlink L2 sequencer checks](https://docs.chain.link/data-feeds/l2-sequencer-feeds)
- [Foundry installation](https://getfoundry.sh/introduction/installation/)
- [Official Foundry repository/npm distribution](https://github.com/foundry-rs/foundry/tree/master/npm)
- [Vite](https://vite.dev/guide/), [Viem](https://viem.sh/docs/getting-started)

Reverify changing network/SDK/feed details before relying on them. Installing a package or reading documentation does not establish a production security review.
