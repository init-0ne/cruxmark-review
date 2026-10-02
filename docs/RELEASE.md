# Release a reproducible Cruxmark demo

The supported release is a static wallet lab and a factory for owned synthetic scenarios. It is not a production lending system. This checklist never authorizes mainnet writes, paid services, or handling private keys in source/chat/output.

## Local review

1. Use Node 24 and the pinned pnpm version. Run `pnpm install --frozen-lockfile`, `pnpm run doctor`, and `pnpm run check`.
2. Start `pnpm run chain` in its own terminal. Anvil is loopback-only and quiet; its unlocked accounts are public disposable test accounts.
3. Run `pnpm run deploy:local`. This deploys one factory, verifies the RPC chain, live successful creation receipt, creation calldata and exact runtime bytecode at the deployment block/current block. It writes `work/deployment/local.json` and updates only the three public network/factory settings in ignored `.env.local`.
4. Run `pnpm run dev`. Redeploy after contract changes or local-chain restarts. Do not reuse old local report hashes after restarting Anvil.
5. Open the loopback app and choose **Use local test account**, or connect a browser test wallet on chain 31337. The local option uses a disposable unlocked Anvil account, requires loopback app/RPC addresses and is unavailable on public sites/chains. The app never asks for a private key. Create a run and prepare 100 tokens in each consumer. Use the flow below.

`pnpm run ui:test` drives the real web app in headless Chrome against its own ephemeral chain: the split flow end to end, a refused action's wording, a vanished or unrecoverable saved transaction and its discard, and that a public-network build never offers the local test account. It also verifies the report the browser produced against the chain. It needs Chrome (`CHROME_PATH`) and is not part of `pnpm run check`. `UI_FULL=1 pnpm run ui:test` adds a scenario that follows the lab's own NEXT line through all three families until all 15 checks verify, then verifies the complete report on-chain.

`pnpm run execution:test` uses a separate ephemeral chain, two independent owners and the same execution module as the web app. It saves a complete local JSON report under ignored `work/verification/` and shuts its chain down. This independently runnable check does not establish normal browser-wallet signing or a public deployment.

## Public testnet release

- Obtain the user's dedicated test-wallet public address, signing access and free faucet ETH. Do not collect or print a private key/password. Keep keystore import/signing prompts private and interactive.
- Check registration, participant/team eligibility and the signed-in HackQuest form. A legal acceptance or prize-wallet decision belongs to the user; do not guess it.
- Choose Robinhood Chain Testnet (46630) or Arbitrum Sepolia (421614). Prefer Robinhood. Measured October 2, 2026 with snapshot-shaped load (16 reads per round, ~50 requests per second): the Robinhood public RPC served all 480 requests without a failure, while the Arbitrum Sepolia public RPC answered HTTP 429 for 8 of 30 rounds. A controlled ABBA experiment with a quiet minute before each phase throttled 12/20 and 16/20 rounds sent as separate requests and 16/20 and 13/20 sent as one JSON-RPC batch, so that limiter counts calls and batching does not help. On Arbitrum Sepolia expect occasional "rate-limiting" notices (wait a few seconds and retry), or set `VITE_RPC_URL` to a different free endpoint after checking it. If this ever matters on the primary chain, the lever is fewer calls per snapshot: an on-chain view that returns the whole snapshot would cut about 17 reads to 1-2. It was not built because the primary chain showed no throttling. Official public RPCs are in `src/chains.ts`. Read the actual RPC chain ID before broadcasting; no mainnet fallback exists.
- Commit/review the release, then run the full checks from the clean source revision. The factory and instance constructors reject unsupported chains.
- Dry-run the deployment using an encrypted keystore imported by the user. Example for Robinhood testnet:

```sh
pnpm exec forge script contracts/script/DeploySandbox.s.sol:DeploySandbox --root contracts --rpc-url https://rpc.testnet.chain.robinhood.com --account cruxmark-testnet --sender "$CRUXMARK_TEST_WALLET"
```

A dry run only simulates; nothing is signed or sent, so any public address works as `--sender`. Dry runs on October 2, 2026 against both official public RPCs succeeded. They estimated 3.88M gas for the factory on Robinhood Chain Testnet at 0.02 gwei (about 0.000078 ETH) and 4.11M gas on Arbitrum Sepolia at 0.083 gwei (about 0.00034 ETH). Each `createScenario()` run costs about 2.6M gas. These are simulation estimates, not charges, and gas prices move, but a small faucet drip covers the whole demo. The RPCs reported chain IDs 0xb626 (46630) and 0x66eee (421614) as documented. The largest contract, the factory, is 13.6 KB against the 24.6 KB limit.

Forge prints `EIP-3855 is not supported ... 46630 ... might not work properly` for the Robinhood testnet. That warning is expected and does not apply to this build: `contracts/foundry.toml` compiles for `evm_version = "paris"`, which never emits PUSH0. `pnpm run execution:test` proves it by running every action on an Anvil pinned to `--hardfork paris`, where PUSH0 is rejected (`NotActivated`); compiling for Shanghai makes that check fail. Do not raise the EVM target without re-verifying the chain.

After the user can sign and the dry-run/faucet balance are verified, run that command with `--broadcast`. `CRUXMARK_TEST_WALLET` is a public address only. Never pass a private key in an argument or environment file.

Verify the actual public result:

```sh
pnpm run deployment:verify --network robinhood-testnet
```

The verifier requires a clean source revision for public evidence and reads the broadcast file for the selected network. It verifies the receipt, block hash, creation input, source compiler/settings and exact current/historical runtime bytecode. It writes `work/deployment/robinhood-testnet.json`. For Sepolia use `--network arbitrum-sepolia`; for a different broadcast file use `--broadcast <path>`. No RPC URL/credentials are stored in the manifest.

Retain a reviewed copy of the public manifest for submission. Explorer source verification is a separate action with the exact compiler/settings and source; the manifest does not assert explorer verification.

Set the public build environment to the selected `VITE_NETWORK` and verified `VITE_FACTORY_ADDRESS`. `.env.local` can override a shell choice locally; inspect/update only these public settings before building. The browser checks compiled factory bytecode before any scenario action. A changed contract requires a matching redeployment/build; a copied address is insufficient.

Use free Cloudflare Pages static hosting: Node 24, pinned pnpm, `pnpm install --frozen-lockfile`, `pnpm run build`, output `dist`. Set public network/factory values in that build environment. Confirm free-plan/account access; no backend, worker, domain or private key belongs in the deployment. Add `public/_headers` to the output for the security headers included here.

Keep the source private unless the user authorizes publication; the existing GitHub repository is private. Reviewer access/invitations, a remote push and public hosting are separate actions. Check CI for the exact release hash after authorized publication; the earlier green CI run does not cover these local changes.

## Observed demo sequence

The lab’s NEXT line names the same sequence from the checks recorded in this browser session. Follow it, or use the order below.

A seeded healthy price expires after the sandbox max age (300 chain-seconds), and public testnet blocks arrive continuously, so chain time keeps moving while you talk. If a healthy-control borrow is rejected as unavailable, seed healthy again and borrow promptly; the lab's Input evidence shows the price age the guard compares against that limit.

For the split: prepare both positions → seed Stock split → borrow $12k unsafe → test $12k guarded rejection → borrow $6k guarded control → repay. The four split coverage rows should verify from those actual actions.

For unavailable price: restore healthy → borrow $1k guarded to seed repayable debt → seed Paused price → borrow $1k unsafe → test guarded rejection → repay while blocked. Repeat for Stale price, restoring healthy before seeding guarded debt again. Successful pre-fault healthy borrowing is the healthy control.

For sequencer: repeat that sequence for Sequencer down and Recovery grace. The post-grace control sets a historical recovery timestamp while the real chain operates. It neither interrupts the chain nor waits an hour. Borrow $1k guarded after restoring post-grace healthy inputs to show reopening.

Expected rejection tests intentionally spend test gas on a reverted transaction after the exact guard is decoded. Wallet rejection, unknown revert, RPC failure and a pending hash verify no check. If confirmation times out, retry the saved hash; never blindly send a duplicate. After reload reconnect the same wallet/network to recover it. If the transaction was dropped, or the public RPC has pruned the block state recovery needs (about 15 minutes on the Robinhood testnet RPC when measured October 2, 2026), use **Discard saved transaction**. It is never counted as evidence; check the explorer first if the transaction might still confirm. Download completed reports before changing run/browser session; earlier completed action history is not automatically reconstructed.

Download JSON evidence and retain the transaction explorer links. Check each downloaded file with `pnpm run report:verify <file>` (it uses the selected network's official public RPC unless `--rpc-url` is given). Public RPCs prune state within minutes to hours, so add `--state` only right after the run or with an archive RPC; without it the output says state snapshots were skipped, and receipts, calldata, block hashes and events are still checked. Complete suite coverage requires all 15 recorded checks; partial runs are correctly labeled partial. A report’s reverted-reason field is a same-block replay, not a transaction trace or third-party attestation.

## Final gate

Verify all families with a fresh public wallet/browser, blocked-price repayment, wrong-network/rejected-signature/RPC recovery, partial/full downloads, mobile controls, public receipt status and contract state. Capture a short backup recording and the exact source commit/report/manifest. Recheck event terms/deadlines and capture actual submission confirmation. Until these gates run, describe the release as locally verified and pending public completion.
