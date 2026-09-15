# Contract implementation progress

8 September 2026. This implements the agreed first step: correct bond-term interpolation and staking fee timing, then introduce a distributor for explicitly allocated protocol receipts. It does not deploy contracts, alter the live JACK token, configure revenue shares, implement peg trading or modify the dapp UI.

## Changes

**JackBarrow:** interpolation handles both increasing payout curves and decreasing fee curves. Existing endpoints and economic settings are unchanged. Decreasing curves subtract a rounded-down delta; quotes and bond opening now support interior terms as well as the 90/365/730/1825-day anchors.

**JackStake:** each reward-fee setter settles the relevant elapsed intervals at the old rate before storing the new rate. Both external-token and native PLS reward streams are handled. Even zero-rounded emissions checkpoint the boundary. External entry points that settle rewards now use the existing reentrancy guard so external fee transfers cannot call back into unguarded settlement paths. This adds settlement work to fee changes; very large reward-token lists still require gas-limit review. Fee changes can revert if an existing fee recipient rejects its transfer; no owed funds are discarded to bypass that failure.

**JackRevenueDistributor:** a new contract with supported-asset controls, actual-receipt accounting, explicit origin attestations, owner-approved exact allocation plans, an immutable review delay, pre-execution cancellation, independent permissionless delivery, and fixed recipients. It supports native/ERC20 transfers and a fixed JackFarm reward-deposit call with exact approval followed by approval clearing. Planning starts disabled. It has no arbitrary external-call facility, generic rescue, minting or Treasury withdrawal authority.

Reserved allocations survive later administrative changes to assets, destinations or planning status. Once the delay has elapsed, allocations cannot be canceled or redirected. This protects commitments but means a permanently rejecting or incorrectly configured matured destination can leave its allocation locked. Owner review during the delay is material. Owner control of unallocated distributor funds is explicit; this is not an immutable allocation policy.

See [the distributor reference](../../Jack-Rabbit-Contracts-main/REVENUE-DISTRIBUTOR.md) for method behavior, operational sequence and limitations.

## Live token identified

- JACK: `0xc8777079d6f8b490996f3f9dc35c2155ce1875ec`.
- User-supplied JACK/pDAI pool: `0x7ef0d4194c9c9ba874fdfb9586e296a3e4ec72d2` on PulseX V2.
- Paired pDAI: `0x6b175474e89094c44da98b954eedeac495271d0f`.
- The explorer reports verified source; its main `Jack.sol` is an exact text match to the local source, with solc 0.8.24, Paris, optimizer runs 200.

Evidence and ABI are saved in [the public verification record](../deployments/jack-token-verification.json). This is not an independent rebuild of the live bytecode, and live owner/Treasury/fee settings have not yet been read. The token source is unchanged.

## Build findings

The original 200-run compilation profile produces oversized ecosystem contracts. Lowering optimizer runs to one makes Stake and Mining fit, but Treasury additionally needs compilation through IR. The local compiler now builds Treasury with that override, without changing Treasury Solidity or disabling the EVM size limit. The source files are compiled with the pinned dependencies recorded in `compiler-profiles.json` and the package lock.

| Contract | Tested runtime bytes | Candidate deployment profile |
| --- | ---: | --- |
| JackRevenueDistributor | 9,992 | solc 0.8.24, Paris, optimizer 1, viaIR off |
| JackStake | 24,386 | same |
| JackBarrow | 23,817 | same |
| JackMining | 24,461 | same; little size headroom remains |
| JackTreasury | 20,266 | same, but viaIR on |

All other compiled production artifacts also fit the 24,576-byte check. The local JACK test deployment uses the test profile, not the live token's historical build profile. No redeployment of JACK is proposed.

The Remix default was changed to one optimizer run with viaIR off. **When compiling Treasury in Remix, enable viaIR for that unit and then restore it to off for the others.** `compiler-profiles.json` records the exception and the live JACK reference profile. Pin OpenZeppelin 5.0.2 for unversioned imports and 4.9.5 for the explicitly versioned imports. The existing generic Storage deployment script has not been converted into a launch runbook yet.

## Validation evidence and scope

Final result: **17 tests passed, 0 failed**. The production compile-size check also passed for every emitted production artifact using the recorded per-contract profiles.

The original Stake and Barrow sources were preserved under the ignored `artifacts/regression-baseline.json` before editing. Running the regression suite against those originals reproduced Barrow's Solidity panic 0x11 on an interior term and incorrect historical fee allocation in all three fee setters. The normal suite runs the corrected sources in a local Ganache EVM, with real solc compilation, time advancement and transaction execution.

The executable coverage includes:

- Actual Barrow quotes and bond opening at anchors, interior durations and second-level boundaries, plus rejection outside the supported duration range.
- Old-rate versus new-rate fee accounting for both staking directions and native rewards, zero-rounded checkpoints, paused/inactive/empty-pool behavior and withdrawal availability.
- Native fee-recipient and payout callback attempts.
- Actual taxed receipts, direct transfer synchronization, origin classification, affordability, delayed cancellation, reserved-balance conservation and replay rejection.
- Failed recipient isolation, sender-extra-fee and balance-deficit protection, and dishonest delivery attempts.
- Fixed funding of a real JackFarm reward stream, direct fees from JackStake, and transfers using the actual local JACK and Treasury implementations.

Commands from `Jack-Rabbit-Contracts-main`:

```sh
npm test
npm run compile
```

The recorded final TAP output is at `artifacts/test-results.tap`; runtime sizes and settings are at `artifacts/compile-report.json`. These are generated local evidence, excluded from Git by the existing artifacts rule. Test dependencies live in the contracts folder, separately from the unfinished frontend.

This is targeted regression/integration coverage. The old Remix suite has not been executed, and the full Mining/Barrow/Treasury economy has not undergone a comprehensive adversarial audit, live-chain fork simulation or market simulation. Some scenarios use explicit token/Treasury/oracle fixtures; the tests with real JACK/Treasury do not verify all of Treasury's branches. No mainnet or wallet transaction was sent.

## Second phase: reserve and Runner maintenance

Implemented `JackPegReserve` and `JackRunner` as separate, non-upgradeable contracts. Reserve capital can only return to the immutable distributor after a review delay; Runner cannot spend it. Runner pays for verified Oracle Hub observation updates from its own native PLS budget, with canonical pair cooldowns, a global UTC-day cap and fully backed pull-payment credits. Both trading and operator bonds are absent. Runner starts disabled and has no owner budget withdrawal; use small operating allocations.

New runtime sizes: **JackPegReserve 5,234 bytes; JackRunner 4,372 bytes**, under the recorded default profile. No existing production Solidity was changed in this second phase. Four new local integration tests passed against the actual Oracle Hub and distributor, using controlled AMM/token/payment fixtures. They cover tax-aware delayed returns, cancellation, deficits, failed synchronization, permissions, duplicate execution, cooldown persistence, failed/reentrant payouts, daily cap persistence, unpaid fallback, external updates and oracle pause behavior.

See [Runner and reserve operations](../../Jack-Rabbit-Contracts-main/RUNNER-AND-RESERVE.md) for funding paths, method behavior, governance assumptions and limitations. The first-phase 17-test result above is historical; the combined suite completed with **21 passed, 0 failed**. The production compile and EIP-170 size checks also passed for all emitted production contracts.

## Next work

Establish deployment configuration and capital-flow scenarios, measure maintenance compensation, then connect reserve and Runner status to the existing dapp. Keep trading disabled until reserve budgets, actual USD price sources, deployment roles and oracle/liquidity conditions are specified and tested. Prepare verified deployment manifests and replace the generic Remix deployment script before any launch. Complete the dapp against verified ABIs and truthful funded/unfunded states. Lending remains outside this first implementation.

## Third phase: allocation review and lifecycle integration

Added a draft role/funding configuration and an offline allocation planner. The planner allocates only reconciled, classified, uncommitted distributor receipts, caps each destination by explicit demand and per-plan limits, and rejects seed-funded peg/Runner spending under the candidate policy. This is an off-chain review rule, not new on-chain enforcement. Production monetary caps remain unset pending measured demand and gas costs.

Added lifecycle coverage for Stake fee ingress, delayed Farm/Barrow funding, Farm harvest and principal withdrawal, Stake claims and withdrawals, separately funded Runner compensation, reserve return provenance, and Barrow partial/final vesting. Mining scenarios cover empty bootstrap, organic Stake-sink funding, actual Treasury holding receipts, sufficient/insufficient participation, reward unlocking and claims.

The Mining integration exposed an Oracle Hub path-direction mismatch. `getExpectedOut` rejected the reverse JACK-to-payment quote Mining needs, causing it to treat funded rewards as zero-value and stay inactive. Generic amount quotes now accept paths starting or ending in JACK; registered conversion routes still must end in JACK. Invalid path rejection remains tested. Oracle Hub runtime is now **18,120 bytes**, within EIP-170; every production artifact passes the size check. This does not change the deployed JACK token.

The tests also configure Treasury's PLS holding-token registration explicitly; listing it only as an external token is insufficient for Mining receipts. Reserve-based Mining valuation still needs manipulation/freshness review, and Treasury-funded swap rounds remain outside these scenarios.

See [revenue flows, examples and limitations](REVENUE-FLOWS.md). The earlier phase test totals are historical. The test entry point now registers all cases in one worker, reusing one pinned Solidity compilation while retaining a separate local chain for each EVM scenario.

Final third-phase validation: **27 tests passed, 0 failed** in the clean combined run (`npm test`). Production compilation and every EIP-170 size check passed (`npm run compile`). TAP evidence is in `Jack-Rabbit-Contracts-main/artifacts/test-results.tap`; compiler evidence is in `artifacts/compile-report.json`. Nothing was deployed or pushed to Git.

## Fourth phase: validated Mining valuation and operating-cost scenarios

Mining now uses Oracle Hub's `getValidatedTwapValue` for reward accounting. Each hop requires a ready, fresh, enabled and sufficiently liquid pair, nonzero guard settings, and two-sided spot/TWAP agreement within the configured band. Accounting value comes from the accepted time-weighted observation. Raw swap output estimates keep their own API. The round-finalization fallback to activation value is retained explicitly; it favors claim availability during oracle failure and may miss later appreciation.

Added adversarial pool and Mining integration scenarios, plus an offline Runner model covering update/withdrawal gas, frequency, margin, fee allocations, funded work and first-day reserve requirements. It does not configure or fund contracts. See [valuation behavior, evidence and limits](VALUATION-AND-OPERATIONS.md).

Compiled runtime: Oracle Hub **19,303 bytes**; Mining **24,461 bytes** (unchanged size). All production artifacts pass EIP-170 under the recorded compiler profiles.

Final fourth-phase validation: **31 tests passed, 0 failed** (`npm test`); production compilation and all size checks passed (`npm run compile`). Local Runner gas measurements were 292,564 for its first update and 37,022 for withdrawal. No deployment, wallet transaction or Git push occurred.
