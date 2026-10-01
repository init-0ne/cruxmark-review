# CRUXMARK

**Stress-test tokenized finance.**

Cruxmark is an executable compatibility lab for teams integrating tokenized stocks into lending, trading, or vault products. Reproduce a specific failure, apply a price guard, rerun the same scenario, and export the evidence. Our first target is Robinhood-style stock token semantics on an Arbitrum testnet.

This repository currently contains the development foundation: a React workspace, testnet network configuration, a Solidity price guard, controlled mock inputs, contract regression tests, and a local deployment script. The complete platform is the next build; the starter page does not pretend to run scenarios or certify integrations.

## Start locally

Use Node 24 (`.nvmrc` pins the tested version). From this directory:

```sh
npm ci
npm run doctor
npm run check
```

Then run these in separate terminals:

```sh
npm run chain
```

```sh
npm run dev
```

Open the address printed by the web server. The **Check connection** button reads the actual configured chain and block. Deploy the contract sandbox while the local chain is running:

```sh
npm run deploy:local
```

Foundry's Forge, Cast, and Anvil are pinned project dependencies. No global Foundry install, Docker, paid API, account, or funded wallet is needed for the local loop. The first contract build downloads the pinned Solidity compiler. Do not expose Anvil outside localhost; its accounts are public test accounts.

Copy `.env.example` to `.env.local` only when changing the selected network. All `VITE_*` settings are visible to browser users. Keep private keys out of environment files and use wallet signing or an encrypted Foundry keystore for public testnet transactions.

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
| [Current status](docs/STATUS.md) | What exists, what was checked, and what still needs doing |

## Commands

| Command | Outcome |
| --- | --- |
| `npm run dev` | Local web workspace |
| `npm run build` | Strict TypeScript check and static production build |
| `npm run check` | Web build, Solidity formatting check, contract tests |
| `npm run contracts:test` | Scenario, boundary, authorization, and fuzz checks |
| `npm run contracts:format` | Format Solidity source |
| `npm run doctor` | Local tool and project-context readiness |
| `npm run chain` | Local EVM, chain ID 31337 |
| `npm run deploy:local` | Deploy our owned test sandbox to localhost |

The default network is local. Planned public demo target: Robinhood Chain Testnet (46630). Arbitrum Sepolia (421614) is a fallback if faucet access blocks the demo. Public testnet deployment, site publication, and HackQuest registration/submission have not been performed by this setup. No remote Git repository is created automatically.

Cruxmark is a working project name; domain and trademark availability remain unverified. All security results must state their tested scope. Controlled fault demonstrations are not evidence of a vulnerability in Robinhood, Chainlink, or a third-party protocol.
