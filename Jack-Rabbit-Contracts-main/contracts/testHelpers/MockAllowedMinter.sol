// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Jack.sol";

contract MockAllowedMinter {
    JackToken public jack;

    constructor(address jackAddress) {
        jack = JackToken(jackAddress);
    }

    function callMint() external {
        jack.mint();
    }
}