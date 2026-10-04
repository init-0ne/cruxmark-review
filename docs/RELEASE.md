# Release a reproducible Cruxmark demo

The supported release is a static wallet lab and a factory for owned synthetic scenarios. It is not a production lending system. This checklist never authorizes mainnet writes, paid services, or handling private keys in source/chat/output.

## Local review

1. Use Node 24 and the pinned pnpm version. Run `pnpm install --frozen-lockfile`, `pnpm run doctor`, and `pnpm run check`.
2. Start `pnpm run chain` in its own terminal. Anvil is loopback-only and quiet; its unlocked accounts are public disposable test accounts.
3. Run `pnpm run deploy:local`. This deploys one factory, verifies the RPC chain, live successful creation receipt, creation calldata and exact runtime bytecode at the deployment block/current block. It writes `work/deployment/local.json` and updates only the three public network/factory settings in ignored `.env.local`.
4. Run `pnpm run dev`. Redeploy after contract changes or local-chain restarts. Do not reuse old local report hashes after restarting Anvil.
5. Open the loopback app and choose **Use local test account**, or connect a browser test wallet on chain 31337. The local option uses a disposable unlocked Anvil account, requires loopback app/RPC addresses and is unavailable on public sites/chains. The app never asks for a private key. Create a run and prepare 100 tokens in each consumer. Use the flow below.

`pnpm run ui:test` drives the real web app in headless Chrome against its own ephemeral chain: the guided split flow, a refused action's wording, a vanished or unrecoverable saved transaction and its discard, a canceled run switch that preserves evidence, an injected EIP-1193 provider signing a real local run after a rejected signature, a wrong-network add/switch, and the public-build boundary. It verifies the report the browser produced against the chain. It needs Chrome (`CHROME_PATH`) and is not part of `pnpm run check`. `UI_FULL=1 pnpm run ui:test` follows the lab's NEXT line through all three families until all 15 checks verify, then verifies the complete report on-chain. CI runs that full version as a required job. A real extension on a public testnet is still a separate release check.

`pnpm run execution:test` uses a separate ephemeral chain, two independent owners and the same execution module as the web app. It saves a complete local JSON report under ignored `work/verification/` and shuts its chain down. This independently runnable check does not establish normal browser-wallet signing or a public deployment.

## Public testnet release

- Obtain the user's dedicated test-wallet public address, signing access and free faucet ETH. Do not collect or print a private key/password. Prefer Foundry's browser-wallet signer so the key remains in the user's wallet.
- Check registration, participant/team eligibility and the signed-in HackQuest form. A legal acceptance or prize-wallet decision belongs to the user; do not guess it.
- Choose Robinhood Chain Testnet (46630) or Arbitrum Sepolia (421614). Prefer Robinhood. Measured October 2, 2026 with snapshot-shaped load (16 reads per round, ~50 requests per second): the Robinhood public RPC served all 480 requests without a failure, while the Arbitrum Sepolia public RPC answered HTTP 429 for 8 of 30 rounds. A controlled ABBA experiment with a quiet minute before each phase throttled 12/20 and 16/20 rounds sent as separate requests and 16/20 and 13/20 sent as one JSON-RPC batch, so that limiter counts calls and batching does not help. On Arbitrum Sepolia expect occasional "rate-limiting" notices (wait a few seconds and retry), or set `VITE_RPC_URL` to a different free endpoint after checking it. If this ever matters on the primary chain, the lever is fewer calls per snapshot: an on-chain view that returns the whole snapshot would cut about 17 reads to 1-2. It was not built because the primary chain showed no throttling. Official public RPCs are in `src/chains.ts`. Read the actual RPC chain ID before broadcasting; no mainnet fallback exists.
- Commit/review the release, then run the full checks from the clean source revision. The factory and instance constructors reject unsupported chains.
- Dry-run the deployment without a signer. The sender here is a public placeholder used only for simulation:

```sh
pnpm exec forge script contracts/script/DeploySandbox.s.sol:DeploySandbox --root contracts --rpc-url https://rpc.testnet.chain.robinhood.com --sender 0x000000000000000000000000000000000000dEaD
```

A dry run only simulates; nothing is signed or sent, so any public address works as `--sender`. Dry runs on October 2, 2026 against both official public RPCs succeeded, and Robinhood was rechecked October 3. The latest Robinhood estimate was 3,876,458 gas at 0.020000001 gwei (about 0.00007753 ETH); Arbitrum Sepolia's October 2 estimate was 4.11M gas at 0.083 gwei (about 0.00034 ETH). Each `createScenario()` run costs about 2.6M gas. These are simulation estimates, not charges, and gas prices move, but a small faucet drip covers the whole demo. The RPCs reported chain IDs 0xb626 (46630) and 0x66eee (421614) as documented. The largest contract, the factory, is 13.6 KB against the 24.6 KB limit.

Forge prints `EIP-3855 is not supported ... 46630 ... might not work properly` for the Robinhood testnet. That warning is expected and does not apply to this build: `contracts/foundry.toml` compiles for `evm_version = "paris"`, which never emits PUSH0. `pnpm run execution:test` proves it by running every action on an Anvil pinned to `--hardfork paris`, where PUSH0 is rejected (`NotActivated`); compiling for Shanghai makes that check fail. Do not raise the EVM target without re-verifying the chain.

After the user can sign and the dry-run/faucet balance are verified, broadcast through Foundry's local browser-wallet bridge. The user connects the intended wallet and approves the transaction in its normal prompt:

```sh
pnpm exec forge script contracts/script/DeploySandbox.s.sol:DeploySandbox --root contracts --rpc-url https://rpc.testnet.chain.robinhood.com --sender "$CRUXMARK_TEST_WALLET" --broadcast --browser --slow
```

`CRUXMARK_TEST_WALLET` is a public address only. Forge's bridge opens a loopback page at `http://127.0.0.1:9545`; it times out after five minutes without a wallet response. The user must confirm the account, chain 46630, contract creation, zero transaction value and test ETH gas fee in the wallet. An address mismatch fails before signing. This [Foundry browser-wallet guide](https://getfoundry.sh/guides/browser-wallet) documents the flow. If that bridge is unavailable, the user can privately import the test wallet into an encrypted keystore using `pnpm exec cast wallet import cruxmark-testnet --interactive` and substitute `--account cruxmark-testnet` for `--browser`; hidden prompts must never enter agent tools or logs.

Verify the actual public result:

```sh
pnpm run deployment:verify --network robinhood-testnet
```

The verifier requires a clean source revision for public evidence and reads the broadcast file for the selected network. It verifies the receipt, block hash, creation input, source compiler/settings and exact current/historical runtime bytecode. It writes `work/deployment/robinhood-testnet.json`. For Sepolia use `--network arbitrum-sepolia`; for a different broadcast file use `--broadcast <path>`. No RPC URL/credentials are stored in the manifest.

Retain a reviewed copy of the public manifest for submission. Explorer source verification is a separate action; the manifest does not assert it. On October 4 the factory and all seven contracts of the complete run were verified on the Robinhood Chain Testnet Blockscout, which needs no API key. Blockscout decoded each run contract's constructor arguments from its creation data, and they match the report:

```sh
pnpm exec forge verify-contract <address> src/ScenarioFactory.sol:ScenarioFactory --root contracts --rpc-url https://rpc.testnet.chain.robinhood.com --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api/ --compiler-version 0.8.30 --optimizer-runs 200 --evm-version paris --watch
```

Check the result at `https://explorer.testnet.chain.robinhood.com/api/v2/smart-contracts/<address>` (`is_fully_verified`).

Set the public build environment to the selected `VITE_NETWORK` and verified `VITE_FACTORY_ADDRESS`. Shell values take precedence over `.env.local`, which `deploy:local` fills with local settings, so pass the public values explicitly when building for a public network. The browser checks compiled factory bytecode before any scenario action. A changed contract requires a matching redeployment/build; a copied address is insufficient.

The primary demo is [cruxmark.vercel.app](https://cruxmark.vercel.app/) on the existing `init-0ne/cruxmark` Vercel Hobby project. Production deployment `dpl_HQhRdFZfGqpRwbac6cR1rDVVNZCf` was built from clean source revision `aea5803` with `VITE_NETWORK=robinhood-testnet`, the official public RPC and the verified factory address. It reached Ready; the root page and both public reports returned HTTP 200, and a browser read chain 46630. Only 16 compiled static files were uploaded: HTML, JS/CSS, fonts, icons and the two public evidence JSON files. The CLI dry run explicitly excluded its generated `.env.local`, `.gitignore` and `.vercel` directory; no repository source file or wallet credential was uploaded. Vercel's [Hobby plan is limited to noncommercial personal use](https://vercel.com/docs/limits/fair-use-guidelines). This is a hackathon demo, not a commercial production deployment; a commercial rollout needs a compliant hosting plan.

To release an app change there, first run the required local checks from a clean commit and push it, so the revision baked into the bundle is public. Build with Vite base `/` into a temporary directory and pass every public setting explicitly, because a plain build reads the local values in `.env.local`. On October 4 a production redeploy built that way served chain 31337 and `http://127.0.0.1:8545` to every visitor until it was replaced:

```sh
VITE_NETWORK=robinhood-testnet VITE_RPC_URL=https://rpc.testnet.chain.robinhood.com VITE_FACTORY_ADDRESS=0xabf626f8a3f98e8046d2a85973a36b5a06c0d3fb pnpm exec vite build --base / --outDir <temp>/site --emptyOutDir
```

Before uploading, confirm the bundle selected the public network (``grep -o 'S=`robinhood-testnet`' <temp>/site/assets/index-*.js``). Then, from `<temp>/site`, run `vercel deploy --dry --yes --scope init-0ne --project cruxmark` to confirm only static public files are included, then deploy it with `--prod` and check the alias, chain connection and evidence downloads in a browser. Keep the temporary `.env.local` generated by Vercel out of source and output; it can contain an OIDC token. There is no source-repository Git integration, so deployment is manual.

The fallback [GitHub Pages demo](https://0xuser64bit.github.io/cruxmark-demo/) comes from a separate [public repository](https://github.com/0xuser64bit/cruxmark-demo) containing only compiled static assets and the two public evidence JSON files. Its source is `main` at `/`, and `.nojekyll` prevents Jekyll from altering Vite output. That build used clean source revision `da4a817` and Vite base `/cruxmark-demo/`; its [Pages build passed](https://github.com/0xuser64bit/cruxmark-demo/actions/runs/37189402629). After an app change, rebuild and republish the fallback separately. Do not publish `.env.local`, `work/` files or private keys to either host.

The [full-history source repository](https://github.com/init-0ne/cruxmark-review) is public; the original working repository stays private and receives the same commits. Scan the entire history for keys and tokens before making any repository public. Public hosting and source access are separate release actions. Check CI for the exact release hash after pushing; a green run on an earlier commit does not cover later changes.

## Observed demo sequence

The prominent next-action button follows the lab's NEXT line, based on checks recorded in this browser session. Follow it, or use the controls below. Download the JSON before switching runs, reconnecting, refreshing or closing the tab. The app warns before clearing confirmed action history, but browsers can suppress leave-page prompts, so keep the downloaded file. A reload can recover one unresolved transaction but cannot reconstruct earlier confirmed actions.

A seeded healthy price expires after the sandbox max age (300 chain-seconds), and public testnet blocks arrive continuously, so chain time keeps moving while you talk. If a healthy-control borrow is rejected as unavailable, seed healthy again and borrow promptly; the lab's Input evidence shows the price age the guard compares against that limit.

For the split: prepare both positions → seed Stock split → borrow $12k unsafe → test $12k guarded rejection → borrow $6k guarded control → repay. The four split coverage rows should verify from those actual actions.

For unavailable price: restore healthy → borrow $1k guarded to seed repayable debt → seed Paused price → borrow $1k unsafe → test guarded rejection → repay while blocked. Repeat for Stale price, restoring healthy before seeding guarded debt again. Successful pre-fault healthy borrowing is the healthy control.

For sequencer: repeat that sequence for Sequencer down and Recovery grace. The post-grace control sets a historical recovery timestamp while the real chain operates. It neither interrupts the chain nor waits an hour. Borrow $1k guarded after restoring post-grace healthy inputs to show reopening.

Expected rejection tests intentionally spend test gas on a reverted transaction after the exact guard is decoded. Wallet rejection, unknown revert, RPC failure and a pending hash verify no check. If confirmation times out, retry the saved hash; never blindly send a duplicate. After reload reconnect the same wallet/network to recover it. If the transaction was dropped, or the public RPC has pruned the block state recovery needs (about 15 minutes on the Robinhood testnet RPC when measured October 2, 2026), use **Discard saved transaction**. It is never counted as evidence; check the explorer first if the transaction might still confirm. Download completed reports before changing run/browser session; earlier completed action history is not automatically reconstructed.

Download JSON evidence and retain the transaction explorer links. Check each downloaded file with `pnpm run report:verify <file>` (it uses the selected network's official public RPC unless `--rpc-url` is given). Public RPCs prune state within minutes to hours, so add `--state` only right after the run or with an archive RPC; without it the output says state snapshots were skipped, and receipts, calldata, block hashes and events are still checked. Complete suite coverage requires all 15 recorded checks; partial runs are correctly labeled partial. A report’s reverted-reason field is a same-block replay, not a transaction trace or third-party attestation.

## Final gate

The complete public run verified all 15 checks from 29 transactions, including blocked-price repayment, and a separate hosted-browser run verified 4/4 split checks. Both reports passed independent receipt, event and historical-state verification at the time of execution. Local browser regressions cover wrong-network, rejected-signature and transaction-recovery behavior. A Brave-extension public scenario and mobile controls remain separate checks. Capture a short backup recording if the submission form requires one, preserve the exact source commit/report/manifest, recheck event terms/deadlines and capture actual submission confirmation. Until the form is submitted, describe the project as deployed and verified, with submission pending.
