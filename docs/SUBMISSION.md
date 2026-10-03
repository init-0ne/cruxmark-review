# Submission and demo checklist

This is a working preparation checklist. The user confirmed registration on October 3; Cruxmark has not been submitted. Use `HACKATHON.md` for official facts and outstanding rule checks.

The [submission copy](SUBMISSION_COPY.md) contains the verified project description, demo URL, network, factory address, code history and scope language ready for the signed-in form. Its public-run and source-access lines remain explicitly pending.

## Account and eligibility

- [x] Confirm HackQuest registration before its registration cutoff (user confirmed October 3).
- [ ] Review accessible event terms and confirm participant/team eligibility.
- [ ] Confirm team membership and the exact signed-in submission fields.
- [ ] Supply the user's actual Arbitrum One prize wallet; never generate or guess one for them.

## Product and code

- [ ] Complete and verify the first scenario on an allowed public testnet.
- [ ] Give every deployed contract a network, address, purpose and mock/live label.
- [ ] Record owner, transaction receipts, deployed bytecode, compiler and source commit.
- [x] Publish a usable [demo URL](https://0xuser64bit.github.io/cruxmark-demo/) on free GitHub Pages; the hosted page loaded and read chain 46630 on October 4.
- [ ] Provide source or actual reviewer access; confirm invitations were accepted if using a private repository.
- [ ] Explain code written during the event using the actual commit history.
- [ ] Fill factory/pool/token entries accurately, using N/A when the current implementation has none.
- [ ] Select sponsor technology only when actually used. No fabricated USDG or issuer partnership.
- [ ] Attach or retain a scoped evidence report, its reproduction instructions and the output of `pnpm run report:verify` against the public RPC.
- [ ] Run the full checks and review outstanding limitations before freezing the demo.

## Recommended demo narrative

The following is our proposed presentation, not a verified required video length:

1. **Problem:** “A per-token oracle already includes corporate-action adjustments. Apply the multiplier twice and a protocol invents collateral.”
2. **Reproduction:** connect a test wallet; open an owned sandbox; run the stock-split fault. Display the concrete $10k/$20k valuation difference and the $6k/$12k synthetic borrow caps.
3. **Fix:** select the guarded consumer, rerun identical inputs and show the correct value/action outcome.
4. **Coverage:** show paused/stale-price and recovery-grace results only if those web flows actually ship. Show healthy controls reopening and safe debt reduction remaining available.
5. **Evidence:** download the run report and open the corresponding explorer transactions.
6. **Product:** explain the protocol-engineer buyer and regression use after integration changes; label traction/pricing as hypotheses where still unvalidated.

Clearly state that fault inputs and the unsafe integration are deliberately constructed in our sandbox. Do not describe this as a Robinhood exploit, official audit or proof that a third-party protocol is unsafe.

## Final delivery

- [ ] Test the public demo with a fresh wallet and normal browser session.
- [ ] Make the site's wrong-network, faucet, pending, rejected-signature and RPC failure states understandable.
- [ ] Ensure large token amounts and timestamps in reports are exact.
- [ ] Save a short backup recording and evidence files for unreliable public RPCs.
- [ ] Submit with buffer before October 4, 21:29 IST (23:59 SGT), after rechecking the event.
- [ ] Capture submission confirmation and save the submitted source version.

Registration is user-confirmed. The public factory deployment and hosted static demo are verified. A public scenario run, source/reviewer access, eligibility and submission remain open; `STATUS.md` records verified progress.

## Locally verified technical readiness

All three families, healthy controls, blocked-price repayment, owner isolation, exact report amounts and live receipt/bytecode verification have runnable local checks. The full check includes 41 contract tests and 41 real local actions covering 15 report checks. Follow `RELEASE.md` to capture equivalent public evidence. The source repository is private and the public demo repository contains only static build assets. Verify required CI against the exact release commit before submission.
