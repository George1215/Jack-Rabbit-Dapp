// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "remix_tests.sol";
import "remix_accounts.sol";
import "../contracts/JackFarm.sol";
import "../contracts/testHelpers/MockERC20.sol";

contract JackFarm_04_AdminSafety_Test {
    uint256 constant ONE = 1e18;

    JackFarm farm;

    MockERC20 jack;
    MockERC20 plsx;
    MockERC20 pdai;
    MockERC20 hexToken;

    MockERC20 lpJackPlsx;
    MockERC20 lpJackPdai;
    MockERC20 lpProtection;

    MockERC20 unsupported;

    address treasury;
    address receiver;

    function beforeAll() public {
        treasury = TestsAccounts.getAccount(1);
        receiver = TestsAccounts.getAccount(2);

        jack = new MockERC20("Jack Rabbit", "JACK");
        plsx = new MockERC20("PulseX", "PLSX");
        pdai = new MockERC20("pDAI", "pDAI");
        hexToken = new MockERC20("HEX", "HEX");

        lpJackPlsx = new MockERC20("JACK-PLSX LP", "JACKPLSX-LP");
        lpJackPdai = new MockERC20("JACK-pDAI LP", "JACKPDAI-LP");
        lpProtection = new MockERC20("Protection LP", "PROTECT-LP");

        unsupported = new MockERC20("Unsupported", "UNSUP");

        farm = new JackFarm(address(jack), treasury);

        uint256 bigAmount = 10_000_000 * ONE;

        jack.mint(address(this), bigAmount);
        plsx.mint(address(this), bigAmount);
        pdai.mint(address(this), bigAmount);
        hexToken.mint(address(this), bigAmount);

        lpJackPlsx.mint(address(this), bigAmount);
        lpJackPdai.mint(address(this), bigAmount);
        lpProtection.mint(address(this), bigAmount);

        unsupported.mint(address(this), bigAmount);

        jack.approve(address(farm), type(uint256).max);
        plsx.approve(address(farm), type(uint256).max);
        pdai.approve(address(farm), type(uint256).max);
        hexToken.approve(address(farm), type(uint256).max);

        lpJackPlsx.approve(address(farm), type(uint256).max);
        lpJackPdai.approve(address(farm), type(uint256).max);
        lpProtection.approve(address(farm), type(uint256).max);

        unsupported.approve(address(farm), type(uint256).max);

        farm.addPool(address(lpJackPlsx), address(plsx), 1_000 * ONE, true);
        farm.addPool(address(lpJackPdai), address(pdai), 2_000 * ONE, true);
    }

    function test01ProtocolFeeCannotExceedFivePercent() public {
        bool failed;

        try farm.setProtocolFeeBps(501) {
            failed = false;
        } catch {
            failed = true;
        }

        Assert.ok(failed, "Protocol fee above 5% should fail");

        farm.setProtocolFeeBps(300);
        Assert.equal(farm.protocolFeeBps(), 300, "Protocol fee should update below 5%");

        farm.setProtocolFeeBps(500);
        Assert.equal(farm.protocolFeeBps(), 500, "Protocol fee should return to 5%");
    }

    function test02AdminCannotRescueUserStakedLp() public {
        uint256 poolId = farm.addPool(
            address(lpProtection),
            address(hexToken),
            1_000 * ONE,
            true
        );

        farm.deposit(poolId, 100 * ONE);

        JackFarm.PoolInfo memory p = farm.getPool(poolId);
        Assert.equal(p.totalStaked, 95 * ONE, "Protection pool should have 95 LP staked");

        bool failed;

        try farm.rescueUnsupportedToken(address(lpProtection), 1 * ONE, receiver) {
            failed = false;
        } catch {
            failed = true;
        }

        Assert.ok(failed, "Admin should not rescue user-staked LP");
    }

    function test03LpSurplusCanBeRescuedOnlyWhenExtraExists() public {
        lpProtection.transfer(address(farm), 10 * ONE);

        uint256 surplus = farm.getLpTokenSurplus(address(lpProtection));

        Assert.equal(surplus, 10 * ONE, "LP surplus should be 10");

        uint256 receiverBefore = lpProtection.balanceOf(receiver);

        farm.rescueLpSurplus(address(lpProtection), 10 * ONE, receiver);

        uint256 receiverAfter = lpProtection.balanceOf(receiver);

        Assert.equal(receiverAfter - receiverBefore, 10 * ONE, "Receiver should get LP surplus");
    }

    function test04ReservedRewardTokenCannotBeWithdrawnAsSurplus() public {
        farm.depositReward(address(jack), 100 * ONE);

        JackFarm.TokenBalanceData memory data = farm.getRewardTokenBalance(address(jack));

        Assert.ok(data.trackedBalance > 0, "Tracked JACK should be greater than zero");
        Assert.ok(data.trackedBalance <= 100 * ONE, "Tracked JACK should not exceed deposited amount");

        Assert.equal(data.reservedRewards, data.trackedBalance, "All tracked JACK should be reserved");
        Assert.equal(data.withdrawableSurplus, 0, "Reserved JACK should not be withdrawable");
    }

    function test05UnsupportedTokenCanBeRescued() public {
        unsupported.transfer(address(farm), 50 * ONE);

        uint256 receiverBefore = unsupported.balanceOf(receiver);

        farm.rescueUnsupportedToken(address(unsupported), 50 * ONE, receiver);

        uint256 receiverAfter = unsupported.balanceOf(receiver);

        Assert.equal(receiverAfter - receiverBefore, 50 * ONE, "Receiver should get unsupported token rescue");
    }

    function test06LivePoolDataWorks() public {
        JackFarm.PoolLiveData memory live = farm.getPoolLiveData(0);

        Assert.equal(live.poolId, 0, "Live data pool id should be 0");
        Assert.equal(live.lpToken, address(lpJackPlsx), "Live LP should be JACK/PLSX LP");
        Assert.equal(live.pairedRewardToken, address(plsx), "Live paired reward should be PLSX");
        Assert.ok(live.rewardDurationDays >= 1 && live.rewardDurationDays <= 30, "Reward duration should be valid");
        Assert.ok(live.autoMinRewardDays >= 7, "Auto min days should be at least 7");
    }

    function test07AcceptedRewardTokensAndBalancesWork() public {
        address[] memory tokens = farm.getAcceptedRewardTokens();

        Assert.ok(tokens.length >= 3, "Should include JACK, PLSX, pDAI, and HEX after pools are added");
        Assert.equal(tokens[0], address(jack), "First accepted token should be JACK");

        JackFarm.TokenBalanceData memory jackBalance = farm.getRewardTokenBalance(address(jack));
        JackFarm.TokenBalanceData memory plsxBalance = farm.getRewardTokenBalance(address(plsx));
        JackFarm.TokenBalanceData memory pdaiBalance = farm.getRewardTokenBalance(address(pdai));

        Assert.equal(jackBalance.token, address(jack), "JACK balance token should be JACK");
        Assert.equal(plsxBalance.token, address(plsx), "PLSX balance token should be PLSX");
        Assert.equal(pdaiBalance.token, address(pdai), "pDAI balance token should be pDAI");
    }

    function test08TreasuryCanBeUpdated() public {
        address newTreasury = TestsAccounts.getAccount(3);

        farm.setTreasury(newTreasury);

        Assert.equal(farm.treasury(), newTreasury, "Treasury should update");

        farm.setTreasury(treasury);

        Assert.equal(farm.treasury(), treasury, "Treasury should be restored");
    }

    function test09ManualOverrideCanBeCleared() public {
        farm.setManualRewardDuration(0, 7, JackFarm.OverridePeriod.M1);

        JackFarm.PoolLiveData memory liveBefore = farm.getPoolLiveData(0);

        Assert.ok(liveBefore.manualOverrideActive, "Manual override should be active");

        farm.clearManualRewardDuration(0);

        JackFarm.PoolLiveData memory liveAfter = farm.getPoolLiveData(0);

        Assert.ok(!liveAfter.manualOverrideActive, "Manual override should be cleared");
    }
}