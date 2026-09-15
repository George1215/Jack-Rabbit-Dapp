// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Jack.sol";

contract MockTokenInteractor {
    function pullTokens(
        address jackAddress,
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        return JackToken(jackAddress).transferFrom(from, to, amount);
    }

    function trySetTreasury(
        address jackAddress,
        address treasury
    ) external {
        JackToken(jackAddress).setTreasury(treasury);
    }

    function trySetTreasuryTarget(
        address jackAddress,
        uint256 wholeTokenAmount
    ) external {
        JackToken(jackAddress).setTreasuryTarget(wholeTokenAmount);
    }

    function tryAdminMint(
        address jackAddress,
        uint256 amount
    ) external {
        JackToken(jackAddress).adminMint(amount);
    }
}