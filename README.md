# CRUXMARK

**Stress-test tokenized finance.**

Cruxmark is an executable compatibility lab for teams integrating tokenized stocks into lending, trading, or vault products. Reproduce a specific failure, apply a price guard, rerun the same scenario, and export the evidence. Our first target is Robinhood-style stock token semantics on an Arbitrum testnet.

This repository ships all three controlled scenario families through an owner-isolated contract sandbox, a browser-wallet execution lab, and versioned JSON evidence. Expected results on the landing page remain labeled illustrations; the execution lab captures actual block reads, actions and receipts. Public testnet deployment and hackathon submission are separate release steps.

## Start locally

Use Node 24 (`.nvmrc` pins the tested version) and pnpm 11.24.0 (`packageManager` pins it). From this directory:

```sh
pnpm install --frozen-lockfile
pnpm run doctor
pnpm run check
```

Then run these in separate terminals:

```sh
pnpm run chain
```

```sh
pnpm run dev
```

Open the address printed by the web server. The landing page previews the three supported scenario families; its fault/guard comparisons show expectations, not executed results. The **Check connection** button reads the actual configured chain and block. Deploy the contract sandbox while the local chain is running:

```sh
pnpm run deploy:local
```

Foundry's Forge, Cast, and Anvil are pinned project dependencies with explicitly allowed installation scripts in `pnpm-workspace.yaml`. No global Foundry install, Docker, paid API, account, or funded wallet is needed for the local loop. The first contract build downloads the pinned Solidity compiler. Do not expose Anvil outside localhost; its accounts are public test accounts.

`deploy:local` now verifies the factory and updates the public local settings in `.env.local`; restart the app afterward. Use `.env.example` for public network settings. All `VITE_*` settings are visible to browser users. Keep private keys out of environment files and use wallet signing or an encrypted Foundry keystore for public testnet transactions.

## Where to start reading

| File | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Persistent instructions for agents working in this repository |
| [Product brief](docs/PRODUCT.md) | Customer, problem, example, positioning, scope, acceptance criteria |
| [Architecture](docs/ARCHITECTURE.md) | Boundaries, interfaces, units, scenarios, evidence, security assumptions |
| [Build plan](docs/BUILD_PLAN.md) | Ordered milestones and checks; next concrete work |
| [Hackathon](docs/HACKATHON.md) | Verified dates, awards, requirements, gaps, official sources |
| [Submission checklist](docs/SUBMISSION.md) | Assets to collect and a concrete demo narrative |
| [Agent/tool setup](docs/AGENT_SETUP.md) | Relevant skills, plugin state, versions, workflow and $0 budget |
| [Release guide](docs/RELEASE.md) | Local bootstrap, public deployment verification and fresh-run demo checklist |
| [Current status](docs/STATUS.md) | What exists, what was checked, and what still needs doing |

## Commands

| Command | Outcome |
| --- | --- |
| `pnpm run dev` | Local web workspace |
| `pnpm run build` | Strict TypeScript check and static production build |
| `pnpm run check` | Web build, Solidity formatting check, contract tests |
| `pnpm run contracts:test` | Scenario, boundary, authorization, and fuzz checks |
| `pnpm run contracts:format` | Format Solidity source |
| `pnpm run execution:test` | Isolated real-EVM wallet/action/report regressions, no wallet secrets |
| `pnpm run doctor` | Local tool and project-context readiness |
| `pnpm run chain` | Local EVM, chain ID 31337 |
| `pnpm run deploy:local` | Deploy and verify the isolated local factory; configure the local app |
| `pnpm run deployment:verify --network <target>` | Verify live factory receipt/bytecode and write a source-linked manifest |

For public deployment set `VITE_FACTORY_ADDRESS` to the verified factory address and restart/rebuild the app. The web build verifies that factory’s runtime hash against its compiled source before allowing scenario actions. Recompile/redeploy after contract changes.

The default network is local. Planned public demo target: Robinhood Chain Testnet (46630). Arbitrum Sepolia (421614) is a fallback if faucet access blocks the demo. Public testnet deployment, site publication, and HackQuest registration/submission have not been performed by this setup. No remote Git repository is created automatically.

Cruxmark is a working project name; domain and trademark availability remain unverified. All security results must state their tested scope. Controlled fault demonstrations are not evidence of a vulnerability in Robinhood, Chainlink, or a third-party protocol.
