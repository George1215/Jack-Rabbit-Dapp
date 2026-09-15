# Contract validation and launch dependencies

Original review baseline, 8 September 2026. This is a targeted source review and implementation plan, not a completed security audit. F1/F2 have since received fixes and local EVM regression coverage; see [the implementation report](IMPLEMENTATION.md) for current build and test status. The findings and original validation record below are retained as the pre-implementation baseline. No deployments have been performed.

## Findings that affect the design

### F1 — Barrow intermediate vesting terms revert in fee interpolation

Evidence: `JackBarrow.sol:556` calls `_termCurveValue` with decreasing fee values (200, 160, 130, 100 and 800, 640, 520, 320). `_interpolate` at line 736 evaluates unsigned `y1 - y0` for an interior point. `_isValidVestTerm` accepts every duration between 90 and 1,825 days.

For a 180-day term, the weak fee curve tries `160 - 200`. Checked Solidity arithmetic reverts. The same occurs inside the 365–730 and 730–1,825 day intervals. Exact anchor terms bypass the subtraction. The Python model reproduces the arithmetic and boundary behavior; an EVM reproduction remains required.

Proposed correction: branch on curve direction, adding an increasing delta or subtracting a decreasing delta, with explicit rounding policy. Test 90, 180, 365, 500, 730, 1000 and 1825 days plus second-level boundaries; cover quote and actual bond opening. Do not change economic anchor values incidentally.

### F2 — Staking reward-fee changes affect unsettled elapsed time

Evidence: JackStake's reward-fee setters at lines 358–396 assign new rates without first settling the reward accrual interval. `_updateAllExternalPools` and `_updateJackRewardToken` later apply the then-current fee to the elapsed interval.

Consequently a fee change can affect rewards for time before the setting changed. Proposed policy: settle affected reward streams under the old fee before storing the new fee, or use effective-time checkpoints. Test elapsed time on both sides of the update, including paused/empty pools. The emission setter already settles its affected stream, illustrating the intended boundary pattern.

### F3 — Broad Treasury authorization conflicts with a bounded Runner

Evidence: `requestJack`, `requestPdaiReserve`, `requestHoldingToken` and LP requests rely on general protocol authorization; they do not provide a separate Runner allowance. Treasury's JACK request path may invoke minting when its JACK balance is zero.

Runner must not receive this broad authority. An isolated reserve limits Runner to previously allocated assets. Any added Treasury allocator needs asset-specific budgets and commitment accounting. Mining's reusable-credit restriction is enforced in Mining, not a global Treasury reservation that protects funds against all other authorized contracts.

### F4 — Current owner powers differ from the proposed reserve guarantees

Evidence: JackStake exposes owner withdrawal of unemitted reward reserves (`withdrawExternalJackRewardReserve`, `withdrawJackStakerRewardReserve`); JACK exposes fee configuration, Treasury reassignment, allowed minters and `adminMint` within burn credit/supply limits.

Do not label the current system immutable or all reward funding permanently locked. Distinguish user principal/accrued rewards from owner-withdrawable future reserves. Before launch, choose either restricted powers consistent with the proposed guarantees, or clearly documented governance/withdrawal rights. Multisig/timelock proposals do not erase the underlying powers.

### F5 — Some apparent controls are not operative

`JackBarrow.bootstrapMode` appears only in its declaration, initialization and setter; this source does not consult it in bond or funding logic. Toggling it is not an activation gate. Bond availability depends on actual coverage, oracle and sync conditions.

`vestWeightFor` has configurable outputs, but `_calcBond` uses `userPayoutBps(vestSeconds)` directly. Do not present custom vest weights as changing bond payouts without an implementation change and tests. These may be unfinished controls rather than intended mechanics; resolve before exposing admin UI.

### F6 — Initial funding does not automatically reach every module

Only JackStake has the stated seed. Farm reward injection is explicit. Mining starts with no Treasury funding credit, so it first needs organic JACK and a healthy route. Barrow requires funded promise/bonus buckets. Treasury conversions and Runner operations require suitable liquidity and capital.

The proposed distributor adds a controlled path to Farm and support reserves. It does not mint new external value or make every pool profitable. All fees retain their current recipients until an explicitly specified configuration or code change routes them elsewhere.

### F7 — Oracle and deployment scaffolding are incomplete for the mission

OracleHub expresses relative token/JACK prices, not a stand-alone dollar anchor. Existing Treasury peg-return accounting accepts JACK and pDAI only. A reserve using another asset needs deliberate return and cost-basis accounting.

The checked-in ethers deployment script targets the Remix sample `Storage`, not this ecosystem. Imports mix OpenZeppelin version-qualified 4.9.5 paths with unversioned imports; different contracts use different constructor conventions. Pin dependency resolution per compilation unit and record compiler/optimizer/EVM settings. Do not globally rewrite all imports to one major version without a migration review.

## Validation matrix for implementation

| Area | Required cases | Pass condition |
| --- | --- | --- |
| Live JACK compatibility | Verified source/ABI, fees, Treasury, allowed minters, decimals, supply | All interfaces required by consumers match deployed behavior; source hashes and settings recorded |
| Staking principal/rewards | Fee-on-transfer JACK, native PLS, partial withdrawal, paused withdrawal, empty pool, inactive pool | Principal and accrued liabilities reconcile with balances; correct recipients and amounts |
| Staking economics | Time before/after fee change; fee recipient changes; frequent updates; tiny pool alongside large pool | Documented allocation policy and historical boundary semantics; no false APY |
| Farm | Real Treasury adapter, both streams, unfunded pool, paused/ended pool, shortfall, emergency exit | Correct fee receipt and rewards; emergency forfeiture explained; no principal distribution |
| Mining bootstrap | No seed/credit, organic seed, no liquidity, minimum payment, cutoff, repeated sync | No fake round/timer; zero-credit Treasury activation fails safely; healthy organic path succeeds |
| Mining economics | Underfilled round, price movement, credit maturity, claim expiry, taxed transfers | Only unlocked rewards paid; no double credit; rollover and Treasury inventory reconcile |
| Barrow | Increasing/decreasing curve intervals, quote/open consistency, insufficient buckets, NFT transfer, expiry | Correct valid-term execution; liabilities reserved; current owner claims; expired obligations released once |
| Distributor | Direct donations, seed fees, external fees, duplicated receipt ID, failing destination, native/ERC20 assets | No duplicate allocation; failed claim retains entitlement; origin labels preserved; actual receipt used |
| Runner | Wrong direction, stale price, manipulated pool, unsupported route, no useful work, repeated execution | Contract rejects invalid proposals and pays no reward for failure/no-op |
| Reserve | Period/trade cap, concurrent calls, insufficient funds, taxed output, pause, returned capital | Actual spends including compensation stay within committed limits; no use of other module assets |
| Availability | All preferred operators offline; public replacement; unfunded reward budget | Safe public fallback remains possible, no unsecured operator reward debt |
| Adversarial execution | Sandwiching, oracle manipulation, self-generated maintenance, sybil operators | Bounded loss/cost or safe rejection under documented assumptions; no claim that TWAP alone prevents all attacks |

Existing tests use Remix-specific test imports and mocks. They need execution in the appropriate runtime plus integrated tests using the actual JACK/Treasury interfaces; their presence alone is not evidence that the full ecosystem passes. No `forge` or `solc` binary was found on PATH during this review, so no contract-test pass is claimed.

## Stress scenarios to run before enabling capital

1. **No adoption:** seed remains reserved if no eligible external stake; Farm/Mining/Barrow/Runner remain unfunded unless valid funds arrive. No nominal APR or future revenue is promised.
2. **Only external staking:** JACK incentives flow, external reward streams fill, Treasury receives fees. Without JACK stakers, the Mining sink receives no JACK staking fees. Distributor funding can still follow explicitly approved seed-fee policy.
3. **Only JACK staking:** Mining sink receives JACK; external rewards may remain zero absent funding. Model users' net stake and transfer fees accurately.
4. **JACK liquidity/price collapse:** seed-denominated incentives have less realizable value. Treasury's JACK units do not guarantee external purchasing power. Disable trades when bounds fail; never refill from user principal.
5. **Persistent pDAI discount:** repeated eligible observations cannot exhaust funds beyond the approved loss/spend budget. Reserve-building mode can remain active indefinitely without intervention.
6. **pDAI overshoot with no inventory:** no uncovered sell; no power to mint existing pDAI is assumed.
7. **Bot outage/oracle outage:** permissionless execution handles bot outages; no trading on stale data. A price-source outage cannot be fixed by voting bots into agreement.
8. **Competing Treasury users:** Barrow requests and matured Mining credit coexist. Explicit Treasury allocations must reconcile both rather than declare the same assets free twice.

The arithmetic model covers only seed emission, conservation, update cadence, a hypothetical funding transfer fee, and the Barrow subtraction. Market, liquidity, multi-contract, MEV and solvency scenarios remain a subsequent simulation task with verified inputs.

## Remix-oriented dependency order (draft, not an executable runbook)

1. Identify existing JACK deployment. Compare it with local `Jack.sol` before choosing consumers or publishing ABIs. Do not redeploy the live token to work around an incompatible interface.
2. Pin each contract's dependency/compiler settings. Record constructor arguments, build metadata and source hashes. Verify bytecode size and chain EVM compatibility.
3. Deploy OracleHub with verified JACK and pDAI addresses. Register approved pairs/routes and allow observations to warm up; deployment alone does not make the oracle ready.
4. Deploy Treasury with JACK, a zero executor initially (explicitly supported by its constructor), and the intended external-token list. Deploy SwapExecutor pointing at Treasury, then set Treasury's executor. This resolves the constructor dependency without fake addresses.
5. Configure Treasury pDAI, supported holdings/LPs and swap paths. Confirm correct JACK Treasury attachment and transfer-fee behavior. Reconcile live owner permissions before any change.
6. Deploy Mining with Treasury/router/oracle/WPLS/admin. Configure accepted fee tokens and paths; authorize only the tested existing flows. No earned credit or active round is assumed at deployment.
7. Deploy Farm and Barrow, plus their applicable lens contracts. Verify actual constructor signatures: Farm takes `(jackToken_, treasury_)`; the first constructor in its file belongs to `OwnableLite`, not Farm.
8. Deploy the proposed distributor and isolated Runner reserve after their code/tests exist. Configure fixed destination adapters; keep distribution/trading disabled until budgets are specified. Deploy Stake with Mining as proposed sink and distributor as proposed fee recipients, only after those role choices are agreed.
9. Add approved external pools/reward tokens. Fund JackStake's external reward reserve through the supported injection path, within the founder's nominal limit; record actual received amount. Do not call `stakeJackToken` for this seed, since that would establish a user stake instead of the intended reward reserve.
10. Validate deposits, withdrawals, reward flows and bootstrap transitions in a rehearsal environment. Record addresses/ABIs in a manifest only after verification. No mock/hardcoded frontend balances.
11. Enable each module when its funding and behavior gates pass. Launch all navigation/pages with truthful awaiting-funding states where necessary. Enable peg trades only after independent dollar pricing, reserve budgets and execution tests pass.

Additional new contracts and adapters can alter this order; final deployment transactions depend on tested code. Keep maintenance permissions distinct from Treasury spending authority. Document external funding of deployment gas separately from protocol incentive funding; contracts do not pay their own initial deployment gas.

## Decisions recorded vs outstanding

Agreed: all modules in the dapp; existing visual theme; 50,550,000 JACK seed for staking; no extra assumed founder reserve; revenue-funded Runner first; lending later; no Git pushes.

Outstanding before integrations/deployment: live JACK address/source; funding net receipt; exact LP/token lists; operator/admin ownership and fee recipients; allocation amounts; USD reference; reserve asset choice; intervention size/frequency/loss budgets; treatment of current owner withdrawal powers. No fake defaults have been supplied for these fields.

## Verification performed for this draft

- Read the relevant local fund movement, authorization, reward emission, bond pricing and round-activation paths.
- Extracted default stake constants directly into the model and fingerprinted top-level contract sources.
- Reproduced Barrow's checked-subtraction behavior with explicit Python arithmetic, including anchor and interior terms.
- Asserted seed allocation conservation and first-day outputs, with inactive and differing-cadence scenarios.
- Did not compile Solidity, execute Remix tests, validate live bytecode, simulate markets, modify application contracts, or deploy anything.
