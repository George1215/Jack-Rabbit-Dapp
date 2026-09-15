// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Optional: inherit standard ERC-20 interface for balance/transfer/allowance.
// This is handy if you ever need to treat WPLS like a normal ERC-20.
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IWPLS
 * @dev Minimal interface for Wrapped PLS (WPLS).
 * - deposit(): wrap native PLS into ERC-20 WPLS
 * - withdraw(): unwrap WPLS back to native PLS
 *
 * NOTE: Most WETH/WPLS implementations also implement the ERC-20 API,
 * so we extend IERC20 for convenience.
 */
interface IWPLS is IERC20 {
    /// @notice Wrap native PLS to WPLS. Send value = amount of PLS to wrap.
    function deposit() external payable;

    /// @notice Unwrap WPLS back to native PLS.
    function withdraw(uint256) external;
}
