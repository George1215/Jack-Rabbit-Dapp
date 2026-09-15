# Jack Rabbit: economic blueprint

Status: economic design draft, 8 September 2026. No deployment instructions in this document authorize a transaction. Follow-up contract implementation is documented in [the implementation report](IMPLEMENTATION.md); statements about the original source below describe the reviewed baseline.

## Purpose and agreed scope

Jack Rabbit uses staking, liquidity farming, mining and vesting bonds to attract participation and accumulate protocol assets. Jack Runner will execute useful maintenance and bounded pDAI support operations. The long-term ambition is to contribute toward pDAI reaching and maintaining $1; the initial product is a revenue-funded ecosystem, not a guaranteed dollar redemption facility.

The founder's only stated seed allocation is **50,550,000 JACK to JackStake**. No additional founder funding, USD value, market demand or guaranteed revenue is assumed. All existing modules belong in the dapp release. Deployment, visibility and economic activation are separate milestones: an unfunded module must show its real state rather than offer fictitious yield. Lending and issuing another stablecoin are outside the first implementation.

The chart-confirmed JACK address is `0xc8777079d6f8b490996f3f9dc35c2155ce1875ec`. Its explorer-published main source exactly matches local `Jack.sol`; see [verification metadata](../deployments/jack-token-verification.json). Independent runtime rebuild matching, live configuration and definitive seed transfer amount versus net receipt remain unverified. Names and rates below are source defaults unless explicitly marked **proposed**.

## Accounting rules

Every amount needs a token, denomination, owner, obligation and origin. A contract balance alone is not spendable surplus.

| Category | Treatment |
| --- | --- |
| User staking/LP principal | Held for withdrawal; never fund Runner or other rewards with it |
| Accrued unpaid rewards | Existing obligation; never distribute a second time |
| Unemitted reward reserves | Dedicated incentives; current owner withdrawal powers must be considered separately from the proposed protection policy |
| Seed-funded JACK fees | Recycled incentives; useful for bootstrapping, but not external capital creation |
| Newly collected participation fees | Protocol receipts, valued conservatively only when a defensible market reference exists |
| Treasury holdings | May include competing allocations; reconcile commitments before making a spendable budget |
| Barrow base and bonus liabilities | Already committed to bond owners; cannot fund peg support |
| Mining funding credit | A contractual funding allowance competing for Treasury inventory, not another asset balance |
| Returned trade principal | Asset conversion/return, not revenue |
| Operator bonds, if added later | Refundable operator liabilities, not protocol trading capital |

Asset provenance is an accounting classification, not an ability to distinguish fungible JACK units after mixing. Isolate designated fee ingress and record explicit source events; do not infer unlimited new revenue from arbitrary transfers, balance increases, cumulative income counters, or a changing JACK price.

## Existing fund flows

| Trigger | Actual local behavior | Bootstrap consequence |
| --- | --- | --- |
| JACK transfer with Treasury attached | Dynamic token fee funds Treasury and potentially burns a share | Token-only income; realizable external value is not guaranteed |
| External-token stake | 5% of actual received amount charged: 2.5% Treasury, 2.5% JACK-staker rewards; 95% user stake | External participation funds reverse-side rewards and Treasury |
| JACK stake | 5% of received JACK charged: 2.5% Treasury, 2.5% configured sink | Set sink to Mining to provide an organic reward source, subject to agreed deployment configuration |
| JACK reward emission to external stakers | Default 20% fee to designated recipient, 80% allocated across eligible pools | Recipient can be proposed distributor; allocations from seed remain recycled incentives |
| External reward emission to JACK stakers | Default 10% fee to designated recipient | Distributor can receive protocol fees, but distribution must avoid fee-recycling loops |
| Farm LP deposit | Default 5% of received LP sent to Treasury | Builds protocol LP holdings; does not independently fund both reward streams |
| Farm reward funding | JACK split across running pools; paired reward sent to its configured pool | Requires an explicit funding transaction; paused pools count as running in the current source |
| Mining deployment payment | 10% admin, 90% Treasury holding deposit | Separate fee policy; no proposal silently reallocates the admin share |
| Mining round finalization | Only economically unlocked JACK is claimable; a configured part of deposits becomes reusable funding credit | Default 60% reusable credit; remainder protected from Mining reuse, not globally locked against all Treasury-authorized protocols |
| Barrow bond purchase | pDAI net amount becomes Treasury reserve; fee is recorded through Treasury; base JACK plus bonus vest | Requires funded JACK promise/reward buckets and an operational oracle |
| Barrow replenishment | Income/reserve-dependent request from Treasury, subject to gap caps and keeper reward | Cannot assume an initially empty Treasury will fully finance bonds |
| Treasury JACK mint fallback | Attempts permitted burn-credit minting when JACK balance is zero | Conditional supply recycling; no initial mint capacity if nothing has burned |

Source anchors: `JackStake.sol` functions `stakeExternalToken`, `stakeJackToken`, `_updateAllExternalPools`, `_updateJackRewardToken`; `JackFarm.sol` `deposit`, `_routeJackReward`; `JackMiner.sol` `deployMiner`, `_matureWeekCredit`; `JackBarrow.sol` `openBond`, `_calculateRequestedNet`; `JackTreasury.sol` `_requestJack`.

## Seed model and its limits

The primary illustration assumes **50,550,000 JACK net received into externalJackRewardReserve**, initialized accounting time, active eligible pools, no subsequent funding and unchanged parameters.

The default 140 parts-per-million reserve emission is 0.014% per day. With one update after the first day, gross allocation is 7,077 JACK: 1,415.4 to the fee recipient and 5,661.6 to external staking pools. These are amounts allocated before JACK transfer fees, not guaranteed wallet receipts or USD earnings.

With no eligible nonempty pool, no JACK is emitted. Repeated updates change the declining reserve and therefore the trajectory. This is not a fixed reward of 7,077 JACK every day, nor a user APY.

With daily updates for 365 days under these assumptions, approximately **48,031,611.55 JACK remains**. Approximately **2,518,388.45 JACK** has been allocated: **503,677.69 JACK** to the fee recipient and **2,014,710.76 JACK** to external pools. This slow release constrains how quickly a distributor funded from seed fees can bootstrap additional modules; it does not justify increasing rates without economic review.

If 50,550,000 is instead a nominal transfer and the active token fee happens to be 0.1%, receipt would be 50,499,450 JACK. Do not increase the founder's transfer above their stated allocation to force the model's net balance. Read the actual live fee, transact only within the allocation, and record the received reserve.

Run `python3 docs/economics/model.py` from the project root for deterministic scenarios and an arithmetic reproduction of the Barrow issue. [Results](model-results.json) include source hashes, inactive-pool and hourly-update cases. This is an accounting model, not an EVM simulation or a forecast of market adoption.

## Proposed distribution: explicit receipts and budgets

Introduce **JackRevenueDistributor** as a recipient for designated protocol fees. It holds only funds explicitly assigned to it, never sweeps balances from user-facing contracts and does not have a blanket Treasury withdrawal role.

Initial integrations can use JackStake's existing `setJackFeeRewardRecipient` and `setExternalFeeRewardRecipient`. Other revenue stays on existing paths until a tested adapter or scoped allocation route is implemented. Do not silently redirect all Treasury receipts or Mining admin compensation.

Use actual received amounts and separate asset ledgers. Permissionless `distribute` may execute an approved allocation, but cannot choose recipients, weights or calldata. Version allocation plans and emit receipts/allocations with origin and destination. A failed destination must not consume an allocation; prefer independent pull claims so one failure does not block every recipient. Unassigned funds remain unassigned.

Proposed priority policy, with numerical amounts deliberately unset:

1. Preserve existing obligations and any previously committed allocation.
2. Maintain a capped operating budget for necessary execution, only when paid work is justified.
3. Allocate a defined portion of available incentives to approved Farm reward streams to solve their missing funding path.
4. Accumulate a separate pDAI support reserve from eligible, uncommitted assets.

No guaranteed minimum payment, arbitrary fixed split, uncapped operator subsidy or automatic rebudgeting from user reserves. Funding one destination reduces funds available elsewhere. Allocation values need scenario review before enabling the policy; unset configuration means no distribution. Do not pay an external reward fee back into the same reward stream just to create apparent activity.

## Proposed Runner boundary

**JackRunner** validates and executes fixed actions; bots submit opportunities but never control custody or truth. **JackPegReserve** holds only explicitly allocated support assets. It is separate from Treasury and user positions so its authority can be bounded and its available budget inspected.

Runner is not granted broad `authorizedProtocols` access to Treasury. A future Treasury export route must enforce a named per-token allocation after reconciling other commitments, or funds must arrive through the distributor. Existing `requestJack` can mint as a fallback, so it must not be the unrestricted source of a peg-support budget.

Candidate interfaces, not finalized Solidity:

- `previewAction(action, routeId, amount)` returns eligibility, limits and reason.
- `executeAction(action, routeId, amount, deadline)` revalidates current state and executes an allowlisted path.
- `availableBudget(token)` excludes existing commitments and accounting liabilities.
- `fund(token, amount, allocationId)` credits actual received assets to a documented allocation.

No arbitrary target, arbitrary external calldata, caller-selected output recipient or caller-supplied authoritative price. Separate maintenance and trading permissions. Trading and operator compensation settle from actual balance changes, with replay protection and reentrancy controls. Any failed trade must revert its funding and reward effects.

Approved maintenance candidates: synchronize funded reward streams, update stale-but-updateable approved oracle observations, and process pending Treasury conversions within existing limits. Each must demonstrate useful state advancement; zero-work/repeated calls earn no reward. Many are already callable by anyone. Runner coordinates and compensates them only if a funded policy exists.

### Price and trade policy

The existing Oracle Hub prices assets relative to JACK. A new independently anchored **USD reference adapter** is required; a pDAI/JACK price alone cannot establish dollars. Select the reference asset, quote sources, update windows and failure policy only after checking live PulseChain liquidity and availability. Never assume a token named DAI or USDC on the fork equals $1.

Support operations need independent reference and execution checks: stale data, deviation, liquidity, per-trade impact, minimum actual output, deadlines, per-token and period budgets, inventory bounds, and pause rules. Oracle windows must not be controllable by an operator's immediate trade. A single manipulated pool or majority of bot votes must not authorize a trade.

Below the target band: buy pDAI with allocated assets. Above the band: sell only available pDAI inventory. Inside the band or with unreliable data: do nothing. At a price far below $1, the policy must still limit losses and spend; it must not continuously exhaust reserves merely because every observation is below target. Reserve-building and active intervention are separate modes. Bought pDAI remains inventory unless a separately reviewed irreversible burn policy is chosen.

No assumption that buying pDAI is profitable. Calculate operating costs, execution losses and inventory valuation separately from realized trading results. Track returned principal separately, including when assets are routed back to Treasury. Treasury's current `receivePegReturn` supports JACK and pDAI only; adding other reserve assets requires corresponding accounting support, not relabeling returns as new income.

### Operators and availability

Start with permissionless execution, redundant operators and capped payment for eligible completed work. No operator can guarantee the peg, and no bot quorum controls prices. A newcomer can execute when incumbents are offline; no exclusive slot may stall withdrawals or transitions.

A compulsory PLS bond is deferred until it has a defined security purpose. If added: it remains segregated/refundable, has explicit unlock rules, cannot fund ordinary trading losses, and can be slashed only for objectively provable defined behavior. Missing an ambiguous price opportunity is not sufficient proof. Native PLS market value can decline; a fixed token bond is not fixed-dollar insurance.

Operator reward parameters must cap total cost and economically limit self-triggered work, wash activity, repeated calls and MEV extraction. Mainnet operator profitability is unproven until measured. Unfunded work is explicitly voluntary, never an accrued unsecured promise.

## Launch states

| Module | What enables operation | State before it is ready |
| --- | --- | --- |
| JACK | Verified live deployment and compatible interface | Address/configuration unverified |
| Diamond Hands | Configured pools, funded JACK reserve, tested deposit/withdraw flows | Awaiting configuration/funding |
| Jackies | Configured reward tokens; external deposits or injections supply rewards | Staking must explain zero current rewards; no fabricated APY |
| Farm | Verified LPs, explicit approved reward allocations and operational Treasury LP receipt | Awaiting rewards; proposed UI gate blocks incentivized deposits until funded |
| Mining | Organic JACK reserve (e.g. JACK staking sink), healthy routes and valid fee token | Awaiting organic funding; no timer until the round activates |
| Barrow | Free base/bonus JACK coverage, sync completion, oracle readiness, corrected term calculations | Bond purchase unavailable until quote and backing checks pass |
| Runner maintenance | Safe useful action; reward budget if compensation offered | Monitoring/voluntary execution |
| Runner pDAI support | Dedicated reserve, validated dollar anchor, tested limits | Reserve building; no claim that a peg is active |

Mining cannot bootstrap a Treasury-funded week with zero earned funding credit. The first organic funds can come from the JACK staking sink; if no one stakes JACK and no other valid funding arrives, Mining remains inactive. Farm requires a new allocation path. Barrow needs actual JACK coverage. Building all screens at once does not remove these dependencies.

## Product direction

Preserve the orange, black outlines, tilted panels and existing rabbit artwork. Use clear type for numbers, bold comic type for headlines. Core navigation: Overview, Diamond Hands, Jackies, Farm, Mining, Barrow, Runner, Treasury.

Overview explains the whole economy and a user's positions. Treasury separates obligations, available assets and allocations. Runner shows price distance, source freshness, reserve budget, intervention history and useful work. Mining distinguishes advertised pool from unlocked/claimable rewards. Barrow shows vesting and final claim deadline. "The race toward $1" is a mission, not a redemption guarantee.

## Review and next implementation boundary

Recommended first implementation: fix and test identified contract behavior, pin dependencies, add the fee distributor and an isolated Runner reserve with spending disabled by default, then implement maintenance before live peg trades. All dapp modules remain in scope. Lending is a separate later design.

See [contract findings and deployment dependencies](VALIDATION-AND-LAUNCH.md). Required inputs before mainnet integration: live JACK address and verification artifacts; nominal-versus-net seed interpretation; roles/fee recipients; supported token/LP addresses; approved revenue allocations; defensible USD price sources and trade budgets. These are recorded decisions, not guessed deployment defaults.

## Reference context

- Local Solidity sources and interfaces are the primary evidence for existing behavior; model-results.json fingerprints the reviewed top-level sources.
- User-selected pDAI listing: https://www.coingecko.com/en/coins/dai-on-pulsechain. Its linked PulseX market identifies `0x6B175474E89094C44Da98b954EedeAC495271d0F`; chain metadata/bytecode must still be verified before integration. No live market-price assumption is used in the model.
- PowerCity EARN: https://docs.powercity.io/earn-protocol/general and https://docs.powercity.io/earn-protocol/earn-staking. PLSX collateral supports newly issued PXDC; EARN staking receives fees. This does not give Jack Rabbit mint/redemption authority over existing pDAI.
- Peg-stability comparison: https://mips.makerdao.com/mips/details/MIP29. A collateral exchange mechanism differs from discretionary budgeted market intervention.
