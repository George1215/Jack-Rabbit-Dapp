# Revenue allocation and lifecycle validation

Local candidate configuration, 8 September 2026. No deployment or transaction is authorized by this document. Numerical allocation amounts in tests are fixtures, not recommended production funding amounts.

## Funding map

| Source | Destination | Accounting treatment |
| --- | --- | --- |
| Founder allocation, at most 50,550,000 nominal JACK | Stake external-staker reserve | Dedicated seed; record actual receipt after any transfer fee |
| JACK staking entry fee | Treasury and Mining sink, 2.5% each by default | User's remaining 95% is withdrawable stake; Mining gets organic incentives |
| External/PLS staking entry fee | Treasury and JACK-staker rewards, 2.5% each by default | User's remaining 95% is withdrawable stake |
| JACK emission fee, default 20% of gross emission | Distributor | SeedIncentive while sourced from founder incentives; not new external value |
| External reward emission fee, default 10% | Distributor | ProtocolFee when backed by identified participation receipts; trace donated/other incentive provenance separately |
| Farm LP entry fee, default 5% | Treasury LP holdings | Does not automatically fund reward streams or peg reserve |
| Mining deployment payment | Admin 10%, Treasury holdings 90% | Nonrefundable participation payment; Mining's reusable credit is an allowance, not new capital |
| Barrow bond purchase | Treasury pDAI receipt | Bond creates JACK liabilities; pDAI receipt is not automatically free peg-support capital |
| Reserve return | Distributor Unclassified → ReturnedCapital | Recovered capital, never newly earned fees |

Rates describe current source defaults. JACK transfer taxes can reduce actual amounts at each hop. Treasury revenue paths are unchanged; there is no blanket sweep into the distributor.

## Proposed priority configuration

The [draft configuration](../../Jack-Rabbit-Contracts-main/economics/revenue-policy.draft.json) records contract roles and leaves monetary caps unset. Distributions and Runner compensation remain disabled in that draft. Do not deploy it directly.

For each asset and receipt origin, review only its reconciled distributor unallocated balance:

- Seed-derived JACK: fund measured Farm reward demand, then funded Barrow inventory demand. Leave excess unallocated. No seed-derived peg or Runner allocation in this candidate policy.
- Identified protocol-fee JACK: Farm, then Barrow, then a capped peg reserve allocation. No implicit JACK-to-PLS sale.
- Identified protocol-fee PLS: capped Runner budget shortfall first, then a capped peg reserve allocation. Ignore accrued operator credits when measuring available Runner budget.
- Identified protocol-fee pDAI: eligible configured Farm reward demand, then peg reserve. No USD valuation assumption.
- Returned capital: return to reserve if requested and approved; otherwise retain. It is not a second fee event.

Each request has a cap and verified unmet need. Allocate the minimum of cap, need and remaining classified funds. Both limits apply to this reviewed plan, not a daily allowance. A previous pending plan to the same destination must reduce its reported need; the offline planner cannot discover outstanding destination commitments itself. Repeated plans must not replenish a budget unless a new review justifies it.

This deliberately avoids a fixed percentage split before gas costs, liquidity, incentives and receipts are measured. Mining already has the JACK staking sink; adding a distributor allocation would require a separate policy change. Stake's original reserve is never an input to the planner.

## Offline planner

[allocation-policy.mjs](../../Jack-Rabbit-Contracts-main/economics/allocation-policy.mjs) exports `draftAllocation(snapshot)`. All amounts are decimal strings of integer base units. Supply actual/accounted/reserved balances and all four origin buckets from one reconciled block, plus ordered destination requests. The planner checks `actual >= accounted` and `reserved + all unallocated buckets == accounted`. It excludes unsynchronized donations, existing allocations and every other origin bucket.

It rejects missing caps, decimal amounts, deficits, unclassified allocation, unsupported routes, duplicates and priority reversal. It produces named destinations and delivery types only: no addresses, calldata, wallet access or transactions. It is a review aid, **not an on-chain policy guard**. Distributor governance can bypass these candidate restrictions through its existing owner methods, including classifying fungible receipts incorrectly. Production must explicitly accept that trust model or add a separately tested enforcement layer.

The local lifecycle test consumes this same planner output to create delayed distributor plans against deployed local contracts. Changing a policy does not modify contract source or existing on-chain commitments.

## Lifecycle scenarios

The integrated Stake scenario uses the full 50,550,000 JACK **net-received test assumption**, then verifies zero emissions before participation. After simulated user deposits and one day, the distributor receives 1,415.4 JACK of seed emission fees. An illustrative plan assigns 200 JACK to Farm, 100 JACK to Barrow and retains 1,115.4 JACK. Those assignments do not imply that 300 JACK is sufficient real-world launch capital.

A 100 PLS external stake places 2.5 PLS in the JACK-staker reward stream under current defaults. With eligible JACK stake, its first-day emission fee is only **0.000035 PLS**. The test divides that tiny fee between reserve and Runner solely to exercise accounting. Its 1,000-wei operator reward is a test value, not gas compensation. The local first oracle update used 292,564 gas (excluding the separate reward withdrawal). At a hypothetical 1 gwei gas price, that update alone would cost 0.000292564 PLS—more than this example's entire first-day fee receipt. This is arithmetic, not a live gas-price estimate. Real operator economics remain unproven; small organic receipts must not be advertised as sustainable paid automation.

The scenario checks actual Farm reward accrual/harvest and 95% LP principal withdrawal, both Stake reward claims and principal withdrawals, Runner payment from its own allocation, untouched reserve capital, Barrow partial/full vesting with cleared liabilities, and reserve return classified separately from fees.

Two Mining scenarios, with sufficient and insufficient participation revenue, test a zero-funded inactive start, organic funding from the JACK staking sink, a paid deployment, Treasury receipt, week finalization, bounded unlocked rewards and duplicate-claim rejection. They check full versus partial reward unlocking. They do not exercise Treasury-funded swaps or later credit reuse.

Test assets and a fixed-reserve AMM are fixtures. The primary lifecycle uses a Treasury fixture and deterministic Barrow quote fixture; it does not validate real Treasury conversions. Mining uses the actual Treasury and Oracle Hub, with no swap execution. Existing tests separately cover the live-style JACK transfer tax path. These are local accounting/integration scenarios, not live-chain economics, a market forecast or a full audit.

## Remaining launch gates

Measure and approve production allocation caps and Runner gas economics; verify module addresses, LPs and governance; test Treasury-funded Mining rounds, swaps, missed claim windows and adverse market conditions on a PulseChain fork; review owner reserve-withdrawal powers; conduct independent security review. Then connect the dapp to verified contracts and truthful readiness states. Peg trading still needs its independent USD reference and bounded trading design.

## Integration findings and correction

The real Mining/Oracle Hub test reproduced an inactive round despite organic JACK funding. Mining reverses its configured payment-to-JACK path to value JACK rewards in the payment token, but `getExpectedOut` formerly rejected every path not ending in JACK. Mining caught that revert and treated it as zero value.

`getExpectedOut` now accepts structurally valid paths beginning **or** ending in JACK. Registered conversion routes retain their existing JACK-ending restriction. Tests check both quote directions, invalid/zero/repeated-token paths and rejection of reverse registered routes. No Mining source changes were needed.

Treasury also needs native PLS explicitly added as a **holding token** before Mining payments can be deposited; its constructor external-token list does not do this. The lifecycle configuration now exercises that distinction.

At the end of this phase, Mining still used raw reserve-based quotes. The subsequent [valuation phase](VALUATION-AND-OPERATIONS.md) replaces its accounting valuation with fresh, deviation-checked TWAP quotes. Raw `getExpectedOut` remains an execution quote; broader manipulation and fallback-policy review is still required.

Validation result: **27 passed, 0 failed** in the final combined local test run; all production contracts compiled within EIP-170 limits. Run `npm test` and `npm run compile` from `Jack-Rabbit-Contracts-main`.
