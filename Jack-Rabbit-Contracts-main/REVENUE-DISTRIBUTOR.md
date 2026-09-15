# JackRevenueDistributor

This contract allocates assets already held by the distributor. It does not request Treasury funds, mint JACK, trade assets, manage staking principal or promise any yield. No allocation percentages or mainnet destinations are preconfigured.

## Roles and initialization

Constructor: `(initialOwner, delaySeconds)`. The immutable review delay must be greater than zero and no greater than 30 days. Select a deployment value explicitly; tests use one hour solely to exercise timing.

Ownership uses OpenZeppelin Ownable2Step. The owner approves assets/destinations, attests accounting origin, enables creation of new plans and defines exact plans. Anyone can synchronize receipts and execute an eligible allocation. Planning starts disabled.

Only vetted non-rebasing assets are supported. The implementation supports fees deducted from a transfer amount, including JACK. Tokens that debit extra sender-side fees or change balances autonomously are not supported. A balance deficit freezes outgoing execution for that asset rather than passing a loss to the next claimant. There is no generic rescue or deficit haircut method.

## Receipt accounting

- `deposit(token, amount)` records actual received tokens; native PLS uses the zero address and exact `msg.value`.
- Direct transfers, including the existing JackStake fee-recipient payments, are reconciled using `sync(token)`.
- All receipts begin as `Unclassified`. An ERC20 balance increase does not reveal its historical sender.
- The owner may move unallocated amounts into `SeedIncentive`, `ProtocolFee` or `ReturnedCapital` with `classify`, accompanied by a reference ID.
- Classification is an accounting attestation, not proof of profit. It never increases the total accounted amount. Seed-derived fees are not new external revenue.
- A direct transfer from an unsupported asset remains unaccounted until the owner supports that asset. There is no automatic recognition of unsolicited tokens.

Invariant for every supported asset:

`accountedBalance = reservedBalance + sum(unallocated[origin])`

The actual balance must cover the accounted balance before any new plan or payout. Unsynchronized surplus is not automatically available for allocation.

## Plans and payouts

`createPlan(token, origin, referenceId, recipients[], amounts[], deliveries[])` creates a unique numbered plan and immediately reserves exact amounts from one origin bucket. It supports up to 32 allocations. Every amount is positive and every destination/delivery combination must already be approved. There are no percentage defaults.

During the immutable review delay, the owner may cancel the whole unexecuted plan. Cancellation restores the original origin bucket. Once the plan becomes executable, the owner cannot cancel it, change recipients, reclaim its funds or change its amounts.

`claim(planId, index)` is permissionless. It sends only to the snapshotted recipient; the caller cannot redirect funds. Each allocation can execute once. One reverting recipient does not block the remaining allocations, and a failed claim restores its reservation atomically.

Disabling planning, an asset or a destination affects future plans, not existing entitlements. This is intentional: the contract has no emergency power to revoke matured allocations. An incorrectly approved recipient that permanently rejects funds can therefore leave its allocation locked. Review destinations and amounts during the delay.

Delivery types:

| Value | Delivery | Behavior |
| --- | --- | --- |
| 0 | Transfer | Send native PLS/ERC20 to the fixed recipient; record ERC20 recipient balance delta |
| 1 | FarmReward | Approve exactly the allocation, call the fixed `depositReward(token, amount)` interface, then clear approval |

FarmReward is ERC20-only and intended for the verified JackFarm implementation. No arbitrary calldata, target override or general-purpose adapter execution is exposed. The Farm reports actual received reward funding; sender balance checks independently enforce exact distributor spending.

Plain transfers to a protocol do not necessarily invoke its accounting. For example, do not send Treasury assets with Transfer and assume `receiveFunds` was called. Additional destinations with accounting hooks require a separately tested fixed integration or explicit supported sync step. Mining's direct JACK receipts can be synchronized by its existing logic. No Treasury deployment configuration is performed here.

## Staking integration

The existing JackStake fee recipient setters can point at this distributor. Its payable receive hook accepts native fees without calling back into Stake. Keep the JACK staking fee sink aimed at Mining if that approved bootstrap policy is selected; this is distinct from the two reward-fee recipients.

Operational example, without financial defaults:

1. Owner approves the specific JACK token and the verified FarmReward destination.
2. Staking sends JACK fee tokens directly to the distributor.
3. Any caller invokes `sync(JACK)`; the received amount becomes unclassified.
4. Owner classifies the relevant amount as seed incentives if applicable, using a reference to the reconciled receipt records.
5. Owner enables planning and creates an exact, affordable FarmReward plan.
6. Review the event/plan and wait for the delay; cancel during review if incorrect.
7. Any caller executes its fixed allocation; Farm credits its reward streams.

No bot reward is paid by this contract just for synchronization or delivery. Runner compensation and peg-support reserve contracts remain separate future work.

## Tests and compiler

From this folder, install the locked development dependencies with `npm ci --ignore-scripts --omit=optional`, then use `npm test` and `npm run compile`.

The local EVM suite uses solc 0.8.24, optimizer enabled with **1 run**, Paris EVM and **no viaIR**, except **Treasury which requires viaIR enabled**. These are per-contract candidate settings for the undeployed ecosystem contracts, selected because several contracts exceed the runtime-size limit at 200 runs and Treasury remains oversized at one run without IR. The existing live JACK was built at 200 runs and is not redeployed or modified. `JACK_OPTIMIZER_RUNS=200 JACK_TREASURY_LEGACY=1 npm run compile` reproduces the legacy size comparison. The compile check fails if a non-interface local contract exceeds 24,576 runtime bytes; the EVM tests do not disable this limit. Actual build sizes/settings are written to `artifacts/compile-report.json`.

OpenZeppelin is pinned to 5.0.2 for unversioned imports and 4.9.5 through a local npm alias for the explicitly versioned Remix imports. The test compiler resolves both without editing the original Solidity import paths. Ganache may use its pure JavaScript fallback on Apple Silicon; that affects speed, not an exemption from EVM execution.

For the original bug reproduction in this workspace, the pre-edit Stake and Barrow sources were saved under ignored `artifacts/regression-baseline.json`. Run `JACK_REGRESSION_BASELINE=artifacts/regression-baseline.json npm run test:regressions` to exercise those originals. That diagnostic run is expected to fail. The normal test command always uses current sources.

No mainnet deployment, economic allocation approval, public launch or full security audit is implied by passing local tests.
