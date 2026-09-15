"""Reproducible source-based arithmetic, not an EVM test or market forecast.

The Barrow section deliberately reproduces the ORIGINAL buggy interpolation.
Current fixed contracts are validated by Jack-Rabbit-Contracts-main/test/ instead.

Run from any directory: python3 /absolute/path/to/docs/economics/model.py
Writes model-results.json beside this file. Uses only the Python standard library.
"""

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "Jack-Rabbit-Contracts-main" / "contracts"
UNIT = 10**18
DAY = 86400
SEED = 50_550_000 * UNIT


def constant(source, name):
    match = re.search(r"uint256 public constant " + name + r" = ([\d_]+);", source)
    if not match:
        raise ValueError(f"Missing literal constant: {name}")
    return int(match.group(1).replace("_", ""))


def tokens(value):
    whole, fraction = divmod(value, UNIT)
    return f"{whole}.{fraction:018d}"


stake = (CONTRACTS / "JackStake.sol").read_text()
PPM = constant(stake, "DEFAULT_EMISSION_PPM")
PPM_DIVISOR = constant(stake, "PPM_DIVISOR")
FEE = constant(stake, "DEFAULT_JACK_REWARD_FEE_BP")
FEE_DIVISOR = constant(stake, "BP_DIVISOR")


def simulate(days, updates_per_day=1, active=True, seed=SEED):
    """Fixed eligibility/rates; reserve update at each interval; no inflows.

    Tracks allocations before JACK transfer fees, not wallet receipts. Assumes
    lastExternalRewardUpdate was initialized at the start of the model.
    """
    seconds = DAY // updates_per_day
    assert seconds * updates_per_day == DAY
    reserve, fees, pool_rewards = seed, 0, 0
    for _ in range(days * updates_per_day):
        if not active:
            continue
        emitted = min(reserve, reserve * PPM * seconds // (PPM_DIVISOR * DAY))
        fee = emitted * FEE // FEE_DIVISOR
        reserve -= emitted
        fees += fee
        pool_rewards += emitted - fee
    assert reserve + fees + pool_rewards == seed
    return {
        "days": days,
        "updates_per_day": updates_per_day,
        "eligible_pools_present": active,
        "starting_reserve_jack": tokens(seed),
        "remaining_reserve_jack": tokens(reserve),
        "gross_allocated_jack": tokens(seed - reserve),
        "fee_allocation_jack": tokens(fees),
        "external_pool_allocation_jack": tokens(pool_rewards),
    }


def barrow_interpolate(x, x0, x1, y0, y1):
    """Model the existing checked uint256 subtraction in _interpolate."""
    if x <= x0:
        return y0
    if x >= x1:
        return y1
    if y1 < y0:
        raise ArithmeticError("uint256 subtraction underflow (Solidity panic 0x11)")
    return y0 + ((y1 - y0) * (x - x0)) // (x1 - x0)


barrow_cases = []
for term in [90, 180, 365, 500, 730, 1000, 1825]:
    if term <= 365:
        args = (90, 365, 200, 160)
    elif term <= 730:
        args = (365, 730, 160, 130)
    else:
        args = (730, 1825, 130, 100)
    try:
        result = barrow_interpolate(term, *args)
    except ArithmeticError as error:
        result = str(error)
    barrow_cases.append({"term_days": term, "weak_fee_curve_result": result})

first_day = simulate(1)
assert first_day["gross_allocated_jack"] == tokens(7077 * UNIT)
assert first_day["fee_allocation_jack"] == tokens(14154 * UNIT // 10)
assert first_day["external_pool_allocation_jack"] == tokens(56616 * UNIT // 10)
assert simulate(365, active=False)["remaining_reserve_jack"] == tokens(SEED)
assert [isinstance(c["weak_fee_curve_result"], str) for c in barrow_cases] == [
    False, True, False, True, False, True, False
]

# A separate illustration: a nominal seed transfer with a hypothetical active
# 0.1% JACK fee. The live fee and funding order have NOT been verified.
gross_transfer_fee = SEED * 1_000_000 // 1_000_000_000
net_seed = SEED - gross_transfer_fee

report = {
    "status": "arithmetic model only; Barrow section reproduces pre-fix behavior; see separate EVM tests for current contracts",
    "source_sha256": {
        str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(CONTRACTS.glob("*.sol"))
    },
    "assumptions": [
        "50,550,000 JACK is the net reserve in primary scenarios, not user stake",
        "18 decimals, constant default emission and reward fee, no added funds",
        "reward-update timestamp initialized at model start",
        "eligible pools remain present throughout active scenarios",
        "outputs are allocations before JACK transfer fees and user claims",
        "no prices, trading demand, liquidity, gas or USD revenue are forecast",
        "fee allocations from the seed are recycled incentives, not new capital",
    ],
    "constants": {"emission_ppm": PPM, "reward_fee": FEE, "fee_divisor": FEE_DIVISOR},
    "scenarios": [simulate(d) for d in [1, 30, 90, 365]]
    + [simulate(365, updates_per_day=24), simulate(365, active=False)],
    "nominal_seed_with_hypothetical_0_1_percent_transfer_fee": {
        "sent_jack": tokens(SEED),
        "transfer_fee_jack": tokens(gross_transfer_fee),
        "received_jack": tokens(net_seed),
        "first_day": simulate(1, seed=net_seed),
    },
    "barrow_checked_arithmetic_reproduction": barrow_cases,
    "validation": "allocation conservation and expected example outputs asserted",
}
destination = Path(__file__).with_name("model-results.json")
destination.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"report": str(destination), "first_day": first_day,
                  "day_365": simulate(365), "barrow": barrow_cases}, indent=2))
