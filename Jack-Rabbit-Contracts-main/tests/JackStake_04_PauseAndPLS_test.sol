// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "remix_tests.sol";
import "remix_accounts.sol";

import "../contracts/JackStake.sol";
import "../contracts/interfaces/IJack.sol";
import "../contracts/interfaces/IJackTreasury.sol";
import "../contracts/testHelpers/JackStakeMocks.sol";

contract JackStake_04_PauseAndPLS_Test {
    uint256 constant ONE = 1e18;

    JackStake stake;

    JackStakeMockERC20 jack;
    JackStakeMockERC20 plsx;

    JackStakeMockTreasury treasury;

    address miningSink;
    address jackFeeRecipient;
    address externalFeeRecipient;

    receive() external payable {}

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

        address[] memory tokens = new address[](2);
        tokens[0] = address(plsx);
        tokens[1] = stake.PLS();

        stake.addPool(tokens);
    }

    function test01PlsPoolCanBeAdded() public {
        address pls = stake.PLS();

        Assert.ok(stake.isExternalPool(pls), "PLS should be external pool");
        Assert.ok(stake.isExternalPoolActive(pls), "PLS pool should be active");
        Assert.ok(stake.isRewardToken(pls), "PLS should be reward token");
        Assert.ok(stake.isRewardTokenActive(pls), "PLS reward token should be active");
    }

    function test02PauseBlocksNewDeposits() public {
        stake.pause();

        bool failed;

        try stake.stakeExternalToken(address(plsx), 100 * ONE) {
            failed = false;
        } catch {
            failed = true;
        }

        Assert.ok(failed, "External staking should fail while paused");

        stake.unpause();

        stake.stakeExternalToken(address(plsx), 100 * ONE);

        Assert.equal(stake.userStakeExternal(address(plsx), address(this)), 95 * ONE, "Stake should work after unpause");
    }

    function test03UnstakeIsAllowedWhilePaused() public {
        stake.pause();

        uint256 beforeBalance = plsx.balanceOf(address(this));

        stake.unstakeExternalToken(address(plsx), 10 * ONE);

        uint256 afterBalance = plsx.balanceOf(address(this));

        Assert.equal(afterBalance - beforeBalance, 10 * ONE, "Unstake should work while paused");

        stake.unpause();
    }

    function test04NativePlsStakeIfTestContractHasBalance() public {
        uint256 amount = 1 ether;

        if (address(this).balance < amount) {
            Assert.ok(true, "Skipped native PLS stake test because test contract has no native balance");
            return;
        }

        uint256 beforeStake = stake.userStakeExternal(stake.PLS(), address(this));

        stake.stakeExternalToken{value: amount}(stake.PLS(), amount);

        uint256 afterStake = stake.userStakeExternal(stake.PLS(), address(this));

        Assert.equal(afterStake - beforeStake, (amount * 95) / 100, "Native PLS stake should store 95% net");
    }

    function test05NativePlsSyncIfTestContractHasBalance() public {
        uint256 amount = 1 ether;

        if (address(this).balance < amount) {
            Assert.ok(true, "Skipped native PLS sync test because test contract has no native balance");
            return;
        }

        uint256 reserveBefore = stake.getRewardStreamReserve(stake.PLS());

        (bool ok, ) = payable(address(stake)).call{value: amount}("");
        require(ok, "PLS send failed");

        uint256 synced = stake.syncRewardToken(stake.PLS());

        Assert.equal(synced, amount, "Synced PLS should match sent amount");
        Assert.equal(stake.getRewardStreamReserve(stake.PLS()), reserveBefore + amount, "PLS reward reserve should increase");
    }
}