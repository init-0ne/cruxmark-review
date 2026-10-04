# CRUXMARK

**Stress-test tokenized finance.**

[![Check](https://github.com/init-0ne/cruxmark-review/actions/workflows/check.yml/badge.svg)](https://github.com/init-0ne/cruxmark-review/actions/workflows/check.yml)

**[Live demo](https://cruxmark.vercel.app/)** (Robinhood Chain Testnet, chain 46630) · [Complete public evidence](public/evidence/robinhood-testnet-complete.json) · [Factory on the explorer](https://explorer.testnet.chain.robinhood.com/address/0xabf626f8a3f98e8046d2a85973a36b5a06c0d3fb) · [Fallback demo](https://0xuser64bit.github.io/cruxmark-demo/)

Cruxmark is an executable compatibility lab for teams integrating tokenized stocks into lending, trading or vault products. You pick a fault, reproduce it against contracts you own, switch to a guarded integration, rerun the same inputs and export receipt-backed evidence that anyone can check against the chain.

## The problem

Stock tokens carry semantics that ordinary ERC-20 integrations miss. Three common examples:

- **Corporate actions.** Take a $100 **per-token** feed that already includes a 2-for-1 split. If an integration multiplies it by the token's new shares-per-token factor *again*, 100 tokens look worth $20,000 instead of $10,000, and a 60% borrow cap rises from $6,000 to $12,000.
- **Unusable prices.** A paused token or a stale round can still return a positive answer.
- **Sequencer recovery.** Right after an L2 sequencer comes back, prices need a grace window before they can be trusted.

Unit tests written against happy-path mocks rarely exercise these cases. Cruxmark runs each one as real transactions and records exactly what happened.

## Verified on Robinhood Chain Testnet

| What | Where | Verified |
| --- | --- | --- |
| `ScenarioFactory` | [`0xabf626f8a3f98e8046d2a85973a36b5a06c0d3fb`](https://explorer.testnet.chain.robinhood.com/address/0xabf626f8a3f98e8046d2a85973a36b5a06c0d3fb) | Creation receipt, input and exact runtime bytecode against this source ([manifest](docs/deployments/robinhood-testnet.json)); source fully verified on the explorer |
| Complete suite run | [`0xd2CF…8ACE`](https://explorer.testnet.chain.robinhood.com/address/0xd2CF058b3ac9840Bf88F09B25d3f71E1fF628ACE) | 29 transactions, **15/15 checks**; `report:verify --state` matched every receipt, calldata, block hash, event and 59 historical state snapshots ([report](public/evidence/robinhood-testnet-complete.json)) |
| Hosted-browser split run | In the [report](public/evidence/robinhood-testnet-browser-split.json) | Exported from the published web app; 6 transactions, 4/4 split checks, 13 state snapshots re-verified |

The factory and all seven contracts of the complete run (instance, price and sequencer feeds, token status, guard, unsafe and guarded consumers) are fully verified on the [Robinhood Chain Testnet explorer](https://explorer.testnet.chain.robinhood.com/address/0xd2CF058b3ac9840Bf88F09B25d3f71E1fF628ACE), so you can read their source and live state there. Each run deploys its own mock inputs and consumers, owned by the wallet that created it, so public users never share fault state. The complete run was signed by a test wallet; the browser split run used an ephemeral EIP-1193 provider in headless Chrome.

## Try it

1. Open the [live demo](https://cruxmark.vercel.app/) with a browser wallet holding Robinhood Chain Testnet test ETH ([faucet](https://faucet.testnet.chain.robinhood.com)). The app offers to add or switch to chain 46630.
2. In the execution lab, choose **Stock split**, connect and create an isolated run.
3. Follow the **NEXT** button: prepare both positions, seed the split, borrow $12k through the unsafe consumer, watch the guarded consumer reject the same borrow, borrow the correct $6k and repay.
4. Repeat with paused price, stale price, sequencer down and recovery grace to cover all 15 checks.
5. Click **Download evidence JSON** before refreshing or switching runs.

If you have no wallet handy, download the [reference evidence](public/evidence/robinhood-testnet-complete.json) from the lab and verify it yourself.

## Verify the evidence yourself

```sh
pnpm install --frozen-lockfile
pnpm run report:verify public/evidence/robinhood-testnet-complete.json
```

The verifier re-reads every transaction from the chain's public RPC: receipts, calldata, senders, block hashes and timestamps, events, factory bytecode and run ownership. With `--state` it also replays the recorded contract reads and reverts at their historical blocks. Public RPCs prune history (about 15 minutes on Robinhood Chain Testnet when measured), so for older reports omit `--state` or pass an archive endpoint with `--rpc-url`.

## How it works

```text
ScenarioFactory ── createScenario() ──▶ ScenarioInstance (owned by the caller)
                                          ├─ MockFeed price (8 decimals)         ┐ owner-only
                                          ├─ MockFeed sequencer status           │ fault inputs
                                          ├─ MockStockStatus (pause, multiplier) ┘
                                          ├─ PriceGuard: units, pause, freshness (300 s), sequencer grace (3,600 s)
                                          ├─ UnsafeStockConsumer: multiplier applied twice, no availability checks
                                          └─ GuardedStockConsumer: values collateral through PriceGuard once
```

- **Contracts** ([`contracts/src`](contracts/src)): Solidity 0.8.30 compiled for `paris`, so the bytecode contains no PUSH0. Constructors reject chains other than 31337, 46630 and 421614. Price-dependent borrowing fails closed, while deposits and repayment never read a price, so debt can always be repaid. Balances are synthetic and no tokens move.
- **Web app** ([`src`](src)): a static React 19 and viem app with no backend. It talks to your browser wallet over EIP-1193 and refuses to act unless the factory's on-chain runtime bytecode hash matches the source it was built from. A check passes only after its receipt and contract state are observed; a transaction hash alone never counts.
- **Evidence** ([`src/evidence.ts`](src/evidence.ts)): `cruxmark-evidence/2` JSON with exact integer inputs, source revision and compiler settings, contract addresses and roles, block-pinned snapshots, calldata and receipts. Partial runs stay labeled partial.
- **Independent checks** ([`scripts`](scripts)): `verify-deployment.mjs` checks a factory deployment and `verify-report.mjs` checks a downloaded report, both straight from chain data.

### The 15 checks

| Family | Checks |
| --- | --- |
| Stock split | Correct $10k/$20k valuation and $6k/$12k caps · unsafe $12k borrow confirmed · guarded $12k borrow rejected · guarded $6k control confirmed |
| Unavailable price | Paused and stale prices: unsafe $1k borrow confirmed and guarded $1k borrow rejected for each · guarded debt repaid while blocked |
| Sequencer | Down and inside recovery grace: unsafe $1k borrow confirmed and guarded $1k borrow rejected for each · guarded debt repaid while blocked |
| Healthy control | Guarded $1k borrow confirmed with healthy inputs |

## Run locally

Use Node 24 (`.nvmrc`) and pnpm 11.24.0 (`packageManager`). Foundry's Forge, Cast and Anvil are pinned project dependencies, so no global install, Docker, paid API or funded wallet is needed.

```sh
pnpm install --frozen-lockfile
pnpm run doctor
pnpm run check
```

Start the local chain in its own terminal, then deploy and start the app:

```sh
pnpm run chain
pnpm run deploy:local
pnpm run dev
```

Open the printed address and choose **Use local test account**. This option exists only on loopback hosts against a local chain and uses a disposable unlocked Anvil account. Browser test wallets work too. `deploy:local` verifies the factory and writes the public local settings to the ignored `.env.local`; restart the app after redeploying. All `VITE_*` settings are visible to browser users, so never put a key in them.

To build for a public network, set `VITE_NETWORK` (`robinhood-testnet` or `arbitrum-sepolia`), `VITE_FACTORY_ADDRESS` and optionally `VITE_RPC_URL` explicitly. Otherwise the build picks up the local values in `.env.local`. [docs/RELEASE.md](docs/RELEASE.md) has the exact release commands.

## Commands

| Command | Outcome |
| --- | --- |
| `pnpm run dev` | Local web workspace |
| `pnpm run build` | Contract build, strict TypeScript check and static production build |
| `pnpm run check` | Build, Solidity formatting, 41 contract tests and 41 real-EVM actions covering all 15 checks |
| `pnpm run contracts:test` | Scenario, boundary, authorization and fuzz tests |
| `pnpm run execution:test` | Isolated real-EVM wallet, action and report regressions with two independent owners |
| `pnpm run ui:test` | Real-browser regressions (needs Chrome): split flow, wallet signing and rejection, network switch, transaction recovery, on-chain report verification. `UI_FULL=1` runs all 15 checks |
| `pnpm run doctor` | Local tool and project readiness |
| `pnpm run chain` | Local EVM on chain 31337 |
| `pnpm run deploy:local` | Deploy and verify the local factory; configure the local app |
| `pnpm run deployment:verify --network <target>` | Verify a live factory receipt and bytecode and write a source-linked manifest |
| `pnpm run report:verify <report.json> [--rpc-url <url>] [--state]` | Re-check an evidence file against its chain |

## Repository map

| File | Purpose |
| --- | --- |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Customer, problem, positioning, scope and acceptance criteria |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Boundaries, interfaces, units, scenarios, evidence and security assumptions |
| [docs/RELEASE.md](docs/RELEASE.md) | Local review, public deployment verification and demo sequence |
| [docs/STATUS.md](docs/STATUS.md) | What exists, what was checked and what remains |
| [docs/deployments/robinhood-testnet.json](docs/deployments/robinhood-testnet.json) | Verified factory address, creation receipt, bytecode hash and source revision |
| [docs/HACKATHON.md](docs/HACKATHON.md) · [docs/SUBMISSION.md](docs/SUBMISSION.md) | Event context and submission checklist |
| [AGENTS.md](AGENTS.md) · [docs/AGENT_SETUP.md](docs/AGENT_SETUP.md) | Instructions and tooling for coding agents working in this repository |

## Scope and limits

Cruxmark was built during the Arbitrum Open House Singapore Online Buildathon (repository started October 2, 2026). Every fault is injected into mock contracts we deploy and own. Nothing here touches a live Robinhood stock token, a production oracle or a third-party protocol, and nothing holds real assets. A controlled fault demonstration is not evidence of a vulnerability in Robinhood, Chainlink or any other protocol. Cruxmark is not an audit or a security guarantee, and every result applies only to its tested scope. Pricing and customer demand are hypotheses that have not been validated. Cruxmark is a working project name; domain and trademark availability have not been checked.
