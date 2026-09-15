// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "remix_tests.sol";

import "../contracts/Jack.sol";
import "../contracts/testHelpers/MockAllowedMinter.sol";

contract JackMintAdminTest {
    JackToken jack;
    MockAllowedMinter minter;

    uint256 constant ONE_JACK = 1e18;
    uint256 constant ONE_THOUSAND_JACK = 1000 * ONE_JACK;
    uint256 constant ONE_MILLION_JACK = 1_000_000 * ONE_JACK;

    function beforeEach() public {
        jack = new JackToken();
        minter = new MockAllowedMinter(address(jack));
    }

    function testAllowedContractCanMintFivePercentOfBurnCredit() public {
        jack.setAllowedContract(address(minter), true);

        Assert.equal(
            jack.allowedContracts(address(minter)),
            true,
            "Minter should be allowed"
        );

        jack.burn(ONE_THOUSAND_JACK);

        Assert.equal(
            jack.totalBurned(),
            ONE_THOUSAND_JACK,
            "Burn credit should be 1000 JACK"
        );

        Assert.equal(
            jack.getMintableAmount(),
            50 * ONE_JACK,
            "Mintable amount should be 5% of 1000 JACK"
        );

        minter.callMint();

        Assert.equal(
            jack.balanceOf(address(minter)),
            50 * ONE_JACK,
            "Allowed minter should receive 50 JACK"
        );

        Assert.equal(
            jack.totalBurned(),
            950 * ONE_JACK,
            "Burn credit should reduce to 950 JACK"
        );
    }

    function testSecondMintFailsBecauseOfCooldown() public {
        jack.setAllowedContract(address(minter), true);

        jack.burn(ONE_THOUSAND_JACK);

        minter.callMint();

        try minter.callMint() {
            Assert.ok(false, "Second mint should fail during cooldown");
        } catch Error(string memory reason) {
            Assert.equal(
                reason,
                "Nothing to mint",
                "Second mint should fail because cooldown makes mintable amount zero"
            );
        } catch {
            Assert.ok(false, "Unexpected low-level error");
        }
    }

    function testNonAllowedContractCannotMint() public {
        jack.burn(ONE_THOUSAND_JACK);

        try minter.callMint() {
            Assert.ok(false, "Non-allowed contract should not mint");
        } catch Error(string memory reason) {
            Assert.equal(
                reason,
                "Not treasury/allowed",
                "Mint should fail because caller is not treasury or allowed"
            );
        } catch {
            Assert.ok(false, "Unexpected low-level error");
        }
    }

    function testRemoveAllowedContractBlocksMintAccess() public {
        jack.setAllowedContract(address(minter), true);

        Assert.equal(
            jack.allowedContracts(address(minter)),
            true,
            "Minter should start as allowed"
        );

        jack.removeAllowedContract(address(minter));

        Assert.equal(
            jack.allowedContracts(address(minter)),
            false,
            "Minter should be removed"
        );

        jack.burn(ONE_THOUSAND_JACK);

        try minter.callMint() {
            Assert.ok(false, "Removed minter should not mint");
        } catch Error(string memory reason) {
            Assert.equal(
                reason,
                "Not treasury/allowed",
                "Mint should fail after removing allowed contract"
            );
        } catch {
            Assert.ok(false, "Unexpected low-level error");
        }
    }

    function testSetAllowedContractRejectsWalletAddress() public {
        address normalWallet = address(0x1234);

        try jack.setAllowedContract(normalWallet, true) {
            Assert.ok(false, "Wallet address should not be allowed as contract");
        } catch Error(string memory reason) {
            Assert.equal(
                reason,
                "Not contract",
                "setAllowedContract should reject non-contract address"
            );
        } catch {
            Assert.ok(false, "Unexpected low-level error");
        }
    }

    function testAdminMintWorksWithBurnCredit() public {
        uint256 supplyBefore = jack.totalSupply();

        jack.burn(ONE_THOUSAND_JACK);

        jack.adminMint(100 * ONE_JACK);

        Assert.equal(
            jack.totalSupply(),
            supplyBefore - ONE_THOUSAND_JACK + (100 * ONE_JACK),
            "Supply should decrease from burn and increase from adminMint"
        );

        Assert.equal(
            jack.totalBurned(),
            900 * ONE_JACK,
            "Burn credit should reduce by adminMint amount"
        );

        Assert.equal(
            jack.balanceOf(address(this)),
            supplyBefore - ONE_THOUSAND_JACK + (100 * ONE_JACK),
            "Owner/test contract should receive admin minted JACK"
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
                "adminMint should fail when amount exceeds burn credit"
            );
        } catch {
            Assert.ok(false, "Unexpected low-level error");
        }
    }

    function testSetFeeOverrideWorks() public {
        jack.setFeeOverride(500_000, JackToken.OverrideDuration.D7);

        Assert.equal(
            jack.overrideFeeBP(),
            500_000,
            "Override fee should be 500000"
        );

        Assert.ok(
            jack.overrideUntil() > block.timestamp,
            "Override expiry should be in the future"
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