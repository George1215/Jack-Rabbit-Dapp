import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEther as e, ZeroAddress } from 'ethers';
import { chain, deploy, send, advance } from './support.mjs';

test('Barrow quotes and opens bonds at anchor and intermediate vesting terms', async t => {
  const c = await chain(); t.after(c.close);
  const [owner] = c.signers;
  const jack = await deploy('TestToken', owner);
  const pdai = await deploy('TestToken', owner);
  const treasury = await deploy('TestTreasury', owner);
  const oracle = await deploy('TestOracle', owner);
  await send(treasury.setPdai(pdai.target));
  const barrow = await deploy('JackBarrow', owner, [pdai.target, jack.target, treasury.target, oracle.target, owner.address]);
  await send(jack.mint(owner.address, e('100000')));
  await send(jack.approve(barrow.target, e('100000')));
  await send(barrow.seedJack(e('100000')));
  await send(pdai.mint(owner.address, e('10000')));
  await send(pdai.approve(barrow.target, e('10000')));
  for (const seconds of [90*86400, 90*86400+1, 180*86400, 365*86400-1, 365*86400, 500*86400, 730*86400, 1000*86400, 1825*86400-1, 1825*86400]) {
    const q = await barrow.quoteBond(e('100'), seconds);
    assert(q.feeBps >= 320n && q.feeBps <= 800n);
    assert(q.netPdai + q.feePdai === e('100'));
    const id = await barrow.nextTokenId();
    await send(barrow.openBond(e('100'), seconds, q.baseJack, 30));
    const bond = await barrow.bonds(id);
    // Treasury reserve changes can slightly change environment rounding between openings;
    // the immediately preceding quote must still match the opened bond.
    assert.equal(bond.baseJack, q.baseJack);
    assert.equal(bond.rewardJack, q.rewardJack);
  }
  await assert.rejects(barrow.quoteBond(e('100'), 90*86400-1));
  await assert.rejects(barrow.quoteBond(e('100'), 1825*86400+1));
});

async function stakeFixture(c) {
  const [owner, user, jackFee, extFee, sink] = c.signers;
  const jack = await deploy('TestToken', owner);
  const ext = await deploy('TestToken', owner);
  const treasury = await deploy('TestTreasury', owner);
  const stake = await deploy('JackStake', owner, [jack.target, treasury.target, sink.address, jackFee.address, extFee.address]);
  await send(stake.addPool([ext.target, ZeroAddress]));
  await send(jack.mint(owner.address, e('100000')));
  await send(jack.mint(user.address, e('100')));
  await send(ext.mint(user.address, e('100')));
  await send(ext.mint(owner.address, e('100000')));
  await send(jack.approve(stake.target, e('100000')));
  await send(ext.approve(stake.target, e('100000')));
  await send(jack.connect(user).approve(stake.target, e('100')));
  await send(ext.connect(user).approve(stake.target, e('100')));
  await send(stake.connect(user).stakeExternalToken(ext.target, e('100')));
  await send(stake.connect(user).stakeJackToken(e('100')));
  await send(stake.injectExternalStakersReward(e('10000')));
  await send(stake.injectJackStakersReward(ext.target, e('10000')));
  await send(stake.injectJackStakersReward(ZeroAddress, e('10'), { value: e('10') }));
  return { owner, user, jackFee, extFee, stake, jack, ext };
}

for (const setter of ['setRewardFeeBps', 'setJackRewardFeeBp', 'setExternalRewardFeeBp']) {
  test(`${setter}: preserves fees earned before the configuration change`, async t => {
    const c = await chain(); t.after(c.close);
    const f = await stakeFixture(c);
    const extReserve = await f.stake.getRewardStreamReserve(f.ext.target);
    await advance(c.rpc, 86400);
    if (setter === 'setRewardFeeBps') await send(f.stake[setter](400, 300));
    else await send(f.stake[setter](setter === 'setJackRewardFeeBp' ? 400 : 300));
    await send(f.stake.updateExternalPool(f.ext.target));
    await send(f.stake.updateJackRewardToken(f.ext.target));
    await send(f.stake.updateJackRewardToken(ZeroAddress));
    assert.equal(await f.jack.balanceOf(f.jackFee.address), e('10000') * 140n / 1000000n * 200n / 1000n);
    assert.equal(await f.ext.balanceOf(f.extFee.address), extReserve * 140n / 1000000n * 100n / 1000n);
    const nativeBalance = BigInt(await c.rpc.request({ method: 'eth_getBalance', params: [f.extFee.address, 'latest'] }));
    assert.equal(nativeBalance, e('1000') + e('10') * 140n / 1000000n * 100n / 1000n);

    const remainingJack = await f.stake.externalJackRewardReserve();
    const remainingExt = await f.stake.getRewardStreamReserve(f.ext.target);
    const beforeJ = await f.jack.balanceOf(f.jackFee.address);
    const beforeE = await f.ext.balanceOf(f.extFee.address);
    await advance(c.rpc, 86400);
    await send(f.stake.updateExternalPool(f.ext.target));
    await send(f.stake.updateJackRewardToken(f.ext.target));
    const nextJackFee = setter === 'setExternalRewardFeeBp' ? 200n : 400n;
    const nextExtFee = setter === 'setJackRewardFeeBp' ? 100n : 300n;
    assert.equal(await f.jack.balanceOf(f.jackFee.address) - beforeJ, remainingJack * 140n / 1000000n * nextJackFee / 1000n);
    assert.equal(await f.ext.balanceOf(f.extFee.address) - beforeE, remainingExt * 140n / 1000000n * nextExtFee / 1000n);
  });
}

test('fee settlement rejects native-recipient reentry into public reward updates', async t => {
  const c = await chain(); t.after(c.close);
  const f = await stakeFixture(c);
  const receiver = await deploy('ReenterNative', f.owner);
  await send(receiver.configure(f.stake.target, f.stake.interface.encodeFunctionData('updateJackRewardToken', [ZeroAddress])));
  await send(f.stake.setExternalFeeRewardRecipient(receiver.target));
  await advance(c.rpc, 86400);
  await send(f.stake.setExternalRewardFeeBp(300));
  assert.equal(await receiver.attempted(), true);
  assert.equal(await receiver.succeeded(), false);
  assert.equal(await f.stake.getRewardStreamReserve(ZeroAddress), e('10') - e('10') * 140n / 1000000n);
});

test('fee changes remain usable with empty, inactive and paused pools; withdrawal stays available', async t => {
  const c = await chain(); t.after(c.close);
  const f = await stakeFixture(c);
  await send(f.stake.setExternalPoolActive(f.ext.target, false));
  await send(f.stake.pause());
  await advance(c.rpc, 86400);
  await send(f.stake.setRewardFeeBps(400, 300));
  assert.equal(await f.stake.externalJackRewardReserve(), e('10000'));
  assert.equal(await f.stake.jackRewardFeeBp(), 400n);
  assert.equal(await f.stake.externalRewardFeeBp(), 300n);
  await send(f.stake.connect(f.user).unstakeExternalToken(f.ext.target, e('95')));
  await send(f.stake.connect(f.user).unstakeJackToken(e('95')));
  await advance(c.rpc, 86400);
  await send(f.stake.setRewardFeeBps(200, 100));
  assert.equal(await f.stake.totalStakedJack(), 0n);
  assert.equal(await f.stake.totalStakedExternal(f.ext.target), 0n);
});

test('zero-rounded emissions still checkpoint the fee boundary', async t => {
  const c = await chain(); t.after(c.close);
  const [owner, user, jackFee, extFee, sink] = c.signers;
  const jack = await deploy('TestToken', owner);
  const ext = await deploy('TestToken', owner);
  const treasury = await deploy('TestTreasury', owner);
  const stake = await deploy('JackStake', owner, [jack.target, treasury.target, sink.address, jackFee.address, extFee.address]);
  await send(stake.addPool([ext.target]));
  await send(jack.mint(owner.address, 101));
  await send(ext.mint(owner.address, 100));
  await send(jack.approve(stake.target, 101));
  await send(ext.approve(stake.target, 100));
  await send(stake.stakeExternalToken(ext.target, 100));
  await send(stake.stakeJackToken(100));
  await send(stake.injectExternalStakersReward(1));
  await advance(c.rpc, 100);
  const receipt = await send(stake.setRewardFeeBps(400, 300));
  const block = await c.provider.getBlock(receipt.blockNumber);
  assert.equal(await stake.lastExternalRewardUpdate(), BigInt(block.timestamp));
  assert.equal((await stake.getJackRewardStreamInfo(ext.target)).lastUpdate, BigInt(block.timestamp));
  assert.equal(await stake.externalJackRewardReserve(), 1n);
  assert.equal(await jack.balanceOf(jackFee.address), 0n);
});
