# Product brief

## The product

Cruxmark helps a protocol engineer answer: **Does our stock-token integration behave correctly when the token's economic terms or oracle availability change?**

The platform runs a defined suite against a supported integration surface, explains the observed failure, offers a correctly scoped price adapter, and produces reproducible evidence. The first buyer hypothesis is a small lending or vault team preparing to accept tokenized stock collateral. An audit team could use the suite as a regression aid. We have not interviewed or signed either customer group.

This direction replaces the earlier generic freelancer escrow idea. The user selected this scope after asking for a stronger, economically credible project. The working brand is **CRUXMARK**, pronounced **kruks-mark**, with **Stress-test tokenized finance** as its tagline. Domain/trademark clearance is still open.

## A concrete failure to show

A sandbox holds 100 stock tokens. The feed quotes $100 **per token**. Collateral is $10,000, and an illustrative 60% borrow limit allows $6,000.

After a two-for-one underlying share split, the underlying share price is $50 and the shares-per-token multiplier is 2. The token balance remains 100 and the adjusted per-token feed remains $100. Its economic collateral value stays $10,000.

A seeded faulty consumer multiplies the adjusted feed by 2 again. It reports $20,000 collateral and a $12,000 borrowing limit: $12,000 of debt against $10,000 of actual collateral. A correct adapter continues to value the position at $10,000.

This is our deliberately introduced integration error, not a discovered live vulnerability. The per-token feed behavior and static raw balances are grounded in the issuer's [stock-token integration guide](https://docs.robinhood.com/chain/building-with-stock-tokens/).

## The hackathon experience we intend to build

1. Choose **Cruxmark stock-collateral sandbox**, the first supported integration.
2. Connect a test wallet and create an isolated scenario instance.
3. Run **Stock split**. Show the original input, fault injection transaction, incorrect valuation, correct expected valuation, and observed impact.
4. Route valuation through the guarded adapter and rerun the same inputs.
5. Run **Unavailable price** and **Sequencer recovery**, showing rejected unsafe actions and the healthy path reopening.
6. Export a report with chain, contracts, configuration, source version, inputs, outcomes and transaction evidence.

One supported integration with honest coverage is the MVP. A future arbitrary contract import requires an adapter that identifies its real price-dependent entry points, expected behavior and state setup. A pasted address is not enough to prove compatibility.

## Scope

| Must ship | Why it matters |
| --- | --- |
| Owned unsafe/guarded demonstration harness | Makes the difference observable in real contract execution |
| Three deterministic scenario families | Defines specific supported coverage |
| Testnet deployment and usable web flow | Lets judges reproduce the result |
| Healthy controls and failed-action evidence | Distinguishes a useful guard from permanently disabled logic |
| JSON evidence export and readable explanation | Gives engineers something actionable and reproducible |
| Regression checks in CI | Shows value after the one-time demo |

Later, after the complete loop: one external integration adapter, real feed metadata reads, GitHub regression reporting, and additional corporate-action cases. Broader customer monitoring is a separate product expansion.

Out of scope now: arbitrary uploaded code execution, universal auditing, AI-generated pass/fail, insurance, liquidation coverage, real custody, mainnet deposits, market execution, production alerts, custom chains, bridges, a proprietary token, and a paid database. No mock token will be presented as official USDG.

## Competitive case and commercial hypotheses

Generic simulation, oracle monitoring and risk dashboards already exist; [Chaos Labs](https://chaoslabs.xyz/) is an established participant. Existing issuer and Chainlink documentation already teach oracle checks. Our proposed differentiator is an executable compatibility suite for stock-token semantics, with a visible faulty-to-correct integration and reproducible regression evidence. It must earn that distinction through implementation.

The suggested $2,000 integration assessment and $500/month regression plan are **unvalidated pricing hypotheses**. The actual question is whether teams will pay to avoid a costly integration mistake or save repeated engineering review. Validate with three relevant protocol engineers: what fails today, what checks they already run, what evidence they need, and whether they would trial the tool. Do not count prize money as product revenue or invent customer traction.

## Definition of a strong MVP

- A fresh user can understand and reproduce the split failure within a few minutes.
- The underlying Solidity behavior, not UI copy, determines results.
- The protected version handles healthy inputs and blocks the supported fault cases.
- Evidence can be independently inspected on the chosen testnet and tied to a source version.
- The demo explains both what was tested and what remains outside its coverage.
- There is a credible repeat-use story: the same integration checks run after a protocol code/configuration change.
