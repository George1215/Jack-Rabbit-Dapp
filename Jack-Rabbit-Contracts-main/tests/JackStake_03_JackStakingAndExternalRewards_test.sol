// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "remix_tests.sol";
import "remix_accounts.sol";

import "../contracts/JackStake.sol";
import "../contracts/interfaces/IJack.sol";
import "../contracts/interfaces/IJackTreasury.sol";
import "../contracts/testHelpers/JackStakeMocks.sol";

contract JackStake_03_JackStakingAndExternalRewards_Test {
    uint256 constant ONE = 1e18;

    JackStake stake;

    JackStakeMockERC20 jack;
    JackStakeMockERC20 plsx;

    JackStakeMockTreasury treasury;

    address miningSink;
    address jackFeeRecipient;
    address externalFeeRecipient;

    function beforeAll() public {
        miningSink = TestsAccounts.getAccount(1);
        jackFeeRecipient = TestsAccounts.getAccount(2);
        externalFeeRecipient = TestsAccounts.getAccount(3);

        jack = new JackStakeMockERC20("Jack Rabbit", "JACK");
        plsx = new JackStakeMockERC20("PulseX", "PLSX");

        treasury = new JackStakeMockTreasury();

        stake = new JackStake(
            IJack(address(jack)),
            IJackTreasury(address(treasury)),
            miningSink,
            jackFeeRecipient,
            externalFeeRecipient
        );

        uint256 big = 50_000_000 * ONE;

        jack.mint(address(this), big);
        plsx.mint(address(this), big);

        jack.approve(address(stake), type(uint256).max);
        plsx.approve(address(stake), type(uint256).max);

        address[] memory tokens = new address[](1);
        tokens[0] = address(plsx);

        stake.addPool(tokens);

        stake.setEmissionRatePpm(address(plsx), stake.MAX_EMISSION_PPM());
    }

    function test01StakeJackChargesFeeAndStoresNetStake() public {
        uint256 amount = 1_000 * ONE;

        uint256 treasuryBefore = jack.balanceOf(address(treasury));
        uint256 sinkBefore = jack.balanceOf(miningSink);

        stake.stakeJackToken(amount);

        Assert.equal(stake.totalStakedJack(), 950 * ONE, "Net JACK stake should be 95%");
        Assert.equal(stake.userStakeJack(address(this)), 950 * ONE, "User JACK stake should be 950");
        Assert.equal(jack.balanceOf(address(treasury)) - treasuryBefore, 25 * ONE, "Treasury should receive 2.5% JACK");
        Assert.equal(jack.balanceOf(miningSink) - sinkBefore, 25 * ONE, "Mining sink should receive 2.5% JACK");
    }

    function test02InjectExternalRewardForJackStakers() public {
        uint256 amount = 100_000 * ONE;

        uint256 reserveBefore = stake.getRewardStreamReserve(address(plsx));

        stake.injectJackStakersReward(address(plsx), amount);

        Assert.equal(stake.getRewardStreamReserve(address(plsx)), reserveBefore + amount, "PLSX reward reserve should increase");
    }

    function test03ExternalRewardFeeIsTakenBeforeJackStakerDistribution() public {
        uint256 feeRecipientBefore = plsx.balanceOf(externalFeeRecipient);

        stake.updateJackRewardToken(address(plsx));

        uint256 feeRecipientAfter = plsx.balanceOf(externalFeeRecipient);
        uint256 pending = stake.pendingExternalReward(address(plsx), address(this));

        Assert.ok(feeRecipientAfter > feeRecipientBefore, "External fee recipient should receive PLSX fee");
        Assert.ok(pending > 0, "JACK staker should have pending PLSX reward");
    }

    function test04ClaimExternalRewardWorks() public {
        uint256 beforeBalance = plsx.balanceOf(address(this));

        uint256 pendingBefore = stake.pendingExternalReward(address(plsx), address(this));
        Assert.ok(pendingBefore > 0, "Pending external reward should exist before claim");

        stake.claimExternalTokenAsReward(address(plsx));

        uint256 afterBalance = plsx.balanceOf(address(this));

        Assert.ok(afterBalance > beforeBalance, "User should receive PLSX reward");
        Assert.equal(stake.pendingExternalReward(address(plsx), address(this)), 0, "Pending PLSX should be zero after claim");
    }

    function test05UnstakeJackWorks() public {
        uint256 amount = 100 * ONE;

        uint256 beforeBalance = jack.balanceOf(address(this));

        stake.unstakeJackToken(amount);

        uint256 afterBalance = jack.balanceOf(address(this));

        Assert.equal(afterBalance - beforeBalance, amount, "User should receive unstaked JACK");
        Assert.equal(stake.userStakeJack(address(this)), 850 * ONE, "Remaining JACK stake should be 850");
    }
}