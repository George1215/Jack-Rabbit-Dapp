# Jack Runner and peg reserve — maintenance phase

These are local implementation candidates, not deployed contracts. JACK's deployed token is unchanged. Trading is absent; this phase does not peg pDAI or establish a dollar price feed.

## Capital paths

Protocol receipts → Revenue Distributor → reviewed allocation → JackPegReserve.

A separate, explicitly allocated native PLS operating budget → JackRunner → earned operator credit → operator withdrawal.

The founder's 50,550,000 JACK Stake incentive allocation is not an operating or peg budget. Neither new contract can withdraw Treasury assets, stake principal, mint tokens or claim another module's rewards. Configure neither as a Treasury authorized protocol.

## JackPegReserve

Constructor: owner, immutable Revenue Distributor address, immutable return delay (1 second through 30 days; production governance must choose a meaningful review window). Asset support initially empty. `tradingEnabled()` is permanently false in this contract version. Adding future trading requires a separately reviewed contract; there is no upgrade hook.

Owner enables approved assets, including address zero for native PLS. A distributor Transfer allocation or voluntary donation sends assets directly; anyone then calls `sync(asset)` to recognize actual receipts. This vault records protocol capital, not individual depositor balances. It offers no depositor redemption promise. Fee-on-transfer receipt accounting uses balances; rebasing and extra sender-debit assets are not supported. Unapproved assets can remain unrecognized until enabled by the owner; there is no arbitrary rescue.

The only outgoing path is `queueReturn(asset, amount)` to the immutable distributor. Amounts cannot be reserved twice. Owner may cancel before maturity; afterward anyone may execute to that fixed address. Returns atomically invoke distributor synchronization, entering its Unclassified bucket. Governance must classify them as ReturnedCapital with supporting records, rather than counting them as new revenue. That classification remains an attestation, not automatic provenance enforcement.

Deficits, excess sender debits or distributor rejection revert the whole execution. Disabling a reserve asset does not revoke already recognized capital or returns. A permanently incompatible distributor can lock funds; there is no arbitrary destination replacement. Owner governance can redistribute returned capital through the distributor's own delayed process, so reserve purpose ultimately depends on that governance.

## JackRunner

Constructor: owner and immutable Oracle Hub address. Starts disabled, daily reward cap zero, no enabled jobs. Native transfers are irreversible operating-budget contributions, not operator deposits. This minimal version deliberately has no owner withdrawal, token rescue or budget migration: allocate small, measured PLS tranches. ERC20 transfers to Runner are unsupported and cannot be recovered.

Owner configures one canonical job per tracked pair: enabled flag, fixed PLS reward in wei and nonzero minimum interval. `configure` sets global enablement and a daily PLS reward cap. Configuration does not clear job timestamps, reward credits or daily spending. Owner can change future job economics and caps; these settings are not timelocked.

Anyone calls `maintainOracle(pair, minimumReward, deadline)`. Runner requires a tracked, enabled pair with sufficient reserves and an update due under Oracle Hub rules. Both its prior execution and the Hub's last successful observation enforce cooldown. It invokes only the fixed Hub update method, then verifies a fresh, ready, non-stale observation. Failed or duplicate work earns nothing. No arbitrary target, calldata, trade request or bot-supplied price is accepted.

The fixed reward is reserved only if both the available PLS budget and global daily cap cover it. Otherwise the offered reward is zero; the call succeeds only if the operator explicitly permits that with `minimumReward = 0`. There is no partial reward or unpaid liability. Paid and unpaid successful work share the cooldown. Operators should simulate, set a minimum reward and use a short deadline before submitting; competing bots can update first and cause a losing transaction to revert with gas spent.

Rewards use pull payments: `rewardCredits(operator)` is always backed by reserved PLS, excluded from `availableBudget()`. Only that operator can withdraw its credit, to a chosen recipient. Failed recipient payments preserve credit; callbacks cannot reenter execution or withdrawal. Pausing new jobs does not block earned withdrawals.

The cap uses Unix UTC day buckets, not a rolling 24-hour window. Two adjacent days may spend two caps close to midnight. A single global cap means pairs compete for budget; no fairness or liveness guarantee is made. Anyone may still update Oracle Hub directly. Oracle Hub and its owner remain trusted dependencies. Relative JACK/pDAI observations are not an independent USD oracle, and freshness/liquidity checks do not prove resistance to all market manipulation.

## Remix and launch gates

Compile both new contracts using solc 0.8.24, Paris, optimizer 1, viaIR off, pinned OpenZeppelin 5.0.2, consistent with the local compiler profile. Treasury keeps its separate viaIR override. Do not deploy until owners, delays, supported assets, pair configuration, measured gas compensation and sustainable PLS revenue allocations are reviewed.

The local suite uses the actual Oracle Hub and Revenue Distributor, a deterministic AMM pair fixture and adversarial token/payment fixtures. It checks delayed tax-aware returns, cancellation, deficits, failed synchronization, permissions, cooldowns, duplicate work, budget caps, unpaid fallback, external oracle updates, pausing and backed reward withdrawals. It is not a full audit or live PulseChain fork test.

Next: establish deployment configuration and capital-flow integration scenarios, measure maintenance economics, then connect truthful reserve/Runner states to the existing UI. Peg trading additionally requires an independent dollar reference, funded inventory, execution limits and adversarial market simulations. Do not present maintenance as a $1 peg mechanism.
