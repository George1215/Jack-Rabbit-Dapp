// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "remix_tests.sol";
import "remix_accounts.sol";

import "../contracts/JackStake.sol";
import "../contracts/interfaces/IJack.sol";
import "../contracts/interfaces/IJackTreasury.sol";
import "../contracts/testHelpers/JackStakeMocks.sol";

contract JackStake_00_Smoke_Test {
    uint256 constant ONE = 1e18;

    JackStake stake;
    JackStakeMockERC20 jack;
    JackStakeMockTreasury treasury;

    address miningSink;
    address jackFeeRecipient;
    address externalFeeRecipient;

    function beforeAll() public {
        miningSink = TestsAccounts.getAccount(1);
        jackFeeRecipient = TestsAccounts.getAccount(2);
        externalFeeRecipient = TestsAccounts.getAccount(3);

        jack = new JackStakeMockERC20("Jack Rabbit", "JACK");
        treasury = new JackStakeMockTreasury();

        stake = new JackStake(
            IJack(address(jack)),
            IJackTreasury(address(treasury)),
            miningSink,
            jackFeeRecipient,
            externalFeeRecipient
        );

        jack.mint(address(this), 1_000_000 * ONE);
        jack.approve(address(stake), type(uint256).max);
    }

    function test01DeploymentWorks() public {
        Assert.equal(address(stake.jack()), address(jack), "Wrong JACK address");
        Assert.equal(address(stake.treasury()), address(treasury), "Wrong treasury address");
        Assert.equal(stake.jackFeeSink(), miningSink, "Wrong mining sink");
        Assert.equal(stake.jackFeeRewardRecipient(), jackFeeRecipient, "Wrong JACK fee recipient");
        Assert.equal(stake.externalFeeRewardRecipient(), externalFeeRecipient, "Wrong external fee recipient");
    }

    function test02DefaultRewardFeesAreCorrect() public {
        Assert.equal(stake.jackRewardFeeBp(), 200, "JACK reward fee should be 20%");
        Assert.equal(stake.externalRewardFeeBp(), 100, "External reward fee should be 10%");
    }

    function test03JackSyncWorks() public {
        uint256 amount = 1_000 * ONE;

        jack.transfer(address(stake), amount);

        uint256 syncable = stake.getSyncableRewardAmount(address(jack));
        Assert.equal(syncable, amount, "JACK should be syncable");

        uint256 synced = stake.syncRewardToken(address(jack));
        Assert.equal(synced, amount, "Synced amount should match");

        Assert.equal(stake.externalJackRewardReserve(), amount, "External JACK reserve should increase");
    }
}