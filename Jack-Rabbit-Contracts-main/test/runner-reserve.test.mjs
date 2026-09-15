import test from 'node:test';
import assert from 'node:assert/strict';
import { ZeroAddress, MaxUint256 } from 'ethers';
import { chain, deploy, send, advance } from './support.mjs';

async function setup(t) {
  const c = await chain(); t.after(c.close);
  const [owner, bot, other] = c.signers;
  const token = await deploy('TestToken', owner);
  const d = await deploy('JackRevenueDistributor', owner, [owner.address, 3600]);
  const reserve = await deploy('JackPegReserve', owner, [owner.address, d.target, 3600]);
  for (const asset of [ZeroAddress, token.target]) {
    await send(d.setSupportedAsset(asset, true));
    await send(reserve.setSupportedAsset(asset, true));
  }
  return { ...c, owner, bot, other, token, d, reserve };
}

test('reserve isolates capital and returns only to distributor after delay, with tax accounting', async t => {
  const f = await setup(t);
  await send(f.token.mint(f.reserve.target, 1000));
  await send(f.reserve.connect(f.bot).sync(f.token.target));
  assert.equal(await f.reserve.tradingEnabled(), false);
  await assert.rejects(f.reserve.connect(f.bot).queueReturn(f.token.target, 1));
  await send(f.reserve.queueReturn(f.token.target, 1000));
  await assert.rejects(f.reserve.queueReturn(f.token.target, 1));
  await assert.rejects(f.reserve.executeReturn(0));
  await send(f.token.setFee(1000, false));
  await advance(f.rpc, 3600);
  await send(f.reserve.connect(f.bot).executeReturn(0));
  assert.equal(await f.d.unallocated(f.token.target, 0), 900n);
  assert.equal(await f.reserve.accountedBalance(f.token.target), 0n);
  assert.equal(await f.reserve.reservedBalance(f.token.target), 0n);
  await assert.rejects(f.reserve.executeReturn(0));
});

test('reserve cancellation, deficits and failed returns preserve accounting', async t => {
  const f = await setup(t);
  await send(f.owner.sendTransaction({ to: f.reserve.target, value: 1000 }));
  await send(f.reserve.sync(ZeroAddress));
  await send(f.reserve.queueReturn(ZeroAddress, 1000));
  await send(f.reserve.cancelReturn(0));
  await send(f.reserve.queueReturn(ZeroAddress, 1000));
  await advance(f.rpc, 3600);
  await send(f.d.setSupportedAsset(ZeroAddress, false));
  await assert.rejects(f.reserve.executeReturn(1));
  assert.equal(await f.reserve.accountedBalance(ZeroAddress), 1000n);
  await send(f.d.setSupportedAsset(ZeroAddress, true));
  await send(f.reserve.executeReturn(1));
  assert.equal(await f.d.accountedBalance(ZeroAddress), 1000n);
  await send(f.token.mint(f.reserve.target, 1000));
  await send(f.reserve.sync(f.token.target));
  await send(f.reserve.queueReturn(f.token.target, 500));
  await send(f.token.confiscate(f.reserve.target, 1));
  await advance(f.rpc, 3600);
  await assert.rejects(f.reserve.executeReturn(2));
  await assert.rejects(f.reserve.sync(f.token.target));
  await send(f.token.mint(f.reserve.target, 1));
  await send(f.token.setFee(1000, true));
  await assert.rejects(f.reserve.executeReturn(2));
  assert.equal(await f.reserve.accountedBalance(f.token.target), 1000n);
});

async function runnerSetup(t) {
  const f = await setup(t);
  const oracle = await deploy('JackOracleHub', f.owner, [f.token.target, f.other.address, f.owner.address]);
  const pair = await deploy('MaintenancePair', f.owner, [f.token.target, f.other.address]);
  await send(oracle.addTrackedPair(pair.target, 1, 1, 60, 3600, 1000, 10000));
  const runner = await deploy('JackRunner', f.owner, [f.owner.address, oracle.target]);
  await send(runner.configureJob(pair.target, true, 100, 60));
  await send(f.owner.sendTransaction({ to: runner.target, value: 250 }));
  return { ...f, oracle, pair, runner };
}
const run = f => f.runner.connect(f.bot).maintainOracle(f.pair.target, 100, MaxUint256);

test('Runner pays real oracle progress once, preserves cooldown through edits and escrows pull rewards', async t => {
  const f = await runnerSetup(t);
  await advance(f.rpc, 60);
  await assert.rejects(run(f));
  await assert.rejects(f.runner.connect(f.bot).configure(true, 200));
  await send(f.runner.configure(true, 200));
  await send(run(f));
  assert.equal(await f.runner.rewardCredits(f.bot.address), 100n);
  assert.equal(await f.runner.availableBudget(), 150n);
  await send(f.runner.configureJob(f.pair.target, true, 100, 60));
  await assert.rejects(run(f));
  const rejecting = await deploy('RejectNative', f.owner);
  await assert.rejects(f.runner.connect(f.bot).claimReward(rejecting.target));
  assert.equal(await f.runner.totalRewardCredits(), 100n);
  const reenter = await deploy('ReenterNative', f.owner);
  await send(reenter.configure(f.runner.target, f.runner.interface.encodeFunctionData('claimReward', [f.other.address])));
  await send(f.runner.connect(f.bot).claimReward(reenter.target));
  assert.equal(await reenter.succeeded(), false);
  assert.equal(await f.runner.totalRewardCredits(), 0n);
  await assert.rejects(f.runner.connect(f.bot).claimReward(f.bot.address));
});

test('daily caps, unfunded work, external updates and paused oracle cannot create unsecured rewards', async t => {
  const f = await runnerSetup(t);
  await send(f.runner.configure(true, 100));
  await advance(f.rpc, 60);
  await send(run(f));
  await advance(f.rpc, 60);
  await assert.rejects(run(f));
  await send(f.runner.connect(f.bot).maintainOracle(f.pair.target, 0, MaxUint256));
  assert.equal(await f.runner.totalRewardCredits(), 100n);
  await send(f.runner.configure(false, 100));
  await send(f.runner.configure(true, 100));
  await advance(f.rpc, 60);
  await assert.rejects(run(f));
  await advance(f.rpc, 86400);
  await send(f.oracle.updatePairIfNeeded(f.pair.target));
  await assert.rejects(run(f));
  await advance(f.rpc, 60);
  await send(f.oracle.pause());
  await assert.rejects(run(f));
  await send(f.oracle.unpause());
  await send(run(f));
  assert.equal(await f.runner.totalRewardCredits(), 200n);
  await advance(f.rpc, 86400);
  await assert.rejects(run(f));
  await send(f.runner.connect(f.bot).maintainOracle(f.pair.target, 0, MaxUint256));
  assert.equal(await f.runner.availableBudget(), 50n);
});
