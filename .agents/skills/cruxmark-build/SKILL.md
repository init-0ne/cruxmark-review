---
name: cruxmark-build
description: Build or review Cruxmark's stock-token stress scenarios, price guard, scenario UI, evidence export, or hackathon submission. Use inside the Cruxmark repository; this is not a general blockchain audit skill.
---

# Build Cruxmark

Locate the repository root from this skill's directory. Read its `AGENTS.md` and `docs/STATUS.md`; then use `docs/BUILD_PLAN.md` to select the next unfinished increment.

For scope/pitch work, read `docs/PRODUCT.md`. For contracts, scenario execution, or evidence, read `docs/ARCHITECTURE.md`. For event work, read `docs/HACKATHON.md` and `docs/SUBMISSION.md`. For tools/design/integrations, use `docs/AGENT_SETUP.md`.

Keep the first three scenarios executable and narrow. Distinguish our controlled fault inputs from real issuer feeds. Preserve these units: raw token balance has 18 decimals; feed decimals are queried; an adjusted per-token feed already includes the multiplier. Do not reuse underlying-share API prices without an explicit unit conversion.

Validate the price-dependent path against zero/negative/future/stale data, a paused token, sequencer downtime, an uninitialized recovery timestamp, and the exact grace-period boundary. Preserve safe repayment when a lending harness exists. Each public run needs isolated scenario state, an actual observed outcome and traceable configuration.

The evidence describes a scoped test against identified contracts and code. A report hash only detects changes to those bytes; it does not make the report a security certification or third-party attestation.

Use the existing project commands to validate changes. Keep the $0 additional spend constraint, testnet chain allowlist and wallet-secret boundaries. Update status with verified results and the next concrete task. Do not claim deployment or plugin connection from configuration alone.
