import test from 'node:test';
import assert from 'node:assert/strict';
import { draftAllocation } from '../economics/allocation-policy.mjs';
const snapshot = () => ({ asset: 'JACK', origin: 'SeedIncentive', actual: '1100', accounted: '1000', reserved: '200',
  buckets: { Unclassified: '100', SeedIncentive: '600', ProtocolFee: '100', ReturnedCapital: '0' },
  requests: [{ destination: 'Farm', cap: '400', need: '300' }, { destination: 'Barrow', cap: '500', need: '500' }] });
test('draft allocates classified free receipts only, caps demand and conserves every base unit', () => {
  const result = draftAllocation(snapshot());
  assert.deepEqual(result.allocations.map(x => x.amount), ['300', '300']);
  assert.equal(result.allocated, '600');
  assert.equal(result.retained, '0');
  for (let available = 0; available < 100; available++) {
    const s = snapshot(); s.reserved = '0'; s.actual = s.accounted = String(available);
    s.buckets = { Unclassified: '0', SeedIncentive: String(available), ProtocolFee: '0', ReturnedCapital: '0' };
    s.requests[0].cap = '17'; s.requests[1].cap = '29';
    const r = draftAllocation(s);
    assert.equal(BigInt(r.allocated) + BigInt(r.retained), BigInt(available));
    assert(BigInt(r.allocated) <= 46n);
  }
});
test('draft rejects deficits, mixed obligations, seed peg spending and unapproved destinations', () => {
  for (const patch of [
    { actual: '999' }, { reserved: '201' }, { origin: 'Unclassified' },
    { requests: [{ destination: 'PegReserve', cap: '1', need: '1' }] },
    { requests: [{ destination: 'Runner', cap: '1', need: '1' }] },
    { requests: [{ destination: 'Farm', cap: null, need: '1' }] },
    { requests: [{ destination: 'Farm', cap: '1.0', need: '1' }] },
    { requests: [...snapshot().requests, snapshot().requests[0]] },
  ]) assert.throws(() => draftAllocation({ ...snapshot(), ...patch }));
});
test('native fee budget prioritizes capped Runner demand and retains the unrequested remainder', () => {
  const s = snapshot(); s.asset = 'PLS'; s.origin = 'ProtocolFee';
  s.requests = [{ destination: 'Runner', cap: '20', need: '10' }, { destination: 'PegReserve', cap: '50', need: '50' }];
  const r = draftAllocation(s);
  assert.deepEqual(r.allocations.map(x => x.amount), ['10', '50']);
  assert.equal(r.retained, '40');
});
