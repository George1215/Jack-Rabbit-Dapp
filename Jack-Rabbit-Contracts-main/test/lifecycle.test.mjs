import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEther as e, ZeroAddress, MaxUint256, id } from 'ethers';
import { chain, deploy, send, advance } from './support.mjs';
import { draftAllocation } from '../economics/allocation-policy.mjs';

async function allocate(d, asset, origin, requests, recipients) {
  const names = ['Unclassified', 'SeedIncentive', 'ProtocolFee', 'ReturnedCapital'];
  const token = asset === 'PLS' ? ZeroAddress : recipients.JACK;
  const buckets = {};
  for (let i = 0; i < names.length; i++) buckets[names[i]] = String(await d.unallocated(token, i));
  const draft = draftAllocation({ asset, origin, actual: String(await d.actualBalance(token)),
    accounted: String(await d.accountedBalance(token)), reserved: String(await d.reservedBalance(token)), buckets, requests });
  const n = await d.nextPlanId();
  await send(d.createPlan(token, names.indexOf(origin), id(`lifecycle-${n}`), draft.allocations.map(a => recipients[a.destination]),
    draft.allocations.map(a => a.amount), draft.allocations.map(a => a.delivery === 'FarmReward' ? 1 : 0)));
  return { n, draft };
}

test('Stake seed fees fund Farm and Barrow; participation PLS funds Runner and reserve without spending principal', async t => {
  const c = await chain(); t.after(c.close);
  const [owner, user, bot, sink] = c.signers;
  const jack = await deploy('TestToken', owner), pdai = await deploy('TestToken', owner), lp = await deploy('TestToken', owner);
  const treasury = await deploy('TestTreasury', owner); await send(treasury.setPdai(pdai.target));
  const d = await deploy('JackRevenueDistributor', owner, [owner.address, 3600]);
  const stake = await deploy('JackStake', owner, [jack.target, treasury.target, sink.address, d.target, d.target]);
  const farm = await deploy('JackFarm', owner, [jack.target, treasury.target]);
  await send(farm.addPool(lp.target, pdai.target, e('100'), false));
  const oracle = await deploy('JackOracleHub', owner, [jack.target, pdai.target, owner.address]);
  const pair = await deploy('MaintenancePair', owner, [jack.target, pdai.target]);
  await send(oracle.addTrackedPair(pair.target, 1, 1, 60, 3600, 1000, 10000));
  const runner = await deploy('JackRunner', owner, [owner.address, oracle.target]);
  const reserve = await deploy('JackPegReserve', owner, [owner.address, d.target, 3600]);
  const barrowOracle = await deploy('TestOracle', owner);
  const barrow = await deploy('JackBarrow', owner, [pdai.target, jack.target, treasury.target, barrowOracle.target, owner.address]);
  for (const asset of [jack.target, ZeroAddress]) await send(d.setSupportedAsset(asset, true));
  await send(reserve.setSupportedAsset(ZeroAddress, true));
  for (const recipient of [barrow, runner, reserve]) await send(d.setDestination(recipient.target, 0, true));
  await send(d.setDestination(farm.target, 1, true)); await send(d.setPlanningEnabled(true));
  await send(stake.addPool([ZeroAddress]));
  await send(jack.mint(owner.address, e('50550000')));
  await send(jack.approve(stake.target, e('50550000')));
  await send(stake.injectExternalStakersReward(e('50550000')));
  await advance(c.rpc, 86400);
  await send(stake.updateExternalPool(ZeroAddress));
  assert.equal(await stake.externalJackRewardReserve(), e('50550000')); // No users, no revenue.
  assert.equal(await jack.balanceOf(d.target), 0n);
  await assert.rejects(barrow.openBond(e('1'), 90 * 86400, 0, 30));
  await send(stake.connect(user).stakeExternalToken(ZeroAddress, e('100'), { value: e('100') }));
  await send(jack.mint(user.address, e('100'))); // Simulated user's existing holdings, not founder funding.
  await send(jack.connect(user).approve(stake.target, e('100')));
  await send(stake.connect(user).stakeJackToken(e('100')));
  await advance(c.rpc, 86400);
  await send(stake.updateExternalPool(ZeroAddress));
  await send(stake.updateJackRewardToken(ZeroAddress));
  await send(d.sync(jack.target)); await send(d.sync(ZeroAddress));
  const seedFee = await d.unallocated(jack.target, 0), plsFee = await d.unallocated(ZeroAddress, 0);
  assert.equal(seedFee, e('1415.4'));
  assert.equal(plsFee, e('2.5') * 140n / 1000000n * 100n / 1000n);
  await send(d.classify(jack.target, seedFee, 1, id('seed-emission-fees')));
  await send(d.classify(ZeroAddress, plsFee, 2, id('native-participation-fees')));
  const recipients = { JACK: jack.target, Farm: farm.target, Barrow: barrow.target, Runner: runner.target, PegReserve: reserve.target };
  const j = await allocate(d, 'JACK', 'SeedIncentive', [
    { destination: 'Farm', cap: String(e('200')), need: String(e('200')) },
    { destination: 'Barrow', cap: String(e('100')), need: String(e('100')) },
  ], recipients);
  const half = plsFee / 2n;
  const p = await allocate(d, 'PLS', 'ProtocolFee', [
    { destination: 'Runner', cap: String(half), need: String(half) },
    { destination: 'PegReserve', cap: String(half), need: String(half) },
  ], recipients);
  await advance(c.rpc, 3600);
  for (const plan of [j, p]) for (let index = 0; index < plan.draft.allocations.length; index++) await send(d.connect(bot).claim(plan.n, index));
  await send(barrow.syncDirectJack()); await send(reserve.sync(ZeroAddress));
  assert.equal(await d.unallocated(jack.target, 1), seedFee - e('300'));
  assert.equal(await farm.reservedRewards(jack.target), e('200'));
  assert.equal(await reserve.accountedBalance(ZeroAddress), half);
  assert.equal(await runner.availableBudget(), half);
  // A real Farm deposit, reward accrual, harvest and principal withdrawal.
  await send(lp.mint(user.address, e('100'))); await send(lp.connect(user).approve(farm.target, e('100')));
  await send(farm.connect(user).deposit(0, e('100')));
  await advance(c.rpc, 86400);
  const beforeHarvest = await jack.balanceOf(user.address);
  await send(farm.connect(user).harvest(0));
  assert(await jack.balanceOf(user.address) > beforeHarvest);
  await send(farm.connect(user).withdraw(0, e('95')));
  assert.equal(await lp.balanceOf(user.address), e('95'));
  assert.equal(await lp.balanceOf(treasury.target), e('5'));
  // Runner earns only against the separate fee allocation.
  await send(runner.configureJob(pair.target, true, 1000, 60)); await send(runner.configure(true, 1000));
  const maintenance = await send(runner.connect(bot).maintainOracle(pair.target, 1000, MaxUint256));
  t.diagnostic(`Local first-update Runner gas: ${maintenance.gasUsed}; allocated operating PLS wei: ${half}`);
  const payout = await send(runner.connect(bot).claimReward(bot.address));
  t.diagnostic(`Local Runner withdrawal gas: ${payout.gasUsed}`);
  assert.equal(await runner.availableBudget(), half - 1000n);
  assert.equal(await reserve.accountedBalance(ZeroAddress), half);
  // Stake claims and both principal withdrawals remain available after all downstream spending.
  await send(stake.connect(user).claimJackAsReward(ZeroAddress));
  await send(stake.connect(user).claimExternalTokenAsReward(ZeroAddress));
  await send(stake.connect(user).unstakeExternalToken(ZeroAddress, e('95')));
  const beforeUnstake = await jack.balanceOf(user.address);
  await send(stake.connect(user).unstakeJackToken(e('95')));
  assert.equal(await jack.balanceOf(user.address) - beforeUnstake, e('95'));
  // Allocated Barrow capital backs a bond through partial and final vesting claims.
  await send(pdai.mint(user.address, e('1'))); await send(pdai.connect(user).approve(barrow.target, e('1')));
  const quote = await barrow.quoteBond(e('1'), 90 * 86400), bondId = await barrow.nextTokenId();
  await send(barrow.connect(user).openBond(e('1'), 90 * 86400, quote.baseJack, 30));
  await advance(c.rpc, 45 * 86400); await send(barrow.connect(user).claim(bondId));
  assert(await barrow.promisedBaseLiability() > 0n);
  await advance(c.rpc, 45 * 86400); await send(barrow.connect(user).claim(bondId));
  assert.equal(await barrow.promisedBaseLiability(), 0n); assert.equal(await barrow.promisedRewardLiability(), 0n);
  await assert.rejects(barrow.connect(user).claim(bondId));
  assert.equal(await jack.balanceOf(barrow.target), await barrow.promiseBucketJack() + await barrow.rewardBucketJack());
  // Returned reserve capital is never counted again as fees.
  await send(reserve.queueReturn(ZeroAddress, half)); await advance(c.rpc, 3600);
  await send(reserve.connect(bot).executeReturn(0));
  await send(d.classify(ZeroAddress, half, 3, id('returned-reserve-principal')));
  assert.equal(await d.unallocated(ZeroAddress, 3), half);
  assert.equal(await d.unallocated(ZeroAddress, 2), plsFee - half * 2n);
});

for (const payment of [e('10'), e('0.2')]) test(`JACK stake sink: Mining lifecycle with ${payment} wei participation`, async t => {
  const c = await chain(); t.after(c.close);
  const [owner, user, admin] = c.signers;
  const jack = await deploy('TestToken', owner), wpls = await deploy('TestToken', owner);
  const treasury = await deploy('JackTreasury', owner, [jack.target, ZeroAddress, [ZeroAddress]]);
  await send(treasury.addHoldingToken(ZeroAddress));
  const stakeTreasury = await deploy('TestTreasury', owner);
  const oracle = await deploy('JackOracleHub', owner, [jack.target, wpls.target, owner.address]);
  const pair = await deploy('MaintenancePair', owner, [jack.target, wpls.target]);
  await send(oracle.addTrackedPair(pair.target, 1, 1, 60, 30 * 86400, 1000, 10000));
  await advance(c.rpc, 60); await send(oracle.updatePairIfNeeded(pair.target));
  // Router is unused: this scenario deliberately permits organic funding only.
  const mining = await deploy('JackMining', owner, [jack.target, treasury.target, owner.address, oracle.target, admin.address, wpls.target]);
  await send(mining.setSwapPath(wpls.target, [wpls.target, jack.target]));
  await send(mining.addProtocolFeeToken(ZeroAddress));
  await send(mining.setTokenEconomics(ZeroAddress, 1, MaxUint256, 0));
  const weekId = await mining.currentWeekId();
  assert.equal((await mining.getWeekInfo(weekId)).mode, 0n);
  await assert.rejects(mining.connect(user).deployMiner(e('10'), { value: e('10') }));
  const stake = await deploy('JackStake', owner, [jack.target, stakeTreasury.target, mining.target, owner.address, owner.address]);
  await send(jack.mint(user.address, e('100'))); await send(jack.connect(user).approve(stake.target, e('100')));
  await send(stake.connect(user).stakeJackToken(e('100')));
  assert.equal(await jack.balanceOf(mining.target), e('2.5'));
  await send(mining.sync());
  assert(await oracle.getExpectedOut([jack.target, wpls.target], e('2.5')) > 0n);
  assert(await oracle.getExpectedOut([wpls.target, jack.target], e('2.5')) > 0n);
  await assert.rejects(oracle.getExpectedOut([jack.target, jack.target], 1));
  await assert.rejects(oracle.getExpectedOut([ZeroAddress, jack.target], 1));
  await assert.rejects(oracle.getExpectedOut([wpls.target, owner.address], 1));
  // Generic reverse quotes must not loosen the stored conversion-route policy.
  await assert.rejects(oracle.addRouteToJack(jack.target, [jack.target, wpls.target], 100));
  const active = await mining.getWeekInfo(weekId);
  assert(active.mode > 0n); assert.equal(active.rewardPool, e('2.5'));
  await mining.connect(user).deployMiner.staticCall(payment, { value: payment });
  await send(mining.connect(user).deployMiner(payment, { value: payment }));
  assert.equal(BigInt(await c.rpc.request({ method: 'eth_getBalance', params: [treasury.target, 'latest'] })), payment * 9n / 10n);
  assert.equal((await mining.getWeekInfo(weekId)).treasuryFeesDeposited, payment * 9n / 10n);
  await advance(c.rpc, 7 * 86400); await send(mining.syncWeek());
  const finalized = await mining.getWeekInfo(weekId);
  assert.equal(finalized.finalized, true);
  assert(finalized.unlockedRewardPool > 0n && finalized.unlockedRewardPool <= e('2.5'));
  if (payment === e('0.2')) assert(finalized.unlockedRewardPool < finalized.rewardPool);
  else assert.equal(finalized.unlockedRewardPool, finalized.rewardPool);
  const before = await jack.balanceOf(user.address);
  await send(mining.connect(user).claim(weekId));
  assert.equal(await jack.balanceOf(user.address) - before, finalized.unlockedRewardPool);
  await assert.rejects(mining.connect(user).claim(weekId));
  await send(stake.connect(user).unstakeJackToken(e('95')));
  assert.equal(await jack.balanceOf(stake.target), 0n);
});
