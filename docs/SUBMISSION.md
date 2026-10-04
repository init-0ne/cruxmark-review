# Submission and demo checklist

This is a working preparation checklist. The user confirmed registration on October 3; Cruxmark has not been submitted. Use `HACKATHON.md` for official facts and outstanding rule checks.

The [submission copy](SUBMISSION_COPY.md) contains the verified project description, demo URL, public-run evidence, network, factory address, code history and scope language ready for the signed-in form. The private source invitation is pending acceptance.

## Account and eligibility

- [x] Confirm HackQuest registration before its registration cutoff (user confirmed October 3).
- [ ] Review accessible event terms and confirm participant/team eligibility.
- [ ] Confirm team membership and the exact signed-in submission fields.
- [ ] Supply the user's actual Arbitrum One prize wallet; never generate or guess one for them.

## Product and code

- [x] Complete and independently verify all 15 scenario checks on eligible Robinhood Chain Testnet; separately verify 4/4 split checks from the hosted browser.
- [x] Record each public-run contract's network, address, role and controlled-mock scope in the evidence reports.
- [x] Record owner, transaction receipts, deployed bytecode, compiler and source commit in the reports and factory manifest.
- [x] Publish a usable [demo URL](https://0xuser64bit.github.io/cruxmark-demo/) on free GitHub Pages; the hosted page loaded and read chain 46630 on October 4.
- [ ] Confirm `engineering-AF` accepted read permission to the [private judging mirror](https://github.com/init-0ne/cruxmark-review); invitation `336001549` is pending.
- [x] Prepare event-period code history for the submission form.
- [x] Prepare accurate factory/pool/token entries, with N/A for pool and token.
- [x] Prepare sponsor technology wording: Robinhood Chain Testnet only; no fabricated USDG or issuer partnership.
- [x] Retain the [complete report](../public/evidence/robinhood-testnet-complete.json), [hosted-browser split report](../public/evidence/robinhood-testnet-browser-split.json), reproduction instructions and successful independent RPC verification, including state at verification time.
- [x] Run `pnpm run check`, `UI_FULL=1 pnpm run ui:test` and `pnpm run doctor`; review the remaining scope limits in `STATUS.md`.

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
- [x] Verify exact integer amounts and timestamps in local regressions and independently checked public reports.
- [x] Save both public evidence files for unreliable public RPCs. A short backup recording remains optional unless the signed-in form requires one.
- [ ] Submit with buffer before October 4, 21:29 IST (23:59 SGT), after rechecking the event.
- [ ] Capture submission confirmation and save the submitted source version.

Registration is user-confirmed. The public factory, hosted demo, complete public suite and hosted-browser split are verified. Reviewer acceptance, eligibility and submission remain open; `STATUS.md` records verified progress.

## Locally verified technical readiness

All three families, healthy controls, blocked-price repayment, owner isolation, exact report amounts and live receipt/bytecode verification have runnable local checks. The full check includes 41 contract tests and 41 real local actions covering 15 report checks. Equivalent public-chain evidence is linked above, including a browser-produced split report. Both full-history source repositories remain private; the public demo repository contains only static build assets and the reference JSON. Verify required CI against the exact release commit before submission.
