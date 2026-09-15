// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IJackTreasurySwapExecutor {
    function owner() external view returns (address);
    function treasury() external view returns (address);
    function JACK() external view returns (address);
    function router() external view returns (address);
    function wpls() external view returns (address);
    function oracleHub() external view returns (address);

    function transferOwnership(address newOwner) external;
    function setTreasury(address newTreasury) external;
    function setRouter(address newRouter) external;
    function setWPLS(address newWpls) external;
    function setOracleHub(address newOracleHub) external;

    function executeERC20SwapToJack(
        address tokenIn,
        address[] calldata path,
        uint256 desiredAmountIn,
        address treasuryReceiver
    ) external returns (uint256 amountUsed, uint256 jackReceivedNet);

    function executeNativeSwapToJack(
        address[] calldata path,
        address treasuryReceiver
    ) external payable returns (uint256 amountUsed, uint256 jackReceivedNet);

    function previewSafeAmount(
        address[] calldata path,
        uint256 desiredAmountIn
    ) external view returns (uint256 safeAmount);

    function previewMinOut(
        address[] calldata path,
        uint256 amountIn
    ) external view returns (uint256 minOut);

    function rescueToken(address token, uint256 amount, address to) external;
    function rescueNative(uint256 amount, address to) external;
}