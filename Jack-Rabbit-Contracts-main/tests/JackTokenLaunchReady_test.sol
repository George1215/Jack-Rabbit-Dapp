// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "remix_tests.sol";

import "../contracts/Jack.sol";
import "../contracts/testHelpers/MockTokenInteractor.sol";

contract MockLaunchTreasury {
    uint256 public pushedFeeTotal;

    function pushFee(uint256 amount) external {
        pushedFeeTotal += amount;
    }
}

contract JackTokenLaunchReadyTest {
    JackToken jack;
    MockTokenInteractor interactor;

    address userA = address(0xA001);
    address userB = address(0xA002);
    address userC = address(0xA003);

    uint256 constant ONE_JACK = 1e18;
    uint256 constant ONE_THOUSAND_JACK = 1000 * ONE_JACK;
    uint256 constant ONE_MILLION_JACK = 1_000_000 * ONE_JACK;
    uint256 constant FIFTY_MILLION_JACK = 50_000_000 * ONE_JACK;
    uint256 constant ONE_BILLION_JACK = 1_000_000_000 * ONE_JACK;

    function beforeEach() public {
        jack = new JackToken();
        interactor = new MockTokenInteractor();
    }

    function testLaunchSupplyAndConfigAreCorrect() public {
        Assert.equal(jack.name(), "Jack Rabbit", "Name should be Jack Rabbit");
        Assert.equal(jack.symbol(), "JACK", "Symbol should be JACK");
        Assert.equal(uint256(jack.decimals()), 18, "Decimals should be 18");

        Assert.equal(
            jack.MAX_SUPPLY(),
            ONE_BILLION_JACK,
            "Max supply should be 1B JACK"
        );

        Assert.equal(
            jack.BURN_STOP_SUPPLY(),
            FIFTY_MILLION_JACK,
            "Burn floor should be 50M JACK"
        );

        Assert.equal(
            jack.totalSupply(),
            ONE_BILLION_JACK,
            "Total supply should equal max supply at launch"
        );

        Assert.equal(
            jack.balanceOf(address(this)),
            ONE_BILLION_JACK,
            "Deployer should receive full supply"
        );

        Assert.equal(
            jack.startBurnShareBP(),
            0,
            "Burn share should start at 0%"
        );

        Assert.equal(
            jack.endBurnShareBP(),
            5000,
            "Burn share should grow up to 50%"
        );
    }

    function testTokenLaunchesWithNoTreasuryAndNoFees() public {
        Assert.equal(jack.treasury(), address(0), "Treasury should be zero");
        Assert.equal(jack.isTreasurySet(), false, "Treasury should not be set");
        Assert.equal(jack.getCurrentFeeBP(), 0, "Fee should be zero");
        Assert.equal(jack.isFeeActive(), false, "Fee should be inactive");
        Assert.equal(jack.getCurrentBurnShareBP(), 0, "Burn share should be zero");
        Assert.equal(jack.isAutomaticFeeBurnActive(), false, "Auto burn should be inactive");
    }

    function testUserTransfersAreNormalBeforeTreasury() public {
        uint256 supplyBefore = jack.totalSupply();
        uint256 burnedBefore = jack.totalBurned();

        jack.transfer(userA, ONE_THOUSAND_JACK);

        Assert.equal(
            jack.balanceOf(userA),
            ONE_THOUSAND_JACK,
            "User should receive exact transfer amount"
        );

        Assert.equal(
            jack.totalSupply(),
            supplyBefore,
            "Supply should not change during normal transfer"
        );

        Assert.equal(
            jack.totalBurned(),
            burnedBefore,
            "totalBurned should not change during normal transfer"
        );
    }

    function testPreviewFeeShowsZeroBeforeTreasury() public {
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

    function testApproveAndContractTransferFromWorksBeforeTreasury() public {
        jack.transfer(userA, ONE_THOUSAND_JACK);

        // Test contract cannot approve from userA directly, so we test approval from deployer.
        jack.approve(address(interactor), ONE_THOUSAND_JACK);

        bool success = interactor.pullTokens(
            address(jack),
            address(this),
            userB,
            400 * ONE_JACK
        );

        Assert.equal(success, true, "External contract transferFrom should succeed");

        Assert.equal(
            jack.balanceOf(userB),
            400 * ONE_JACK,
            "UserB should receive exact pulled amount"
        );

        Assert.equal(
            jack.allowance(address(this), address(interactor)),
            600 * ONE_JACK,
            "Allowance should reduce correctly"
        );
    }

    function testManualBurnStillWorks() public {
        uint256 supplyBefore = jack.totalSupply();

        jack.burn(ONE_THOUSAND_JACK);

        Assert.equal(
            jack.totalSupply(),
            supplyBefore - ONE_THOUSAND_JACK,
            "Supply should reduce after manual burn"
        );

        Assert.equal(
            jack.totalBurned(),
            ONE_THOUSAND_JACK,
            "totalBurned should increase after manual burn"
        );
    }

    function testMintableAmountIsFivePercentOfBurnCredit() public {
        jack.burn(ONE_THOUSAND_JACK);

        Assert.equal(
            jack.getMintableAmount(),
            50 * ONE_JACK,
            "Mintable amount should be 5% of burn credit"
        );
    }

    function testAdminMintUsesBurnCreditOnly() public {
        uint256 supplyBefore = jack.totalSupply();

        jack.burn(ONE_THOUSAND_JACK);
        jack.adminMint(100 * ONE_JACK);

        Assert.equal(
            jack.totalSupply(),
            supplyBefore - ONE_THOUSAND_JACK + (100 * ONE_JACK),
            "Supply should reflect burn and admin mint"
        );

        Assert.equal(
            jack.totalBurned(),
            900 * ONE_JACK,
            "Burn credit should reduce by adminMint amount"
        );
    }

    function testAdminMintCannotExceedBurnCredit() public {
        jack.burn(100 * ONE_JACK);

        try jack.adminMint(101 * ONE_JACK) {
            Assert.ok(false, "adminMint should not exceed burn credit");
        } catch Error(string memory reason) {
            Assert.equal(
                reason,
                "Exceeds burn credit",
                "adminMint should fail when exceeding burn credit"
            );
        } catch {
            Assert.ok(false, "Unexpected low-level error");
        }
    }

    function testNonOwnerContractCannotCallOwnerFunctions() public {
        MockLaunchTreasury mockTreasury = new MockLaunchTreasury();

        try interactor.trySetTreasury(address(jack), address(mockTreasury)) {
            Assert.ok(false, "Non-owner contract should not set treasury");
        } catch {
            Assert.ok(true, "Non-owner setTreasury correctly failed");
        }

        try interactor.trySetTreasuryTarget(address(jack), 1_000_000) {
            Assert.ok(false, "Non-owner contract should not set treasury target");
        } catch {
            Assert.ok(true, "Non-owner setTreasuryTarget correctly failed");
        }

        try interactor.tryAdminMint(address(jack), ONE_JACK) {
            Assert.ok(false, "Non-owner contract should not adminMint");
        } catch {
            Assert.ok(true, "Non-owner adminMint correctly failed");
        }
    }

    function testOwnerCanSetAndUnsetTreasuryForFutureUpgradeSafety() public {
        MockLaunchTreasury mockTreasury = new MockLaunchTreasury();

        jack.setTreasury(address(mockTreasury));

        Assert.equal(
            jack.treasury(),
            address(mockTreasury),
            "Treasury should be set"
        );

        Assert.equal(
            jack.isFeeActive(),
            true,
            "Fee should become active after treasury set"
        );

        jack.unsetTreasury();

        Assert.equal(
            jack.treasury(),
            address(0),
            "Treasury should be unset"
        );

        Assert.equal(
            jack.getCurrentFeeBP(),
            0,
            "Fee should return to zero after unset"
        );

        jack.transfer(userC, ONE_THOUSAND_JACK);

        Assert.equal(
            jack.balanceOf(userC),
            ONE_THOUSAND_JACK,
            "Transfer should return to normal ERC20 behavior after unset"
        );
    }

    function testSetTreasuryTargetUsesWholeTokens() public {
        jack.setTreasuryTarget(1_000_000);

        Assert.equal(
            jack.treasuryTarget(),
            ONE_MILLION_JACK,
            "Treasury target should be 1M JACK with decimals"
        );
    }
}