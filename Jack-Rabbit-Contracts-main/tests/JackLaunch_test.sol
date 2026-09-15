// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "remix_tests.sol";
import "../contracts/Jack.sol";

contract JackLaunchTest {
    JackToken jack;

    address receiver = address(0x1001);
    address secondReceiver = address(0x1002);

    uint256 constant ONE_JACK = 1e18;
    uint256 constant ONE_THOUSAND_JACK = 1000 * ONE_JACK;
    uint256 constant ONE_MILLION_JACK = 1_000_000 * ONE_JACK;
    uint256 constant FIFTY_MILLION_JACK = 50_000_000 * ONE_JACK;
    uint256 constant ONE_BILLION_JACK = 1_000_000_000 * ONE_JACK;

    function beforeEach() public {
        jack = new JackToken();
    }

    function testInitialJackConfig() public {
        Assert.equal(jack.name(), "Jack Rabbit", "Token name should be Jack Rabbit");
        Assert.equal(jack.symbol(), "JACK", "Token symbol should be JACK");
        Assert.equal(uint256(jack.decimals()), 18, "Decimals should be 18");

        Assert.equal(
            jack.MAX_SUPPLY(),
            ONE_BILLION_JACK,
            "Max supply should be 1B JACK"
        );

        Assert.equal(
            jack.BURN_STOP_SUPPLY(),
            FIFTY_MILLION_JACK,
            "Burn stop supply should be 50M JACK"
        );

        Assert.equal(
            jack.totalSupply(),
            ONE_BILLION_JACK,
            "Total supply should equal max supply"
        );

        Assert.equal(
            jack.balanceOf(address(this)),
            ONE_BILLION_JACK,
            "Test contract should receive full supply"
        );

        Assert.equal(
            jack.startBurnShareBP(),
            0,
            "Burn share should start at 0%"
        );

        Assert.equal(
            jack.endBurnShareBP(),
            5000,
            "Burn share should end at 50%"
        );
    }

    function testLaunchModeHasNoTreasuryAndNoFees() public {
        Assert.equal(
            jack.treasury(),
            address(0),
            "Treasury should be zero at launch"
        );

        Assert.equal(
            jack.isTreasurySet(),
            false,
            "Treasury should not be set"
        );

        Assert.equal(
            jack.getCurrentFeeBP(),
            0,
            "Fee should be zero before treasury is set"
        );

        Assert.equal(
            jack.isFeeActive(),
            false,
            "Fee should not be active before treasury is set"
        );

        Assert.equal(
            jack.getCurrentBurnShareBP(),
            0,
            "Current burn share should be zero before treasury is set"
        );
    }

    function testPreviewFeeBeforeTreasury() public {
        (
            uint256 feeAmount,
            uint256 burnAmount,
            uint256 treasuryAmount,
            uint256 netAmount
        ) = jack.previewFee(ONE_THOUSAND_JACK);

        Assert.equal(feeAmount, 0, "Fee should be zero");
        Assert.equal(burnAmount, 0, "Burn should be zero");
        Assert.equal(treasuryAmount, 0, "Treasury amount should be zero");
        Assert.equal(netAmount, ONE_THOUSAND_JACK, "Net should equal full amount");
    }

    function testNormalTransferBeforeTreasury() public {
        uint256 supplyBefore = jack.totalSupply();
        uint256 burnedBefore = jack.totalBurned();

        bool success = jack.transfer(receiver, ONE_THOUSAND_JACK);

        Assert.equal(success, true, "Transfer should succeed");

        Assert.equal(
            jack.balanceOf(receiver),
            ONE_THOUSAND_JACK,
            "Receiver should get full amount"
        );

        Assert.equal(
            jack.totalSupply(),
            supplyBefore,
            "Total supply should not change"
        );

        Assert.equal(
            jack.totalBurned(),
            burnedBefore,
            "Total burned should not change"
        );
    }

    function testApproveAndTransferFromBeforeTreasury() public {
        uint256 approveAmount = 500 * ONE_JACK;
        uint256 transferAmount = 200 * ONE_JACK;

        bool approveSuccess = jack.approve(address(this), approveAmount);

        Assert.equal(approveSuccess, true, "Approval should succeed");

        bool transferSuccess = jack.transferFrom(
            address(this),
            secondReceiver,
            transferAmount
        );

        Assert.equal(transferSuccess, true, "transferFrom should succeed");

        Assert.equal(
            jack.balanceOf(secondReceiver),
            transferAmount,
            "Second receiver should receive full amount"
        );

        Assert.equal(
            jack.allowance(address(this), address(this)),
            approveAmount - transferAmount,
            "Allowance should reduce correctly"
        );
    }

    function testManualBurnWorks() public {
        uint256 burnAmount = 100 * ONE_JACK;

        uint256 supplyBefore = jack.totalSupply();
        uint256 burnedBefore = jack.totalBurned();

        jack.burn(burnAmount);

        Assert.equal(
            jack.totalSupply(),
            supplyBefore - burnAmount,
            "Supply should decrease after burn"
        );

        Assert.equal(
            jack.totalBurned(),
            burnedBefore + burnAmount,
            "totalBurned should increase after burn"
        );
    }

    function testAdminMintWorksWithBurnCredit() public {
        uint256 burnAmount = ONE_THOUSAND_JACK;
        uint256 mintAmount = 100 * ONE_JACK;

        uint256 supplyBefore = jack.totalSupply();

        jack.burn(burnAmount);
        jack.adminMint(mintAmount);

        Assert.equal(
            jack.totalSupply(),
            supplyBefore - burnAmount + mintAmount,
            "Supply should decrease by burn and increase by admin mint"
        );

        Assert.equal(
            jack.totalBurned(),
            burnAmount - mintAmount,
            "adminMint should reduce burn credit"
        );
    }

    function testSetTreasuryTargetUsesWholeTokens() public {
        jack.setTreasuryTarget(1_000_000);

        Assert.equal(
            jack.treasuryTarget(),
            ONE_MILLION_JACK,
            "setTreasuryTarget should convert whole tokens to decimals"
        );
    }
}