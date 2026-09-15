// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "remix_tests.sol";
import "remix_accounts.sol";
import "../contracts/JackFarm.sol";
import "../contracts/testHelpers/MockERC20.sol";

contract JackFarm_03_EndPool_Test {
    uint256 constant ONE = 1e18;

    JackFarm farm;

    MockERC20 jack;
    MockERC20 plsx;
    MockERC20 pdai;

    MockERC20 lpJackPlsx;
    MockERC20 lpJackPdai;

    address treasury;

    function beforeAll() public {
        treasury = TestsAccounts.getAccount(1);

        jack = new MockERC20("Jack Rabbit", "JACK");
        plsx = new MockERC20("PulseX", "PLSX");
        pdai = new MockERC20("pDAI", "pDAI");

        lpJackPlsx = new MockERC20("JACK-PLSX LP", "JACKPLSX-LP");
        lpJackPdai = new MockERC20("JACK-pDAI LP", "JACKPDAI-LP");

        farm = new JackFarm(address(jack), treasury);

        uint256 bigAmount = 10_000_000 * ONE;

        jack.mint(address(this), bigAmount);
        plsx.mint(address(this), bigAmount);
        pdai.mint(address(this), bigAmount);

        lpJackPlsx.mint(address(this), bigAmount);
        lpJackPdai.mint(address(this), bigAmount);

        jack.approve(address(farm), type(uint256).max);
        plsx.approve(address(farm), type(uint256).max);
        pdai.approve(address(farm), type(uint256).max);

        lpJackPlsx.approve(address(farm), type(uint256).max);
        lpJackPdai.approve(address(farm), type(uint256).max);

        farm.addPool(address(lpJackPlsx), address(plsx), 1_000 * ONE, true);
        farm.addPool(address(lpJackPdai), address(pdai), 2_000 * ONE, true);

        farm.deposit(0, 100 * ONE);

        farm.depositReward(address(jack), 300 * ONE);
        farm.depositReward(address(plsx), 1_000 * ONE);
    }

    function test01EndPoolMovesFutureRewardsToTreasury() public {
        JackFarm.PoolInfo memory beforePool = farm.getPool(0);

        uint256 jackReservedBefore = beforePool.jackStream.reserved;
        uint256 plsxReservedBefore = beforePool.pairedStream.reserved;

        uint256 treasuryJackBefore = jack.balanceOf(treasury);
        uint256 treasuryPlsxBefore = plsx.balanceOf(treasury);

        farm.endPool(0);

        JackFarm.PoolInfo memory p0 = farm.getPool(0);

        Assert.equal(uint256(p0.status), uint256(JackFarm.PoolStatus.Ended), "Pool should be ended");
        Assert.equal(farm.runningPoolCount(), 1, "Running pool count should reduce to 1");
        Assert.equal(farm.activePoolForRewardToken(address(plsx)), 0, "PLSX active pool mapping should be cleared");

        Assert.equal(p0.jackStream.rewardRate, 0, "JACK reward rate should stop");
        Assert.equal(p0.pairedStream.rewardRate, 0, "Paired reward rate should stop");

        Assert.ok(p0.jackStream.reserved <= jackReservedBefore, "JACK reserved should not increase");
        Assert.ok(p0.pairedStream.reserved <= plsxReservedBefore, "PLSX reserved should not increase");

        Assert.ok(jack.balanceOf(treasury) > treasuryJackBefore, "Treasury should receive future JACK rewards");
        Assert.ok(plsx.balanceOf(treasury) > treasuryPlsxBefore, "Treasury should receive future PLSX rewards");
    }

    function test02EndedPoolRejectsNewDeposits() public {
        bool failed;

        try farm.deposit(0, 10 * ONE) {
            failed = false;
        } catch {
            failed = true;
        }

        Assert.ok(failed, "Deposit into ended pool should fail");
    }

    function test03EndedPoolAllowsWithdraw() public {
        JackFarm.PoolInfo memory beforeWithdraw = farm.getPool(0);

        Assert.equal(beforeWithdraw.totalStaked, 95 * ONE, "Pool should still hold user's LP stake");

        farm.withdraw(0, 95 * ONE);

        JackFarm.PoolInfo memory afterWithdraw = farm.getPool(0);

        Assert.equal(afterWithdraw.totalStaked, 0, "User should withdraw LP from ended pool");
    }

    function test04EndedPoolRewardGoesToTreasuryOnSync() public {
        uint256 directAmount = 100 * ONE;

        uint256 treasuryBefore = plsx.balanceOf(treasury);

        plsx.transfer(address(farm), directAmount);
        farm.syncRewardToken(address(plsx));

        uint256 treasuryAfter = plsx.balanceOf(treasury);

        Assert.equal(treasuryAfter - treasuryBefore, directAmount, "PLSX for ended pool should go to Treasury");
    }

    function test05EndedEmptyPoolCanBeMarkedRemoved() public {
        farm.markPoolRemoved(0);

        JackFarm.PoolInfo memory p0 = farm.getPool(0);

        Assert.equal(uint256(p0.status), uint256(JackFarm.PoolStatus.Removed), "Pool should be marked removed");
    }

    function test06ReAddingSamePoolCreatesNewEpoch() public {
        uint256 newPoolId = farm.addPool(
            address(lpJackPlsx),
            address(plsx),
            2_500 * ONE,
            true
        );

        JackFarm.PoolInfo memory newPool = farm.getPool(newPoolId);

        Assert.equal(newPool.epoch, 2, "Re-added pool should have epoch 2");
        Assert.equal(uint256(newPool.status), uint256(JackFarm.PoolStatus.Active), "Re-added pool should be active");
        Assert.equal(farm.activePoolForRewardToken(address(plsx)), newPoolId + 1, "PLSX should map to new active pool");
    }

    function test07JackRewardAfterEndOnlyGoesToRunningPools() public {
        uint256 pool1JackBefore = farm.getPool(1).jackStream.reserved;

        farm.depositReward(address(jack), 100 * ONE);

        JackFarm.PoolInfo memory p1 = farm.getPool(1);

        Assert.ok(p1.jackStream.reserved > pool1JackBefore, "Running pool should receive JACK");
    }
}