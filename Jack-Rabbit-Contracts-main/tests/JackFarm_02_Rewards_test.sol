// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "remix_tests.sol";
import "remix_accounts.sol";
import "../contracts/JackFarm.sol";
import "../contracts/testHelpers/MockERC20.sol";

contract JackFarm_02_Rewards_Test {
    uint256 constant ONE = 1e18;

    JackFarm farm;

    MockERC20 jack;
    MockERC20 plsx;
    MockERC20 pdai;
    MockERC20 randomToken;

    MockERC20 lpJackPlsx;
    MockERC20 lpJackPdai;

    FeeOnTransferERC20 feeReward;
    MockERC20 lpFeeReward;

    address treasury;
    address feeReceiver;

    function beforeAll() public {
        treasury = TestsAccounts.getAccount(1);
        feeReceiver = TestsAccounts.getAccount(2);

        jack = new MockERC20("Jack Rabbit", "JACK");
        plsx = new MockERC20("PulseX", "PLSX");
        pdai = new MockERC20("pDAI", "pDAI");
        randomToken = new MockERC20("Random", "RND");

        lpJackPlsx = new MockERC20("JACK-PLSX LP", "JACKPLSX-LP");
        lpJackPdai = new MockERC20("JACK-pDAI LP", "JACKPDAI-LP");

        feeReward = new FeeOnTransferERC20("Fee Reward", "FEE", 1_000, feeReceiver);
        lpFeeReward = new MockERC20("JACK-FEE LP", "JACKFEE-LP");

        farm = new JackFarm(address(jack), treasury);

        uint256 bigAmount = 10_000_000 * ONE;

        jack.mint(address(this), bigAmount);
        plsx.mint(address(this), bigAmount);
        pdai.mint(address(this), bigAmount);
        randomToken.mint(address(this), bigAmount);

        lpJackPlsx.mint(address(this), bigAmount);
        lpJackPdai.mint(address(this), bigAmount);

        feeReward.mint(address(this), bigAmount);
        lpFeeReward.mint(address(this), bigAmount);

        jack.approve(address(farm), type(uint256).max);
        plsx.approve(address(farm), type(uint256).max);
        pdai.approve(address(farm), type(uint256).max);
        randomToken.approve(address(farm), type(uint256).max);

        lpJackPlsx.approve(address(farm), type(uint256).max);
        lpJackPdai.approve(address(farm), type(uint256).max);

        feeReward.approve(address(farm), type(uint256).max);
        lpFeeReward.approve(address(farm), type(uint256).max);

        farm.addPool(address(lpJackPlsx), address(plsx), 1_000 * ONE, true);
        farm.addPool(address(lpJackPdai), address(pdai), 2_000 * ONE, true);
    }

    function test01JackRewardSplitsAcrossActivePools() public {
        farm.depositReward(address(jack), 300 * ONE);

        JackFarm.PoolInfo memory p0 = farm.getPool(0);
        JackFarm.PoolInfo memory p1 = farm.getPool(1);

        Assert.equal(p0.jackStream.reserved, 150 * ONE, "Pool 0 should receive 150 JACK");
        Assert.equal(p1.jackStream.reserved, 150 * ONE, "Pool 1 should receive 150 JACK");

        Assert.ok(p0.jackStream.rewardRate > 0, "Pool 0 JACK reward rate should be active");
        Assert.ok(p1.jackStream.rewardRate > 0, "Pool 1 JACK reward rate should be active");

        JackFarm.TokenBalanceData memory data = farm.getRewardTokenBalance(address(jack));

        Assert.equal(data.trackedBalance, 300 * ONE, "Tracked JACK should be 300");
        Assert.equal(data.reservedRewards, 300 * ONE, "Reserved JACK should be 300");
    }

    function test02PairedRewardRoutesToCorrectPool() public {
        farm.depositReward(address(plsx), 1_000 * ONE);

        JackFarm.PoolInfo memory p0 = farm.getPool(0);
        JackFarm.PoolInfo memory p1 = farm.getPool(1);

        Assert.equal(p0.pairedStream.reserved, 1_000 * ONE, "PLSX should route to pool 0");
        Assert.equal(p1.pairedStream.reserved, 0, "PLSX should not route to pool 1");
        Assert.ok(p0.pairedStream.rewardRate > 0, "Pool 0 PLSX reward rate should be active");
    }

    function test03DirectTransferAndSyncAcceptedToken() public {
        uint256 directAmount = 200 * ONE;

        uint256 reservedBefore = farm.getPool(0).pairedStream.reserved;

        plsx.transfer(address(farm), directAmount);

        JackFarm.TokenBalanceData memory beforeSync = farm.getRewardTokenBalance(address(plsx));
        Assert.equal(beforeSync.untrackedBalance, directAmount, "PLSX should be untracked before sync");

        farm.syncRewardToken(address(plsx));

        JackFarm.PoolInfo memory p0 = farm.getPool(0);

        Assert.equal(p0.pairedStream.reserved, reservedBefore + directAmount, "Synced PLSX should route to pool 0");
    }

    function test04UnsupportedTokenCannotBeSynced() public {
        randomToken.transfer(address(farm), 100 * ONE);

        bool failed;

        try farm.syncRewardToken(address(randomToken)) {
            failed = false;
        } catch {
            failed = true;
        }

        Assert.ok(failed, "Unsupported token sync should fail");
    }

    function test05FeeOnTransferRewardDepositUsesActualReceived() public {
        uint256 poolId = farm.addPool(address(lpFeeReward), address(feeReward), 1_000 * ONE, true);

        farm.depositReward(address(feeReward), 1_000 * ONE);

        JackFarm.PoolInfo memory p = farm.getPool(poolId);

        Assert.equal(p.pairedStream.reserved, 900 * ONE, "Only actual 900 received tokens should be scheduled");
        Assert.equal(feeReward.balanceOf(feeReceiver), 100 * ONE, "Fee receiver should receive 100 tokens");
    }

    function test06ManualRewardDurationOverrideWorks() public {
        farm.setManualRewardDuration(0, 7, JackFarm.OverridePeriod.M1);

        JackFarm.PoolLiveData memory live = farm.getPoolLiveData(0);

        Assert.equal(live.rewardDurationDays, 7, "Reward duration should be 7 days");
        Assert.ok(live.manualOverrideActive, "Manual override should be active");
        Assert.ok(live.manualOverrideUntil > block.timestamp, "Override expiry should be in the future");
    }

    function test07AutoConfigCanBeUpdated() public {
        farm.setPoolAutoConfig(0, true, 5_000 * ONE, 1 days, 2);

        JackFarm.PoolLiveData memory live = farm.getPoolLiveData(0);

        Assert.ok(live.autoAdjustEnabled, "Auto adjust should be enabled");
        Assert.equal(live.targetStake, 5_000 * ONE, "Target stake should be updated");
        Assert.equal(uint256(live.autoCooldown), 1 days, "Cooldown should be 1 day");
        Assert.equal(live.autoStepDays, 2, "Step days should be 2");
    }
}