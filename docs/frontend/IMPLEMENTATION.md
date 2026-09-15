# Dapp frontend implementation

8 September 2026. Local UI pass; no deployment or Git push.

## What changed

The root React app previously imported an uninstalled ethers dependency and a missing ABI, retained an unverified Stake address, and had an empty pool-loading stub. Its CSS was the Vite starter stylesheet. The separate static pages contained the original orange/Bangers/outlined-panel style, but only Diamond Hands and Jackies existed, with unverified transaction wiring and mislabeled token metadata.

The root app has eight hash-navigated sections: Overview, Diamond Hands, Jackies, Farm, Mining, Barrow, Runner and Treasury. It preserves the original rabbit assets and comic typography, adds responsive navigation and module-specific explanations, and separates confirmed token identity from unverified ecosystem deployments. No fabricated pools, APYs, balances or active peg appear.

Runner embeds the existing integer-arithmetic operating-cost model. Its inputs are explicit scenarios, not live gas prices or recommended compensation. Treasury explains principal, commitments, receipts and support reserves. The Diamond Hands panel labels the nominal 50,550,000 JACK seed as planned funding, not a confirmed balance.

Wallet handling uses an injected EIP-1193 provider: explicit connection, network switching to chain 369, read-only JACK `balanceOf`, account/chain listeners and cleanup. Balance reads are discarded when the account or network changes. Display uses whole JACK without rounding up. No approvals, signatures or financial transaction methods are implemented. Ecosystem action buttons remain disabled until deployed addresses, ABIs, configuration and funding are verified and transaction flows are implemented.

The legacy static implementation was preserved in `docs/legacy-dapp/`. Its original public URLs redirect to the new routes; its unverified transaction scripts are no longer served from the public directory. Correct token addresses are centralized in `src/protocol.js`.

## Verification

- `npm run build`: passed.
- `npm run lint`: passed without errors or warnings.
- Browser: all eight routes render, with no observed console errors.
- Five module actions are disabled with specific readiness explanations.
- Missing-wallet handling displays a clear status message.
- A temporary isolated wallet mock exercised connection, wrong-chain switching, 42 JACK read/display, and balance clearing on disconnect. The test harness was removed afterward. No real wallet or RPC transaction was used.
- Runner scenario: doubling the gas input doubled daily cost; zero updates produced validation feedback.
- Desktop and 390px mobile views inspected; mobile hero overlap corrected; overview had no horizontal overflow or broken images.

The browser CLI was unavailable, so verification used Codex's browser controls. The local Vite preview is at `http://127.0.0.1:5173/` while the process is running. Contract source was not changed in this UI phase; its prior 31-test result remains separate evidence, not a new contract-suite run.

## Remaining work

These are informational and readiness-aware module interfaces, not complete transaction integrations. Add only verified deployed module addresses; generate matching frontend ABIs; read pools, positions, reserves and quotes; implement approvals/deposits/withdrawals/claims with real transaction states; test with local/fork deployments and a real wallet before launch.

The original locked frontend toolchain installed with npm audit warnings (15 findings). Dependencies need advisory review and remediation before public hosting; no automatic major upgrade was applied in this UI pass. Local artwork is reused at its original resolution, and typography currently loads through Google Fonts with local fallback fonts.

## Original-design restoration — 8 September 2026

Following the request to preserve the user's own design, the landing page was restored from `George1215/Jack-Rabbit-Dapp` commit `c5b8beba3c95277e530775151e688cfb56a14d2c`, using its actual Landing.js and Landing.module.css as the basis. The original animated rabbit and local LuckiestGuy font were recovered from the same commit. The orange background, hero artwork, crossed JACK banners, holder message, layered cards, legend, tokenomics artwork and Join Us composition are retained.

Diamond Hands and Jackies use the saved original static dapp styling: Bangers typography, white tilted tables, colored Stake/Unstake tabs, carrot/paw navigation and Rewards panels. The previous sidebar/dashboard design is removed. Additional modules follow the same panel styling. The home logo returns to the original landing page; its Dapp button opens Diamond Hands.

Small changes include responsive spacing and tables, keyboard focus visibility, working address copy with feedback, the confirmed JACK address and supplied market link, cleaned-up typing timers, and readiness copy instead of fabricated live values. Original tokenomics illustration is explicitly labeled historical concept artwork; its embedded figures are not verified current tokenomics. Social icons remain artwork pending confirmed official destinations.

Restoration verification: build and lint pass; desktop landing and Jackies plus 390px landing and Diamond Hands visually inspected; all landing images loaded, mobile landing has no horizontal overflow; Dapp/home navigation and Stake/Unstake state verified; Runner invalid-input feedback works; no browser console errors observed. Previous wallet/contract checks above were not rerun as part of this visual restoration. No contracts were edited, no transactions sent, and nothing committed, pushed or deployed.
