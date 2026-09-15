// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "remix_tests.sol";

interface IJackStakeAttached {
    function jack() external view returns (address);
    function treasury() external view returns (address);

    function jackFeeSink() external view returns (address);
    function jackFeeRewardRecipient() external view returns (address);
    function externalFeeRewardRecipient() external view returns (address);
    function adminFeeRecipient() external view returns (address);

    function jackRewardFeeBp() external view returns (uint256);
    function externalRewardFeeBp() external view returns (uint256);

    function externalJackRewardReserve() external view returns (uint256);

    function getSyncableRewardAmount(address token) external view returns (uint256);
    function syncRewardToken(address token) external returns (uint256 amountSynced);
}

interface IMockMintERC20 {
    function mint(address to, uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract JackStake_00_AttachedSmoke_Test {
    uint256 constant ONE = 1e18;

    /*
        IMPORTANT:
        Replace these addresses after deploying manually in Remix.

        1. Deploy JackStakeMockERC20 as JACK.
        2. Deploy JackStakeMockTreasury.
        3. Deploy JackStake with:
           _jack = JACK mock address
           _treasury = Treasury mock address
           _jackMiningFeeSink = any wallet/account
           _jackFeeRewardRecipient = any wallet/account
           _externalFeeRewardRecipient = any wallet/account

        Then paste the deployed addresses below.
    */

    address constant STAKE_ADDR = 0x0000000000000000000000000000000000000000;
    address constant JACK_ADDR = 0x0000000000000000000000000000000000000000;
    address constant TREASURY_ADDR = 0x0000000000000000000000000000000000000000;

    address constant MINING_SINK = 0x0000000000000000000000000000000000000000;
    address constant JACK_FEE_RECIPIENT = 0x0000000000000000000000000000000000000000;
    address constant EXTERNAL_FEE_RECIPIENT = 0x0000000000000000000000000000000000000000;

    IJackStakeAttached stake;
    IMockMintERC20 jack;

    function beforeAll() public {
        require(STAKE_ADDR != address(0), "Replace STAKE_ADDR");
        require(JACK_ADDR != address(0), "Replace JACK_ADDR");
        require(TREASURY_ADDR != address(0), "Replace TREASURY_ADDR");
        require(MINING_SINK != address(0), "Replace MINING_SINK");
        require(JACK_FEE_RECIPIENT != address(0), "Replace JACK_FEE_RECIPIENT");
        require(EXTERNAL_FEE_RECIPIENT != address(0), "Replace EXTERNAL_FEE_RECIPIENT");

        stake = IJackStakeAttached(STAKE_ADDR);
        jack = IMockMintERC20(JACK_ADDR);
    }

    function test01AttachedDeploymentValues() public {
        Assert.equal(stake.jack(), JACK_ADDR, "Wrong JACK address");
        Assert.equal(stake.treasury(), TREASURY_ADDR, "Wrong treasury address");

        Assert.equal(stake.jackFeeSink(), MINING_SINK, "Wrong mining sink");
        Assert.equal(stake.jackFeeRewardRecipient(), JACK_FEE_RECIPIENT, "Wrong JACK fee recipient");
        Assert.equal(stake.externalFeeRewardRecipient(), EXTERNAL_FEE_RECIPIENT, "Wrong external fee recipient");
        Assert.equal(stake.adminFeeRecipient(), EXTERNAL_FEE_RECIPIENT, "Admin alias should follow external recipient");
    }

    function test02DefaultRewardFeesAreCorrect() public {
        Assert.equal(stake.jackRewardFeeBp(), 200, "JACK reward fee should be 20%");
        Assert.equal(stake.externalRewardFeeBp(), 100, "External reward fee should be 10%");
    }

    function test03JackSyncWorks() public {
        uint256 amount = 1_000 * ONE;

        uint256 reserveBefore = stake.externalJackRewardReserve();

        jack.mint(address(this), amount);
        jack.transfer(STAKE_ADDR, amount);

        uint256 syncable = stake.getSyncableRewardAmount(JACK_ADDR);

        Assert.ok(syncable >= amount, "JACK should be syncable");

        uint256 synced = stake.syncRewardToken(JACK_ADDR);

        Assert.equal(synced, syncable, "Synced amount should equal syncable amount");
        Assert.equal(
            stake.externalJackRewardReserve(),
            reserveBefore + synced,
            "External JACK reserve should increase"
        );

        Assert.equal(stake.getSyncableRewardAmount(JACK_ADDR), 0, "No JACK should remain syncable");
    }
}