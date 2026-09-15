import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEther as e, ZeroAddress, MaxUint256 } from 'ethers';
import { chain, deploy, send, advance } from './support.mjs';
async function setup(t) {
  const c = await chain(); t.after(c.close);
  const [owner, user] = c.signers;
  const jack = await deploy('TestToken', owner), pay = await deploy('TestToken', owner);
  const oracle = await deploy('JackOracleHub', owner, [jack.target, pay.target, owner.address]);
  const pair = await deploy('MutableMaintenancePair', owner, [jack.target, pay.target]);
  await send(oracle.addTrackedPair(pair.target, e('1000'), e('1000'), 60, 3600, 1000, 10000));
  return { ...c, owner, user, jack, pay, oracle, pair };
}
test('validated TWAP rejects unready, stale, paused, disabled, thin and two-sided manipulated pools', async t => {
  const f = await setup(t);
  const quote = () => f.oracle.getValidatedTwapValue([f.jack.target, f.pay.target], e('10'));
  await assert.rejects(quote());
  await advance(f.rpc, 60); await send(f.oracle.updatePairIfNeeded(f.pair.target));
  assert.equal(await quote(), e('10'));
  assert.equal(await f.oracle.getValidatedTwapValue([f.pay.target, f.jack.target], e('10')), e('10'));
  for (const reserve of ['2000000', '500000']) {
    await send(f.pair.setReserves(e('1000000'), e(reserve)));
    await assert.rejects(quote());
    await assert.rejects(f.oracle.getValidatedTwapValue([f.pay.target, f.jack.target], e('10')));
  }
  await send(f.pair.setReserves(e('1000000'), e('1050000')));
  assert.equal(await quote(), e('10')); // Uses the unchanged observation, not the moved spot.
  await send(f.pair.setReserves(e('100'), e('100'))); await assert.rejects(quote());
  await send(f.pair.setReserves(e('1000000'), e('1000000')));
  await send(f.oracle.pause()); await assert.rejects(quote()); await send(f.oracle.unpause());
  await send(f.oracle.setPairConfig(f.pair.target, false, e('1000'), e('1000'), 60, 3600, 1000, 10000));
  await assert.rejects(quote());
  await send(f.oracle.setPairConfig(f.pair.target, true, e('1000'), e('1000'), 60, 3600, 0, 10000));
  await assert.rejects(quote());
  await send(f.oracle.setPairConfig(f.pair.target, true, e('1000'), e('1000'), 60, 3600, 1000, 10000));
  await advance(f.rpc, 3601); await assert.rejects(quote());
  await send(f.oracle.updatePairIfNeeded(f.pair.target)); assert.equal(await quote(), e('10'));
});

test('Mining cannot activate on manipulated or stale valuation; stale finalization uses its validated activation snapshot', async t => {
  const f = await setup(t);
  const treasury = await deploy('JackTreasury', f.owner, [f.jack.target, ZeroAddress, [ZeroAddress]]);
  await send(treasury.addHoldingToken(ZeroAddress));
  const mining = await deploy('JackMining', f.owner, [f.jack.target, treasury.target, f.owner.address, f.oracle.target, f.owner.address, f.pay.target]);
  await send(mining.setSwapPath(f.pay.target, [f.pay.target, f.jack.target]));
  await send(mining.addProtocolFeeToken(ZeroAddress));
  await send(mining.setTokenEconomics(ZeroAddress, 1, MaxUint256, 0));
  await send(f.jack.mint(mining.target, e('2.5')));
  await send(mining.sync()); assert.equal((await mining.getWeekInfo(1)).mode, 0n);
  await advance(f.rpc, 60); await send(f.oracle.updatePairIfNeeded(f.pair.target));
  await send(f.pair.setReserves(e('1000000'), e('2000000')));
  await send(mining.tryFunding()); assert.equal((await mining.getWeekInfo(1)).mode, 0n);
  await send(f.pair.setReserves(e('1000000'), e('1000000')));
  await advance(f.rpc, 3601); await send(mining.tryFunding());
  assert.equal((await mining.getWeekInfo(1)).mode, 0n);
  await send(f.oracle.updatePairIfNeeded(f.pair.target)); await send(mining.tryFunding());
  assert.equal((await mining.getWeekEconomics(1)).rewardValueAtActivation, e('2.5'));
  await send(mining.connect(f.user).deployMiner(e('10'), { value: e('10') }));
  await advance(f.rpc, 7 * 86400);
  await send(f.pair.setReserves(e('1000000'), e('100000000')));
  await send(mining.syncWeek());
  const economics = await mining.getWeekEconomics(1);
  assert.equal(economics.rewardValueAtFinalization, e('2.5'));
  assert.equal(economics.economicCostBasis, e('2.5'));
  await send(mining.connect(f.user).claim(1));
  assert.equal(await f.jack.balanceOf(f.user.address), e('2.5'));
});
