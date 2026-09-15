// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "remix_tests.sol";
import "../contracts/Jack.sol";

contract MockJackTreasury {
    uint256 public pushedFeeTotal;
    uint256 public pushFeeCallCount;

    function pushFee(uint256 amount) external {
        pushedFeeTotal += amount;
        pushFeeCallCount += 1;
    }
}

contract JackTreasuryMockTest {
    JackToken jack;
    MockJackTreasury mockTreasury;

    address receiver = address(0x2001);
    address receiverTwo = address(0x2002);

    uint256 constant ONE_JACK = 1e18;
    uint256 constant ONE_THOUSAND_JACK = 1000 * ONE_JACK;

    function beforeEach() public {
        jack = new JackToken();
        mockTreasury = new MockJackTreasury();
    }

    function testSetTreasuryActivatesFees() public {
        jack.setTreasury(address(mockTreasury));

        Assert.equal(
            jack.treasury(),
            address(mockTreasury),
            "Treasury should be set"
        );

        Assert.equal(
            jack.isTreasurySet(),
            true,
            "Treasury should be active"
        );

        Assert.equal(
            jack.allowedContracts(address(mockTreasury)),
            true,
            "Treasury should be auto-allowed"
        );

        Assert.equal(
            jack.getCurrentFeeBP(),
            1_000_000,
            "Starting fee should be 0.1%"
        );

        Assert.equal(
            jack.getConfiguredBurnShareBP(),
            0,
            "Starting configured burn share should be 0%"
        );

        Assert.equal(
            jack.getCurrentBurnShareBP(),
            0,
            "Starting current burn share should be 0%"
        );

        Assert.equal(
            jack.isFeeActive(),
            true,
            "Fee should be active after treasury is set"
        );
    }

    function testPreviewFeeAfterTreasurySet() public {
        jack.setTreasury(address(mockTreasury));

        (
            uint256 feeAmount,
            uint256 burnAmount,
            uint256 treasuryAmount,
            uint256 netAmount
        ) = jack.previewFee(ONE_THOUSAND_JACK);

        Assert.equal(
            feeAmount,
            ONE_JACK,
            "1000 JACK at 0.1% should charge 1 JACK fee"
        );

        Assert.equal(
            burnAmount,
            0,
            "Initial burn amount should be 0 because burn share starts at 0%"
        );

        Assert.equal(
            treasuryAmount,
            ONE_JACK,
            "Full fee should go to treasury at start"
        );

        Assert.equal(
            netAmount,
            999 * ONE_JACK,
            "Receiver should get 999 JACK"
        );
    }

    function testTransferAfterTreasuryTakesFeeAndCallsPushFee() public {
        jack.setTreasury(address(mockTreasury));

        uint256 supplyBefore = jack.totalSupply();
        uint256 burnedBefore = jack.totalBurned();

        bool success = jack.transfer(receiver, ONE_THOUSAND_JACK);

        Assert.equal(success, true, "Transfer should succeed");

        Assert.equal(
            jack.balanceOf(receiver),
            999 * ONE_JACK,
            "Receiver should receive net amount"
        );

        Assert.equal(
            jack.balanceOf(address(mockTreasury)),
            ONE_JACK,
            "Treasury should receive 1 JACK fee"
        );

        Assert.equal(
            mockTreasury.pushedFeeTotal(),
            ONE_JACK,
            "Treasury should record pushed fee"
        );

        Assert.equal(
            mockTreasury.pushFeeCallCount(),
            1,
            "pushFee should be called once"
        );

        Assert.equal(
            jack.totalSupply(),
            supplyBefore,
            "Supply should not change because starting burn share is 0%"
        );

        Assert.equal(
            jack.totalBurned(),
            burnedBefore,
            "totalBurned should not change because burn share is 0%"
        );
    }

    function testTreasuryBalanceReducesFeeRate() public {
        jack.setTreasury(address(mockTreasury));

        uint256 feeBefore = jack.getCurrentFeeBP();

        jack.transfer(address(mockTreasury), 25_000_000 * ONE_JACK);

        uint256 feeAfter = jack.getCurrentFeeBP();

        Assert.ok(
            feeAfter < feeBefore,
            "Fee should reduce as treasury balance grows"
        );

        Assert.ok(
            jack.getConfiguredBurnShareBP() > 0,
            "Burn share should grow after treasury balance increases"
        );
    }

    function testUnsetTreasuryReturnsToNoFeeMode() public {
        jack.setTreasury(address(mockTreasury));

        Assert.equal(
            jack.isFeeActive(),
            true,
            "Fee should be active after treasury set"
        );

        jack.unsetTreasury();

        Assert.equal(
            jack.treasury(),
            address(0),
            "Treasury should be unset"
        );

        Assert.equal(
            jack.isTreasurySet(),
            false,
            "Treasury should not be active"
        );

        Assert.equal(
            jack.getCurrentFeeBP(),
            0,
            "Fee should return to zero"
        );

        Assert.equal(
            jack.isFeeActive(),
            false,
            "Fee should be inactive"
        );

        jack.transfer(receiverTwo, ONE_THOUSAND_JACK);

        Assert.equal(
            jack.balanceOf(receiverTwo),
            ONE_THOUSAND_JACK,
            "Receiver should get full amount after treasury unset"
        );
    }

    function testCanSetSameOrNewTreasuryAfterUnset() public {
        jack.setTreasury(address(mockTreasury));
        jack.unsetTreasury();

        MockJackTreasury newTreasury = new MockJackTreasury();

        jack.setTreasury(address(newTreasury));

        Assert.equal(
            jack.treasury(),
            address(newTreasury),
            "New treasury should be set after unset"
        );

        Assert.equal(
            jack.isFeeActive(),
            true,
            "Fee should become active again after new treasury is set"
        );
    }

    function testRemoveAllowedContractWorks() public {
        jack.setTreasury(address(mockTreasury));

        Assert.equal(
            jack.allowedContracts(address(mockTreasury)),
            true,
            "Treasury should start as allowed"
        );

        jack.removeAllowedContract(address(mockTreasury));

        Assert.equal(
            jack.allowedContracts(address(mockTreasury)),
            false,
            "Treasury should be removed from allowed mapping"
        );
    }
}