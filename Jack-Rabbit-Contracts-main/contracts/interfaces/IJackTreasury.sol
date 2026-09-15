// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IJackTreasury {
    function owner() external view returns (address);
    function paused() external view returns (bool);
    function JACK() external view returns (address);
    function pdai() external view returns (address);
    function swapExecutor() external view returns (address);

    function treasuryPdaiReserves() external view returns (uint256);
    function totalPdaiReservesIn() external view returns (uint256);
    function totalPdaiReservesOut() external view returns (uint256);
    function loanOutstanding() external view returns (uint256);

    function authorizedProtocols(address protocol) external view returns (bool);

    function getCurrentDay() external view returns (uint256);
    function getJackIncomeForDay(uint256 day_) external view returns (uint256);
    function getJackPushedFeesForDay(uint256 day_) external view returns (uint256);
    function getPdaiIncomeForDay(uint256 day_) external view returns (uint256);
    function getPdaiReserveDepositsForDay(uint256 day_) external view returns (uint256);
    function getJackPegReturnsForDay(uint256 day_) external view returns (uint256);
    function getPdaiPegReturnsForDay(uint256 day_) external view returns (uint256);

    function totalJackIncomeFiveYears() external view returns (uint256);
    function totalJackPushedFeesFiveYears() external view returns (uint256);
    function totalPdaiIncomeFiveYears() external view returns (uint256);
    function totalPdaiReserveDepositsFiveYears() external view returns (uint256);
    function totalJackPegReturnsFiveYears() external view returns (uint256);
    function totalPdaiPegReturnsFiveYears() external view returns (uint256);

    function isExternalToken(address token) external view returns (bool);
    function getExternalTokens() external view returns (address[] memory);
    function pendingSwapBalances(address token) external view returns (uint256);

    function isHoldingToken(address token) external view returns (bool);
    function getHoldingTokens() external view returns (address[] memory);

    function isLpToken(address token) external view returns (bool);
    function getLpTokens() external view returns (address[] memory);

    function transferOwnership(address newOwner) external;
    function setSwapExecutor(address newExecutor) external;
    function pause() external;
    function unpause() external;

    function addTokenToReceiveList(address token, address[] calldata path) external;
    function removeTokenFromReceiveList(address token) external;
    function setSwapPath(address token, address[] calldata path) external;
    function setNativeSwapPath(address[] calldata path) external;

    function addHoldingToken(address token) external;
    function removeHoldingToken(address token) external;
    function depositHoldingToken(address token, uint256 amount) external payable;
    function requestHoldingToken(address token, uint256 amount, address to) external;

    function pushFee(uint256 amount) external;
    function requestJack(uint256 netAmount, address to) external;

    function setPdai(address _pdai) external;
    function depositPdaiReserve(uint256 amount) external;
    function receivePdaiIncome(uint256 amount) external;
    function requestPdaiReserve(uint256 amount, address to) external;

    function receivePegReturn(address token, uint256 amount) external;
    function depositJackReserve(uint256 amount) external;

    function receiveFunds(address token, uint256 amount) external payable;
    function processPendingSwap(address token, uint256 maxAmount) external returns (uint256 usedAmount);

    function authorizeProtocol(address protocol) external;
    function revokeProtocol(address protocol) external;

    function addLpToken(address lpToken) external;
    function removeLpToken(address lpToken) external;
    function depositLpToken(address lpToken, uint256 amount) external;
    function requestLp(address lpToken, uint256 amount, address to) external;
    function withdrawLp(address lpToken, uint256 amount, address to) external;
}