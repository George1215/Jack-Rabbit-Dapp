// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IJackTreasuryAdmin {
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SwapExecutorUpdated(address indexed oldExecutor, address indexed newExecutor);

    event ReceiveTokenAdded(address indexed token, address[] path);
    event ReceiveTokenRemoved(address indexed token);
    event SwapPathSet(address indexed token, address[] path);

    event PendingSwapStored(address indexed token, uint256 amountAdded, uint256 totalPending);
    event PendingSwapProcessed(address indexed token, uint256 requestedAmount, uint256 usedAmount, uint256 remainingPending);

    event HoldingTokenAdded(address indexed token);
    event HoldingTokenRemoved(address indexed token);
    event HoldingTokenDeposited(address indexed from, address indexed token, uint256 amountReceived);
    event HoldingSentToProtocol(address indexed protocol, address indexed token, address indexed to, uint256 amount);

    event LpTokenAdded(address indexed lpToken);
    event LpTokenRemoved(address indexed lpToken);
    event LpTokenDeposited(address indexed from, address indexed lpToken, uint256 amountReceived);
    event LpSentToProtocol(address indexed protocol, address indexed lpToken, address indexed to, uint256 amount);

    event ProtocolAuthorized(address indexed protocol);
    event ProtocolRevoked(address indexed protocol);

    event PdaiSet(address indexed pdai);
    event PdaiReserveDeposited(address indexed from, uint256 amountReceived);
    event PdaiIncomeReceived(address indexed from, uint256 amountReceived);
    event PdaiReserveSent(address indexed protocol, address indexed to, uint256 amount);

    event JackReserveDeposited(address indexed from, uint256 amountReceived);
    event PegReturnReceived(address indexed protocol, address indexed token, uint256 amountReceived);

    function owner() external view returns (address);
    function paused() external view returns (bool);
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

    function addLpToken(address lpToken) external;
    function removeLpToken(address lpToken) external;
    function depositLpToken(address lpToken, uint256 amount) external;
    function requestLp(address lpToken, uint256 amount, address to) external;
    function withdrawLp(address lpToken, uint256 amount, address to) external;

    function authorizeProtocol(address protocol) external;
    function revokeProtocol(address protocol) external;

    function setPdai(address _pdai) external;
    function depositPdaiReserve(uint256 amount) external;
    function receivePdaiIncome(uint256 amount) external;
    function requestPdaiReserve(uint256 amount, address to) external;

    function depositJackReserve(uint256 amount) external;
    function receivePegReturn(address token, uint256 amount) external;

    function receiveFunds(address token, uint256 amount) external payable;
    function processPendingSwap(address token, uint256 maxAmount) external returns (uint256 usedAmount);
}