import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEther as e, ZeroAddress, ZeroHash, id } from 'ethers';
import { chain, deploy, send, advance } from './support.mjs';

async function fixture(t) {
  const c = await chain(); t.after(c.close);
  const [owner, alice, bob, publicCaller] = c.signers;
  const token = await deploy('TestToken', owner);
  const d = await deploy('JackRevenueDistributor', owner, [owner.address, 3600]);
  await send(d.setSupportedAsset(token.target, true));
  await send(d.setSupportedAsset(ZeroAddress, true));
  for (const who of [alice, bob]) await send(d.setDestination(who.address, 0, true));
  await send(token.mint(owner.address, e('1000')));
  await send(token.approve(d.target, e('1000')));
  return { ...c, owner, alice, bob, publicCaller, token, d };
}

async function plan(f, token, recipients, amounts, deliveries = recipients.map(() => 0), origin = 0) {
  const n = await f.d.nextPlanId();
  await send(f.d.createPlan(token, origin, id(`plan-${n}`), recipients, amounts, deliveries));
  return n;
}

async function reconcile(f, token) {
  let free = 0n;
  for (let origin = 0; origin < 4; origin++) free += await f.d.unallocated(token, origin);
  assert.equal(free + await f.d.reservedBalance(token), await f.d.accountedBalance(token));
  assert(await f.d.actualBalance(token) >= await f.d.accountedBalance(token));
}

test('starts disabled; only the owner can allow assets, destinations or plans', async t => {
  const f = await fixture(t);
  assert.equal(await f.d.planningEnabled(), false);
  await send(f.d.deposit(f.token.target, e('100')));
  await assert.rejects(plan(f, f.token.target, [f.alice.address], [e('10')]));
  await assert.rejects(f.d.connect(f.alice).setPlanningEnabled(true));
  await assert.rejects(f.d.connect(f.alice).setSupportedAsset(f.token.target, false));
  await assert.rejects(f.d.connect(f.alice).setDestination(f.alice.address, 0, true));
  await send(f.d.setPlanningEnabled(true));
  await assert.rejects(f.d.connect(f.alice).createPlan(f.token.target, 0, ZeroHash, [f.alice.address], [e('10')], [0]));
  await assert.rejects(plan(f, f.token.target, [f.publicCaller.address], [e('10')]));
  await assert.rejects(plan(f, f.token.target, [f.alice.address], [e('101')]));
  await assert.rejects(plan(f, f.token.target, [f.alice.address], [0n]));
  await reconcile(f, f.token.target);
});

test('actual taxed deposits and direct transfers are never recorded twice or self-labeled as revenue', async t => {
  const f = await fixture(t);
  await send(f.token.setFee(1000, false));
  await send(f.d.deposit(f.token.target, e('100')));
  assert.equal(await f.d.accountedBalance(f.token.target), e('90'));
  await send(f.token.transfer(f.d.target, e('10')));
  await send(f.d.connect(f.publicCaller).sync(f.token.target));
  await send(f.d.connect(f.publicCaller).sync(f.token.target));
  assert.equal(await f.d.accountedBalance(f.token.target), e('99'));
  await assert.rejects(f.d.connect(f.alice).classify(f.token.target, e('50'), 2, ZeroHash));
  await send(f.d.classify(f.token.target, e('50'), 1, id('seed fees')));
  assert.equal(await f.d.unallocated(f.token.target, 1), e('50'));
  assert.equal(await f.d.unallocated(f.token.target, 2), 0n);
  await assert.rejects(f.d.classify(f.token.target, e('50'), 2, ZeroHash));
  await send(f.d.setPlanningEnabled(true));
  const n = await plan(f, f.token.target, [f.alice.address], [e('50')], [0], 1);
  await advance(f.rpc, 3600);
  await send(f.d.connect(f.publicCaller).claim(n, 0));
  assert.equal(await f.token.balanceOf(f.alice.address), e('45'));
  assert.equal(await f.d.accountedBalance(f.token.target), e('49'));
  await reconcile(f, f.token.target);
});

test('immutable reservations, delayed cancellation, independent claims, and no replay', async t => {
  const f = await fixture(t);
  await send(f.d.deposit(f.token.target, e('100')));
  await send(f.d.setPlanningEnabled(true));
  const canceled = await plan(f, f.token.target, [f.alice.address], [e('30')]);
  await send(f.d.cancelPlan(canceled));
  await assert.rejects(f.d.claim(canceled, 0));
  const n = await plan(f, f.token.target, [f.alice.address, f.bob.address], [e('30'), e('40')]);
  assert.equal(await f.d.reservedBalance(f.token.target), e('70'));
  await assert.rejects(plan(f, f.token.target, [f.alice.address], [e('31')]));
  await assert.rejects(f.d.claim(n, 0));
  await advance(f.rpc, 3600);
  await assert.rejects(f.d.cancelPlan(n));
  // Administrative changes apply to new plans only; fixed old claims survive.
  await send(f.d.setDestination(f.alice.address, 0, false));
  await send(f.d.setSupportedAsset(f.token.target, false));
  await send(f.d.setPlanningEnabled(false));
  await send(f.d.connect(f.publicCaller).claim(n, 1));
  await send(f.d.connect(f.publicCaller).claim(n, 0));
  await assert.rejects(f.d.claim(n, 0));
  await assert.rejects(f.d.claim(n, 2));
  assert.equal(await f.token.balanceOf(f.alice.address), e('30'));
  assert.equal(await f.token.balanceOf(f.bob.address), e('40'));
  assert.equal((await f.d.plans(n)).remaining, 0n);
  await reconcile(f, f.token.target);
});

test('rejecting native recipient rolls back only its claim and preserves other recipients', async t => {
  const f = await fixture(t);
  const reject = await deploy('RejectNative', f.owner);
  await send(f.d.setDestination(reject.target, 0, true));
  await send(f.d.deposit(ZeroAddress, e('2'), { value: e('2') }));
  await send(f.owner.sendTransaction({ to: f.d.target, value: e('1') }));
  await send(f.d.sync(ZeroAddress));
  await send(f.d.setPlanningEnabled(true));
  const n = await plan(f, ZeroAddress, [reject.target, f.bob.address], [e('1'), e('2')]);
  await advance(f.rpc, 3600);
  await assert.rejects(send(f.d.claim(n, 0, { gasLimit: 500000 })));
  assert.equal((await f.d.getAllocation(n, 0)).claimed, false);
  await send(f.d.connect(f.publicCaller).claim(n, 1));
  assert.equal(await f.d.reservedBalance(ZeroAddress), e('1'));
  assert.equal(await f.d.actualBalance(ZeroAddress), e('1'));
  await reconcile(f, ZeroAddress);
});

test('balance deficits and sender-extra-tax cannot drain another allocation', async t => {
  const f = await fixture(t);
  await send(f.d.deposit(f.token.target, e('100')));
  await send(f.d.setPlanningEnabled(true));
  const n = await plan(f, f.token.target, [f.alice.address, f.bob.address], [e('40'), e('50')]);
  await advance(f.rpc, 3600);
  await send(f.token.confiscate(f.d.target, e('1')));
  await assert.rejects(f.d.sync(f.token.target));
  await assert.rejects(f.d.claim(n, 0));
  await assert.rejects(plan(f, f.token.target, [f.alice.address], [e('1')]));
  await send(f.token.mint(f.d.target, e('1')));
  await send(f.token.setFee(1000, true));
  await assert.rejects(send(f.d.claim(n, 0, { gasLimit: 500000 })));
  assert.equal((await f.d.getAllocation(n, 0)).claimed, false);
  assert.equal(await f.token.balanceOf(f.alice.address), 0n);
  assert.equal(await f.d.reservedBalance(f.token.target), e('90'));
  await send(f.token.setFee(0, false));
  await send(f.d.claim(n, 0));
  await send(f.d.claim(n, 1));
  await reconcile(f, f.token.target);
});

test('fixed FarmReward delivery funds the real JackFarm and clears approval', async t => {
  const f = await fixture(t);
  const paired = await deploy('TestToken', f.owner);
  const lp = await deploy('TestToken', f.owner);
  const treasury = await deploy('TestTreasury', f.owner);
  const farm = await deploy('JackFarm', f.owner, [f.token.target, treasury.target]);
  await send(farm.addPool(lp.target, paired.target, e('100'), false));
  await send(f.d.setDestination(farm.target, 1, true));
  await send(f.d.deposit(f.token.target, e('100')));
  await send(f.d.setPlanningEnabled(true));
  const n = await plan(f, f.token.target, [farm.target], [e('100')], [1]);
  await advance(f.rpc, 3600);
  await send(f.d.connect(f.publicCaller).claim(n, 0));
  assert.equal(await farm.reservedRewards(f.token.target), e('100'));
  assert.equal(await f.token.allowance(f.d.target, farm.target), 0n);
  await reconcile(f, f.token.target);
});

test('live-style JACK transfer fees and Treasury accounting work through the distributor', async t => {
  const f = await fixture(t);
  const jack = await deploy('JackToken', f.owner);
  const treasury = await deploy('JackTreasury', f.owner, [jack.target, ZeroAddress, [f.token.target]]);
  await send(jack.setTreasury(treasury.target));
  await send(f.d.setSupportedAsset(jack.target, true));
  await send(jack.approve(f.d.target, e('10000')));
  const preview = await jack.previewFee(e('10000'));
  await send(f.d.deposit(jack.target, e('10000')));
  assert.equal(await f.d.accountedBalance(jack.target), preview.netAmount);
  assert.equal(await jack.balanceOf(treasury.target), preview.treasuryAmount);
  await send(f.d.setPlanningEnabled(true));
  const n = await plan(f, jack.target, [f.alice.address], [e('100')]);
  await advance(f.rpc, 3600);
  const claimPreview = await jack.previewFee(e('100'));
  await send(f.d.connect(f.publicCaller).claim(n, 0));
  assert.equal(await jack.balanceOf(f.alice.address), claimPreview.netAmount);
  await reconcile(f, jack.target);
});

test('JackStake fees arrive directly and sync as unclassified funds', async t => {
  const f = await fixture(t);
  const ext = await deploy('TestToken', f.owner);
  const treasury = await deploy('TestTreasury', f.owner);
  const stake = await deploy('JackStake', f.owner, [f.token.target, treasury.target, f.bob.address, f.d.target, f.d.target]);
  await send(stake.addPool([ext.target, ZeroAddress]));
  await send(ext.mint(f.alice.address, e('100')));
  await send(ext.connect(f.alice).approve(stake.target, e('100')));
  await send(stake.connect(f.alice).stakeExternalToken(ext.target, e('100')));
  await send(f.token.approve(stake.target, e('1000')));
  await send(stake.injectExternalStakersReward(e('1000')));
  await send(f.token.mint(f.alice.address, e('100')));
  await send(f.token.connect(f.alice).approve(stake.target, e('100')));
  await send(stake.connect(f.alice).stakeJackToken(e('100')));
  await send(stake.injectJackStakersReward(ZeroAddress, e('1'), { value: e('1') }));
  await advance(f.rpc, 86400);
  await send(stake.updateExternalPool(ext.target));
  await send(stake.updateJackRewardToken(ZeroAddress));
  await send(f.d.connect(f.publicCaller).sync(f.token.target));
  await send(f.d.connect(f.publicCaller).sync(ZeroAddress));
  assert.equal(await f.d.unallocated(f.token.target, 0), e('1000') * 140n / 1000000n * 200n / 1000n);
  assert.equal(await f.d.unallocated(ZeroAddress, 0), e('1') * 140n / 1000000n * 100n / 1000n);
  await reconcile(f, f.token.target);
  await reconcile(f, ZeroAddress);
});

test('native callback cannot claim another allocation', async t => {
  const f = await fixture(t);
  const receiver = await deploy('ReenterNative', f.owner);
  await send(f.d.setDestination(receiver.target, 0, true));
  await send(f.d.deposit(ZeroAddress, e('2'), { value: e('2') }));
  await send(f.d.setPlanningEnabled(true));
  const n = await plan(f, ZeroAddress, [receiver.target, f.bob.address], [e('1'), e('1')]);
  await send(receiver.configure(f.d.target, f.d.interface.encodeFunctionData('claim', [n, 1])));
  await advance(f.rpc, 3600);
  await send(f.d.claim(n, 0));
  assert.equal(await receiver.attempted(), true);
  assert.equal(await receiver.succeeded(), false);
  assert.equal((await f.d.getAllocation(n, 1)).claimed, false);
  await reconcile(f, ZeroAddress);
});

test('a destination cannot claim delivery without actually spending its reserved amount', async t => {
  const f = await fixture(t);
  const fakeFarm = await deploy('NoPullFarm', f.owner);
  await send(f.d.setDestination(fakeFarm.target, 1, true));
  await send(f.d.deposit(f.token.target, e('100')));
  await send(f.d.setPlanningEnabled(true));
  const n = await plan(f, f.token.target, [fakeFarm.target, f.bob.address], [e('60'), e('40')], [1, 0]);
  await advance(f.rpc, 3600);
  await assert.rejects(send(f.d.claim(n, 0, { gasLimit: 500000 })));
  assert.equal((await f.d.getAllocation(n, 0)).claimed, false);
  assert.equal(await f.token.allowance(f.d.target, fakeFarm.target), 0n);
  await send(f.d.claim(n, 1));
  assert.equal(await f.d.reservedBalance(f.token.target), e('60'));
  await reconcile(f, f.token.target);
});
