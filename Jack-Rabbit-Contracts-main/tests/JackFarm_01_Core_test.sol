// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "remix_tests.sol";
import "remix_accounts.sol";
import "../contracts/JackFarm.sol";
import "../contracts/testHelpers/MockERC20.sol";

contract JackFarm_01_Core_Test {
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
    }

    function test01InitialDeploymentValues() public {
        Assert.equal(farm.jack(), address(jack), "JACK address should be correct");
        Assert.equal(farm.treasury(), treasury, "Treasury address should be correct");
        Assert.equal(farm.protocolFeeBps(), 500, "Default protocol fee should be 5%");
        Assert.equal(farm.runningPoolCount(), 0, "Running pool count should start at zero");
        Assert.ok(farm.acceptedRewardToken(address(jack)), "JACK should be accepted by default");
    }

    function test02AddPools() public {
        uint256 pool0 = farm.addPool(
            address(lpJackPlsx),
            address(plsx),
            1_000 * ONE,
            true
        );

        uint256 pool1 = farm.addPool(
            address(lpJackPdai),
            address(pdai),
            2_000 * ONE,
            true
        );

        Assert.equal(pool0, 0, "First pool id should be 0");
        Assert.equal(pool1, 1, "Second pool id should be 1");

        Assert.equal(farm.runningPoolCount(), 2, "Running pool count should be 2");

        Assert.ok(farm.acceptedRewardToken(address(plsx)), "PLSX should be accepted");
        Assert.ok(farm.acceptedRewardToken(address(pdai)), "pDAI should be accepted");

        Assert.equal(farm.activePoolForRewardToken(address(plsx)), 1, "PLSX should map to pool 0 plus one");
        Assert.equal(farm.activePoolForRewardToken(address(pdai)), 2, "pDAI should map to pool 1 plus one");

        JackFarm.PoolInfo memory p0 = farm.getPool(0);
        JackFarm.PoolInfo memory p1 = farm.getPool(1);

        Assert.equal(p0.lpToken, address(lpJackPlsx), "Pool 0 LP token should be correct");
        Assert.equal(p0.pairedRewardToken, address(plsx), "Pool 0 reward token should be PLSX");
        Assert.equal(p0.rewardDurationDays, 30, "Pool 0 default duration should be 30 days");
        Assert.equal(uint256(p0.status), uint256(JackFarm.PoolStatus.Active), "Pool 0 should be active");

        Assert.equal(p1.lpToken, address(lpJackPdai), "Pool 1 LP token should be correct");
        Assert.equal(p1.pairedRewardToken, address(pdai), "Pool 1 reward token should be pDAI");
        Assert.equal(p1.rewardDurationDays, 30, "Pool 1 default duration should be 30 days");
        Assert.equal(uint256(p1.status), uint256(JackFarm.PoolStatus.Active), "Pool 1 should be active");
    }

    function test03DepositLpTakesFivePercentFee() public {
        uint256 depositAmount = 100 * ONE;

        uint256 treasuryBefore = lpJackPlsx.balanceOf(treasury);

        farm.deposit(0, depositAmount);

        uint256 treasuryAfter = lpJackPlsx.balanceOf(treasury);

        JackFarm.PoolInfo memory p0 = farm.getPool(0);

        Assert.equal(treasuryAfter - treasuryBefore, 5 * ONE, "Treasury should receive 5 LP");
        Assert.equal(p0.totalStaked, 95 * ONE, "Farm should stake 95 LP");
    }

    function test04PoolPauseBlocksDeposit() public {
        farm.setPoolPaused(1, true);

        JackFarm.PoolInfo memory pausedPool = farm.getPool(1);
        Assert.equal(uint256(pausedPool.status), uint256(JackFarm.PoolStatus.Paused), "Pool should be paused");

        bool failed;

        try farm.deposit(1, 10 * ONE) {
            failed = false;
        } catch {
            failed = true;
        }

        Assert.ok(failed, "Deposit into paused pool should fail");

        farm.setPoolPaused(1, false);

        JackFarm.PoolInfo memory activePool = farm.getPool(1);
        Assert.equal(uint256(activePool.status), uint256(JackFarm.PoolStatus.Active), "Pool should be active again");
    }

    function test05FarmPauseBlocksDeposit() public {
        farm.setFarmDepositsPaused(true);

        bool failed;

        try farm.deposit(1, 10 * ONE) {
            failed = false;
        } catch {
            failed = true;
        }

        Assert.ok(failed, "Deposit should fail when farm deposits are paused");

        farm.setFarmDepositsPaused(false);

        uint256 beforeStake = farm.getPool(1).totalStaked;

        farm.deposit(1, 100 * ONE);

        uint256 afterStake = farm.getPool(1).totalStaked;

        Assert.equal(afterStake - beforeStake, 95 * ONE, "Deposit should work after unpause");
    }
}