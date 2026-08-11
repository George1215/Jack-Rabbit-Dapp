// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IJackTreasury {
    // =============================================================
    // EVENTS
    // =============================================================

    event ReceiveTokenAdded(address indexed token, address[] path);
    event ReceiveTokenRemoved(address indexed token);
    event PendingSwapStored(address indexed token, uint256 amountAdded, uint256 totalPending);
    event ReceiveTokenSentToProtocol(address indexed protocol, address indexed token, address indexed to, uint256 amount);
    event ReceiveTokenRequestSkipped(address indexed protocol, address indexed token, address indexed to, uint256 amountRequested);

    event SwapPathSet(address indexed token, address[] path);
    event TokenSwapped(address indexed token, uint256 amountIn, uint256 jackReceivedNet);

    event RouterSet(address indexed oldRouter, address indexed newRouter);
    event WPLSSet(address indexed wpls);
    event PdaiSet(address indexed pdai);

    event PdaiIncomeReceived(address indexed from, uint256 amountReceived);
    event PdaiReserveDeposited(address indexed from, uint256 amountReceived);
    event PdaiReserveSent(address indexed protocol, address indexed to, uint256 amount);

    event PegReturnReceived(address indexed protocol, address indexed token, uint256 amountReceived);
    event PushedFeeReclassifiedAsPegReturn(uint256 pushedRemoved, uint256 incomeRemoved);

    event LoanRepaid(uint256 burned, uint256 remainingLoan);

    event JackIncomeRecorded(uint256 jackNetRecorded);
    event PushedFeeRecorded(uint256 jackTreasuryPart);
    event PdaiIncomeRecorded(uint256 pdaiAmount);
    event PdaiReserveDepositRecorded(uint256 pdaiAmount);
    event JackPegReturnRecorded(uint256 jackAmount);
    event PdaiPegReturnRecorded(uint256 pdaiAmount);

    event HoldingTokenAdded(address indexed token);
    event HoldingTokenRemoved(address indexed token);
    event HoldingTokenDeposited(address indexed from, address indexed token, uint256 amountReceived);
    event HoldingsSynced(uint256 count);
    event HoldingSentToProtocol(address indexed protocol, address indexed token, address indexed to, uint256 amount);

    event LpTokenAdded(address indexed lpToken);
    event LpTokenRemoved(address indexed lpToken);
    event LpSentToProtocol(address indexed protocol, address indexed lpToken, address indexed to, uint256 amount);

    event JackRequestSkipped(
        address indexed protocol,
        address indexed to,
        uint256 netRequested,
        uint256 grossNeeded,
        uint256 availableGross
    );

    event JackRequestPartial(
        address indexed protocol,
        address indexed to,
        uint256 netRequested,
        uint256 netDelivered,
        uint256 grossSent
    );

    event LpRequestSkipped(
        address indexed protocol,
        address indexed lpToken,
        address indexed to,
        uint256 amountRequested
    );

    event ProtocolAuthorized(address indexed protocol);
    event ProtocolRevoked(address indexed protocol);

    // =============================================================
    // CORE ENTRYPOINTS
    // =============================================================

    function receiveFunds(address token, uint256 amount) external payable;

    function pushFee(uint256 amount) external;

    // =============================================================
    // HOLDING TOKEN DEPOSITS
    // =============================================================

    function depositHoldingToken(address token, uint256 amount) external payable;

    function syncHoldings() external;

    // =============================================================
    // 5-YEAR JACK / pDAI ACCOUNTING
    // =============================================================

    function ROLLING_DAYS() external view returns (uint256);

    function totalJackIncomeFiveYears() external view returns (uint256);
    function totalJackPushedFeesFiveYears() external view returns (uint256);

    function totalPdaiIncomeFiveYears() external view returns (uint256);
    function totalPdaiReserveDepositsFiveYears() external view returns (uint256);

    function totalJackPegReturnsFiveYears() external view returns (uint256);
    function totalPdaiPegReturnsFiveYears() external view returns (uint256);

    function getTodayJackIncome() external view returns (uint256);
    function getTodayJackPushedFees() external view returns (uint256);

    function getTodayPdaiIncome() external view returns (uint256);
    function getTodayPdaiReserveDeposits() external view returns (uint256);

    function getTodayJackPegReturns() external view returns (uint256);
    function getTodayPdaiPegReturns() external view returns (uint256);

    // =============================================================
    // JACK LOAN / REQUEST ACCOUNTING
    // =============================================================

    function loanOutstanding() external view returns (uint256);

    function requestJack(uint256 netAmount, address to) external;

    function withdrawJack(uint256 netAmount, address to) external;

    // =============================================================
    // RECEIVE / SWAP TOKENS
    // =============================================================

    function externalTokens(uint256 index) external view returns (address);

    function isExternalToken(address token) external view returns (bool);

    function swapPath(address token, uint256 index) external view returns (address);

    function pendingSwapBalances(address token) external view returns (uint256);

    function getExternalTokens() external view returns (address[] memory);

    function getPendingSwapBalance(address token) external view returns (uint256);

    function getReceiveTokenPendingBalances() external view returns (uint256[] memory);

    function requestExternalSwapToken(
        address token,
        uint256 amount,
        address to
    ) external;

    // =============================================================
    // HOLDING TOKENS
    // =============================================================

    function holdingTokens(uint256 index) external view returns (address);

    function isHoldingToken(address token) external view returns (bool);

    function trackedHoldings(address token) external view returns (uint256);

    function addHoldingToken(address token) external;

    function removeHoldingToken(address token) external;

    function requestHoldingToken(
        address token,
        uint256 amount,
        address to
    ) external;

    function getHoldingTokens() external view returns (address[] memory);

    function getTrackedHoldings() external view returns (uint256[] memory);

    function getUsableHoldingBalance(address token) external view returns (uint256);

    // =============================================================
    // LP SUPPORT
    // =============================================================

    function lpTokens(uint256 index) external view returns (address);

    function isLpToken(address lpToken) external view returns (bool);

    function addLpToken(address lpToken) external;

    function removeLpToken(address lpToken) external;

    function requestLp(
        address lpToken,
        uint256 amount,
        address to
    ) external;

    function withdrawLp(
        address lpToken,
        uint256 amount,
        address to
    ) external;

    function getLpTokens() external view returns (address[] memory);

    function getLpBalances() external view returns (uint256[] memory);

    // =============================================================
    // pDAI RESERVES / pDAI INCOME
    // =============================================================

    function pdai() external view returns (address);

    function treasuryPdaiReserves() external view returns (uint256);

    function totalPdaiReservesIn() external view returns (uint256);

    function totalPdaiReservesOut() external view returns (uint256);

    function setPdai(address _pdai) external;

    function depositPdaiReserve(uint256 amount) external;

    function receivePdaiIncome(uint256 amount) external;

    function requestPdaiReserve(
        uint256 amount,
        address to
    ) external;

    // =============================================================
    // PEG RETURN ACCOUNTING
    // =============================================================

    function receivePegReturn(
        address token,
        uint256 amount
    ) external;

    // =============================================================
    // RECEIVE TOKEN CONFIG
    // =============================================================

    function addTokenToReceiveList(
        address token,
        address[] calldata path
    ) external;

    function removeTokenFromReceiveList(address token) external;

    function setSwapPath(
        address token,
        address[] calldata path
    ) external;

    // =============================================================
    // PROTOCOL AUTHORIZATION
    // =============================================================

    function authorizedProtocols(address protocol) external view returns (bool);

    function authorizeProtocol(address protocol) external;

    function revokeProtocol(address protocol) external;

    // =============================================================
    // CORE CONFIG VIEWS
    // =============================================================

    function jackToken() external view returns (address);

    function JACK() external view returns (address);

    function router() external view returns (address);

    function wpls() external view returns (address);

    function MAX_BPS() external view returns (uint256);

    function slippageBps() external view returns (uint256);

    function paused() external view returns (bool);

    // =============================================================
    // OWNER CONFIG / SAFETY
    // =============================================================

    function setRouter(address _router) external;

    function setWPLS(address _wpls) external;

    function pause() external;

    function unpause() external;

    function withdrawExternalSwapToken(
        address token,
        uint256 amount,
        address to
    ) external;
}
