// Offline review tool. Produces no transactions and reads no wallet or network.
const integer = value => {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) throw Error('Amounts must be unsigned base-unit strings');
  return BigInt(value);
};
const destinations = {
  JACK: { SeedIncentive: ['Farm', 'Barrow'], ProtocolFee: ['Farm', 'Barrow', 'PegReserve'], ReturnedCapital: ['PegReserve'] },
  PLS: { ProtocolFee: ['Runner', 'PegReserve'], ReturnedCapital: ['PegReserve'] },
  pDAI: { ProtocolFee: ['Farm', 'PegReserve'], ReturnedCapital: ['PegReserve'] },
};
/** Snapshot values must come from one reconciled distributor block; never from Treasury or Stake balances.
 * Caps and needs are per reviewed plan, not an automatically renewable daily allowance.
 */
export function draftAllocation({ asset, origin, actual, accounted, reserved, buckets, requests }) {
  const allowed = destinations[asset]?.[origin];
  if (!allowed) throw Error('Unsupported asset or unclassified/ineligible origin');
  const actualAmount = integer(actual), accountedAmount = integer(accounted), reservedAmount = integer(reserved);
  const origins = ['Unclassified', 'SeedIncentive', 'ProtocolFee', 'ReturnedCapital'];
  if (!buckets || Object.keys(buckets).some(key => !origins.includes(key))) throw Error('Invalid origin ledger');
  const ledger = Object.fromEntries(origins.map(key => [key, integer(buckets[key])]));
  if (actualAmount < accountedAmount) throw Error('Distributor deficit');
  if (Object.values(ledger).reduce((a, b) => a + b, reservedAmount) !== accountedAmount) throw Error('Unreconciled obligations');
  if (!Array.isArray(requests)) throw Error('Missing requests');
  let remaining = ledger[origin];
  let previous = -1;
  const allocations = [];
  for (const { destination, cap, need } of requests) {
    const position = allowed.indexOf(destination);
    if (position < 0 || position <= previous) throw Error('Disallowed, duplicate or out-of-priority destination');
    previous = position;
    const capAmount = integer(cap), needAmount = integer(need);
    const amount = [remaining, capAmount, needAmount].reduce((a, b) => a < b ? a : b);
    if (amount) allocations.push({ destination, amount: amount.toString(), delivery: destination === 'Farm' ? 'FarmReward' : 'Transfer' });
    remaining -= amount;
  }
  return { status: 'REVIEW_ONLY', asset, origin, allocations, retained: remaining.toString(),
    allocated: (ledger[origin] - remaining).toString() };
}
