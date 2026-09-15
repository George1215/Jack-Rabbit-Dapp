# Mining valuation and Runner operating budget

Local implementation phase, 8 September 2026. No deployments or changes to the live JACK token.

## Mining accounting quotes

Mining now calls Oracle Hub's new `getValidatedTwapValue(path, amount)` when valuing its JACK reward inventory in the payment asset. This returns linear time-weighted value, not the expected proceeds of selling that inventory in one AMM trade. Execution quotes and registered Treasury conversion routes keep their existing APIs.

Every valuation hop requires:

- A tracked, enabled, ready pair and an unpaused Oracle Hub.
- An observation within the configured maximum age and reserves satisfying the configured liquidity floor.
- Nonzero update-period, freshness and deviation settings.
- Current directional reserve price within the configured deviation band of the corresponding TWAP, checking both upward and downward displacement.

The resulting amount is calculated from the accepted TWAP; spot movement within the band does not directly change it. The method accepts JACK-starting and JACK-ending paths, preserving reverse Mining valuation support. A rejected quote becomes unavailable to Mining, preventing a new organically funded round from activating until a valid quote is available.

Existing round finalization behavior is retained: if no valid final quote is available, Mining uses its recorded activation value. Its economic cost basis also retains the greater activation cost or actual Treasury funding consumed. An outage therefore does not by itself prevent week advancement or reward claims. This is an explicit valuation/availability tradeoff: fallback can miss genuine appreciation after activation, and an adversary capable of invalidating current observations may force the older snapshot. It is not a guarantee that final rewards reflect current market value. Governance must review that tradeoff before launch.

All parameters remain governance-controlled. Small windows, loose bands, tiny liquidity floors, manipulated observations over longer periods, and compromised governance remain risks. These checks are not a USD oracle, do not prevent every market manipulation, and do not authorize pDAI support trades. Treasury-funded Mining swap paths still need fork and adversarial execution tests.

Mining and Oracle Hub must be deployed/configured with compatible new ABIs. An older Hub does not implement the new method; Mining treats that failure as unavailable valuation. There is no live contract upgrade or deployment in this phase.

## Validation cases

A mutable AMM fixture accrues cumulative prices using the old reserves before each reserve change. Tests cover absent observations, both directions of spot displacement, modest spot movement with unchanged TWAP value, thin reserves, paused/disabled pairs, disabled deviation protection, stale observations and recovery. The integrated Mining scenario proves that invalid prices prevent activation, and that a stale/manipulated end-of-round quote cannot replace the activation snapshot; its funded rewards remain claimable.

This is local Ganache execution against actual Mining/Oracle Hub/Treasury contracts with fixture assets and AMM reserves, not PulseChain fork validation or a complete audit.

## Runner budget model

`economics/runner-budget.mjs` is an offline, integer-arithmetic scenario tool. It consumes update gas, withdrawal gas, an explicitly supplied gas price, update frequency, reward margin, current PLS reward reserve, Runner's proposed share of fees and its available budget excluding credits.

It reports suggested per-update compensation for that scenario, daily cost, first-day fee income, shortfall, already funded update count, and the opening reward reserve required to cover that cost under current Stake defaults. It includes one reward withdrawal per update conservatively. It does not model losing bot transactions, off-chain hosting costs, volatile gas prices or delayed distributor delivery.

The fee calculation uses 140 ppm/day emission and a 10% emission fee. The nominal stake equivalent assumes its 2.5% reverse-reward contribution. All arithmetic is in PLS units, never dollars. The inferred reserve is first-day capacity with eligible JACK stake, not sustainable perpetual income: without replenishment, daily emissions decline. Reserved operator credits and prospective Treasury funds are excluded from current spendable Runner budget.

Run from the repository root:

```sh
node Jack-Rabbit-Contracts-main/economics/runner-budget.example.mjs
```

The local integration measured 292,564 gas for the first Runner update and 37,022 gas for withdrawal. These fixture measurements are not upper bounds for all production jobs.

The saved [example output](runner-budget-example.json) uses deliberately illustrative inputs: 300,000 update gas, 40,000 withdrawal gas, hypothetical 1 gwei, 24 updates/day and a 20% margin. These are not production recommendations. The scenario costs 0.009792 PLS/day; the sample 2.5 PLS reward reserve generates only 0.000035 PLS in first-day fees, of which an illustrative 50% allocation supplies 0.0000175 PLS to Runner. No configuration is automatically applied from this model.

Production still requires gas measurements across job states and pool configurations, an approved update frequency and reward margin, measured actual receipts, an explicitly funded operating tranche, and observation of execution competition. Until then Runner stays disabled in the deployment draft; voluntary Oracle Hub updates remain possible.

Final validation: **31 passed, 0 failed** in the combined local suite. Production compilation and all contract size checks passed. Evidence: `Jack-Rabbit-Contracts-main/artifacts/test-results.tap` and `artifacts/compile-report.json`.
