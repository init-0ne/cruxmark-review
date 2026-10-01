# Cruxmark project instructions

Read `README.md`, `docs/STATUS.md`, and `docs/BUILD_PLAN.md` when starting work. Read `docs/PRODUCT.md` before changing scope and `docs/ARCHITECTURE.md` before contract, integration, or report changes. Consult `docs/HACKATHON.md` and `docs/SUBMISSION.md` for event work. Keep these files current when decisions or verified status change.

## Product decisions

- Name: Cruxmark. Tagline: Stress-test tokenized finance.
- Build a compatibility stress lab for supported stock-token integrations. The first complete flow is choose integration → reproduce fault → apply guard → rerun → export evidence.
- Three first scenarios: multiplier double application; paused/stale price; sequencer outage/recovery grace.
- The $100 feed in our split example is **per token**, already adjusted. Never apply a shares-per-token multiplier again. Robinhood's raw underlying API quotes are a different input with different conversion rules.
- Mocks inject controlled faults in contracts we own. Label mocks, expected examples, live observations, and test results accurately. Derive pass/fail from executed behavior, never from prewritten UI values.
- No claim of a discovered live exploit, full audit, loss guarantee, official partnership, or customer willingness to pay. Pricing is a hypothesis.

## Budget and boundaries

- $0 additional development/demo spend. Use local EVM, faucet test assets, public/free RPCs, static free hosting, and bounded CI. Do not enable paid plans, API billing, mainnet writes, purchased tokens, or a custom domain without explicit user instruction.
- Keep wallet secrets out of source, shell history, tool output, browser configuration, logs, reports, and commits. Never collect a user's private key in the web app.
- Supported deployment chain IDs: 31337, 46630, 421614. Do not silently fall back to mainnet. Verify RPC chain ID, deployment receipts and bytecode before accepting an address.
- Confirm real feed/token addresses, network, ABI, decimals, and heartbeat from primary sources before live integrations. Our mock deployment does not verify production compatibility.
- Positive prices alone are insufficient. Validate timestamps, decimals, pause state and sequencer recovery. Price-dependent unsafe actions must fail closed; safe repayment must remain possible when the future lending harness is implemented.
- Keep mock mutations owner-controlled and isolate users' scenario state. Public evidence reveals addresses and inputs; do not place confidential integration code on-chain.

## Agent workflow and skill routing

Read `.agents/skills/cruxmark-build/SKILL.md` for Cruxmark implementation tasks, even if the runtime has not yet discovered its `$cruxmark-build` trigger. The repository skill routes to the detailed docs; it is not an autonomous background process.

Use relevant skills listed in `docs/AGENT_SETUP.md` on demand. Apply Ponytail for implementation; frontend-design for actual UI work; impeccable for requested design critique; browser skills before UI automation; plugin-management when an external integration is needed. No Solana, voice, image, document, or spreadsheet skills are required for the base product. Do not load or install the entire catalog.

Work in small complete increments. Reuse native HTML/CSS, installed dependencies and Node standard library before adding packages. No speculative queues, microservices, database, agent framework, universal scanner, or elaborate wallet stack. Do not modify global agent configuration or permissions to satisfy a project-local need.

Roles are responsibilities, not automatic subagent permission: product owner maintains scope; contract engineer maintains deterministic behavior and regressions; frontend engineer connects real states; reviewer checks units/trust boundaries; release owner maintains evidence and submission status. Use delegation only when the active user/runtime instructions authorize it. Scope each delegated file area and integrate before declaring success.

## Validation and handoff

- Run `npm run check` after implementation changes; narrower checks are fine for unrelated prose edits. Run `npm run doctor` after tool/config changes.
- Financial/security logic needs behavioral tests, including rejection cases and exact time/unit boundaries. Never remove checks to get a green build.
- Before marking a public scenario complete, verify success/revert outcomes, receipt status and contract state on the selected network. A transaction hash alone is not success.
- Review the diff and `git status` before committing. Never include secrets or generated build/broadcast files. No remote publication or submission is implied by local setup.
- Update `docs/STATUS.md` with the actual checks, limitations and next step. Do not report a task as complete because a mock screen looks finished.
- Reverify event deadlines and legal requirements at submission time. Age, team cap, IP/KYC and precise payout terms remain unverified.
