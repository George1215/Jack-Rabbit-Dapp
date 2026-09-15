// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IJackTreasury.sol";
import "./interfaces/IJackTreasurySwapExecutor.sol";
import "./interfaces/IERC20View.sol";

contract JackTreasuryLens {
    error ZeroAddress();

    uint256 private constant ROLLING_DAYS = 1825;

    address public immutable treasury;

    struct SystemStatus {
        address treasuryAddress;
        address ownerAddress;
        address jackAddress;
        address pdaiAddress;
        address swapExecutorAddress;
        address routerAddress;
        address wplsAddress;
        address oracleHubAddress;
        bool isPaused;
    }

    struct TreasuryOverview {
        address treasuryAddress;
        address ownerAddress;

        uint256 jackBalance;
        uint256 nativePlsBalance;

        address pdaiAddress;
        uint256 pdaiBalance;
        uint256 treasuryPdaiReserves;
        uint256 usablePdaiHolding;
        uint256 pendingPdaiSwap;
        uint256 totalPdaiReservesIn;
        uint256 totalPdaiReservesOut;

        uint256 totalJackIncomeFiveYears;
        uint256 todayJackIncome;
        uint256 totalJackPushedFeesFiveYears;
        uint256 todayJackPushedFees;

        uint256 totalPdaiIncomeFiveYears;
        uint256 todayPdaiIncome;
        uint256 totalPdaiReserveDepositsFiveYears;
        uint256 todayPdaiReserveDeposits;

        uint256 totalJackPegReturnsFiveYears;
        uint256 todayJackPegReturns;
        uint256 totalPdaiPegReturnsFiveYears;
        uint256 todayPdaiPegReturns;

        uint256 loanOutstanding;

        uint256 externalTokenCount;
        uint256 holdingTokenCount;
        uint256 lpTokenCount;

        address swapExecutorAddress;
        address routerAddress;
        address wplsAddress;
        address oracleHubAddress;

        bool isPaused;
    }

    struct FiveYearJackIn {
        uint256 totalJackIncomeFiveYears;
        uint256 todayJackIncome;
        uint256 totalJackPushedFeesFiveYears;
        uint256 todayJackPushedFees;
        uint256 totalJackPegReturnsFiveYears;
        uint256 todayJackPegReturns;
    }

    struct FiveYearPdaiIn {
        uint256 totalPdaiIncomeFiveYears;
        uint256 todayPdaiIncome;
        uint256 totalPdaiReserveDepositsFiveYears;
        uint256 todayPdaiReserveDeposits;
        uint256 totalPdaiPegReturnsFiveYears;
        uint256 todayPdaiPegReturns;
    }

    struct DailyBuckets {
        uint256 currentDay;
        uint256 selectedDay;
        uint256 jackIncome;
        uint256 jackPushedFees;
        uint256 pdaiIncome;
        uint256 pdaiReserveDeposits;
        uint256 jackPegReturns;
        uint256 pdaiPegReturns;
    }

    struct DailyRangeBuckets {
        uint256 startDay;
        uint256 endDay;
        uint256 jackIncome;
        uint256 jackPushedFees;
        uint256 pdaiIncome;
        uint256 pdaiReserveDeposits;
        uint256 jackPegReturns;
        uint256 pdaiPegReturns;
    }

    struct ProtectedReserves {
        uint256 jackBalance;
        uint256 nativePlsBalance;
        uint256 pdaiBalance;
        uint256 treasuryPdaiReserves;
        uint256 usablePdaiHolding;
        uint256 pendingPdaiSwap;
        uint256 loanOutstanding;
        uint256 externalTokenCount;
        uint256 holdingTokenCount;
        uint256 lpTokenCount;
    }

    struct ProtocolStatus {
        address protocol;
        bool isAuthorized;
    }

    struct PdaiBuckets {
        address pdaiAddress;
        uint256 pdaiBalance;
        uint256 treasuryPdaiReserves;
        uint256 usablePdaiHolding;
        uint256 pendingPdaiSwap;
        uint256 totalPdaiReservesIn;
        uint256 totalPdaiReservesOut;
    }

    struct ExternalSwapAsset {
        address token;
        uint256 actualBalance;
        uint256 pendingSwapBalance;
        bool isNativePls;
        bool isListed;
    }

    struct HoldingAsset {
        address token;
        uint256 actualBalance;
        uint256 usableHolding;
        uint256 pendingSwapBalance;
        bool isPdai;
        bool isNativePls;
        bool isListed;
    }

    struct LpAsset {
        address token;
        uint256 balance;
        bool isListed;
    }

    struct TokenLists {
        address[] externalTokens;
        address[] holdingTokens;
        address[] lpTokens;
    }

    constructor(address _treasury) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }

    function getSystemStatus() external view returns (SystemStatus memory status) {
        IJackTreasury t = IJackTreasury(treasury);

        (
            address router_,
            address wpls_,
            address oracleHub_
        ) = _executorAddresses(t.swapExecutor());

        status = SystemStatus({
            treasuryAddress: treasury,
            ownerAddress: t.owner(),
            jackAddress: t.JACK(),
            pdaiAddress: t.pdai(),
            swapExecutorAddress: t.swapExecutor(),
            routerAddress: router_,
            wplsAddress: wpls_,
            oracleHubAddress: oracleHub_,
            isPaused: t.paused()
        });
    }

    function getTreasuryOverview() external view returns (TreasuryOverview memory overview) {
        IJackTreasury t = IJackTreasury(treasury);

        address jack = t.JACK();
        address pdai = t.pdai();
        uint256 currentDay = t.getCurrentDay();

        address[] memory externalTokenList = t.getExternalTokens();
        address[] memory holdingTokenList = t.getHoldingTokens();
        address[] memory lpTokenList = t.getLpTokens();

        (
            uint256 pdaiBalance_,
            uint256 usablePdaiHolding_,
            uint256 pendingPdaiSwap_
        ) = _pdaiBucketNumbers(t, pdai);

        (
            address router_,
            address wpls_,
            address oracleHub_
        ) = _executorAddresses(t.swapExecutor());

        overview.treasuryAddress = treasury;
        overview.ownerAddress = t.owner();

        overview.jackBalance = IERC20View(jack).balanceOf(treasury);
        overview.nativePlsBalance = treasury.balance;

        overview.pdaiAddress = pdai;
        overview.pdaiBalance = pdaiBalance_;
        overview.treasuryPdaiReserves = t.treasuryPdaiReserves();
        overview.usablePdaiHolding = usablePdaiHolding_;
        overview.pendingPdaiSwap = pendingPdaiSwap_;
        overview.totalPdaiReservesIn = t.totalPdaiReservesIn();
        overview.totalPdaiReservesOut = t.totalPdaiReservesOut();

        overview.totalJackIncomeFiveYears = t.totalJackIncomeFiveYears();
        overview.todayJackIncome = t.getJackIncomeForDay(currentDay);
        overview.totalJackPushedFeesFiveYears = t.totalJackPushedFeesFiveYears();
        overview.todayJackPushedFees = t.getJackPushedFeesForDay(currentDay);

        overview.totalPdaiIncomeFiveYears = t.totalPdaiIncomeFiveYears();
        overview.todayPdaiIncome = t.getPdaiIncomeForDay(currentDay);
        overview.totalPdaiReserveDepositsFiveYears = t.totalPdaiReserveDepositsFiveYears();
        overview.todayPdaiReserveDeposits = t.getPdaiReserveDepositsForDay(currentDay);

        overview.totalJackPegReturnsFiveYears = t.totalJackPegReturnsFiveYears();
        overview.todayJackPegReturns = t.getJackPegReturnsForDay(currentDay);
        overview.totalPdaiPegReturnsFiveYears = t.totalPdaiPegReturnsFiveYears();
        overview.todayPdaiPegReturns = t.getPdaiPegReturnsForDay(currentDay);

        overview.loanOutstanding = t.loanOutstanding();

        overview.externalTokenCount = externalTokenList.length;
        overview.holdingTokenCount = holdingTokenList.length;
        overview.lpTokenCount = lpTokenList.length;

        overview.swapExecutorAddress = t.swapExecutor();
        overview.routerAddress = router_;
        overview.wplsAddress = wpls_;
        overview.oracleHubAddress = oracleHub_;

        overview.isPaused = t.paused();
    }

    function getFiveYearJackIn() external view returns (FiveYearJackIn memory data) {
        IJackTreasury t = IJackTreasury(treasury);
        uint256 currentDay = t.getCurrentDay();

        data = FiveYearJackIn({
            totalJackIncomeFiveYears: t.totalJackIncomeFiveYears(),
            todayJackIncome: t.getJackIncomeForDay(currentDay),
            totalJackPushedFeesFiveYears: t.totalJackPushedFeesFiveYears(),
            todayJackPushedFees: t.getJackPushedFeesForDay(currentDay),
            totalJackPegReturnsFiveYears: t.totalJackPegReturnsFiveYears(),
            todayJackPegReturns: t.getJackPegReturnsForDay(currentDay)
        });
    }

    function getFiveYearPdaiIn() external view returns (FiveYearPdaiIn memory data) {
        IJackTreasury t = IJackTreasury(treasury);
        uint256 currentDay = t.getCurrentDay();

        data = FiveYearPdaiIn({
            totalPdaiIncomeFiveYears: t.totalPdaiIncomeFiveYears(),
            todayPdaiIncome: t.getPdaiIncomeForDay(currentDay),
            totalPdaiReserveDepositsFiveYears: t.totalPdaiReserveDepositsFiveYears(),
            todayPdaiReserveDeposits: t.getPdaiReserveDepositsForDay(currentDay),
            totalPdaiPegReturnsFiveYears: t.totalPdaiPegReturnsFiveYears(),
            todayPdaiPegReturns: t.getPdaiPegReturnsForDay(currentDay)
        });
    }

    function getDailyBuckets(uint256 day_) external view returns (DailyBuckets memory data) {
        IJackTreasury t = IJackTreasury(treasury);

        data = DailyBuckets({
            currentDay: t.getCurrentDay(),
            selectedDay: day_,
            jackIncome: t.getJackIncomeForDay(day_),
            jackPushedFees: t.getJackPushedFeesForDay(day_),
            pdaiIncome: t.getPdaiIncomeForDay(day_),
            pdaiReserveDeposits: t.getPdaiReserveDepositsForDay(day_),
            jackPegReturns: t.getJackPegReturnsForDay(day_),
            pdaiPegReturns: t.getPdaiPegReturnsForDay(day_)
        });
    }

    function getDailyRangeBuckets(uint256 startDay, uint256 endDay)
        external
        view
        returns (DailyRangeBuckets memory totals)
    {
        IJackTreasury t = IJackTreasury(treasury);

        if (endDay < startDay) return totals;

        uint256 span = endDay - startDay + 1;

        if (span > ROLLING_DAYS) {
            startDay = endDay + 1 - ROLLING_DAYS;
        }

        totals.startDay = startDay;
        totals.endDay = endDay;

        for (uint256 d = startDay; d <= endDay; d++) {
            totals.jackIncome += t.getJackIncomeForDay(d);
            totals.jackPushedFees += t.getJackPushedFeesForDay(d);
            totals.pdaiIncome += t.getPdaiIncomeForDay(d);
            totals.pdaiReserveDeposits += t.getPdaiReserveDepositsForDay(d);
            totals.jackPegReturns += t.getJackPegReturnsForDay(d);
            totals.pdaiPegReturns += t.getPdaiPegReturnsForDay(d);
        }
    }

    function getProtectedReserves() external view returns (ProtectedReserves memory reserves) {
        IJackTreasury t = IJackTreasury(treasury);

        address jack = t.JACK();
        address pdai = t.pdai();

        address[] memory externalTokenList = t.getExternalTokens();
        address[] memory holdingTokenList = t.getHoldingTokens();
        address[] memory lpTokenList = t.getLpTokens();

        (
            uint256 pdaiBalance_,
            uint256 usablePdaiHolding_,
            uint256 pendingPdaiSwap_
        ) = _pdaiBucketNumbers(t, pdai);

        reserves.jackBalance = IERC20View(jack).balanceOf(treasury);
        reserves.nativePlsBalance = treasury.balance;

        reserves.pdaiBalance = pdaiBalance_;
        reserves.treasuryPdaiReserves = t.treasuryPdaiReserves();
        reserves.usablePdaiHolding = usablePdaiHolding_;
        reserves.pendingPdaiSwap = pendingPdaiSwap_;

        reserves.loanOutstanding = t.loanOutstanding();

        reserves.externalTokenCount = externalTokenList.length;
        reserves.holdingTokenCount = holdingTokenList.length;
        reserves.lpTokenCount = lpTokenList.length;
    }

    function getProtocolStatus(address protocol) external view returns (ProtocolStatus memory data) {
        IJackTreasury t = IJackTreasury(treasury);

        data = ProtocolStatus({
            protocol: protocol,
            isAuthorized: t.authorizedProtocols(protocol)
        });
    }

    function getPdaiBuckets() external view returns (PdaiBuckets memory buckets) {
        IJackTreasury t = IJackTreasury(treasury);

        address pdai = t.pdai();

        (
            uint256 pdaiBalance_,
            uint256 usablePdaiHolding_,
            uint256 pendingPdaiSwap_
        ) = _pdaiBucketNumbers(t, pdai);

        buckets.pdaiAddress = pdai;
        buckets.pdaiBalance = pdaiBalance_;
        buckets.treasuryPdaiReserves = t.treasuryPdaiReserves();
        buckets.usablePdaiHolding = usablePdaiHolding_;
        buckets.pendingPdaiSwap = pendingPdaiSwap_;
        buckets.totalPdaiReservesIn = t.totalPdaiReservesIn();
        buckets.totalPdaiReservesOut = t.totalPdaiReservesOut();
    }

    function getTokenLists() external view returns (TokenLists memory lists) {
        IJackTreasury t = IJackTreasury(treasury);

        lists = TokenLists({
            externalTokens: t.getExternalTokens(),
            holdingTokens: t.getHoldingTokens(),
            lpTokens: t.getLpTokens()
        });
    }

    function getExternalSwapAssets() external view returns (ExternalSwapAsset[] memory assets) {
        IJackTreasury t = IJackTreasury(treasury);

        address[] memory tokens = t.getExternalTokens();
        assets = new ExternalSwapAsset[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];

            assets[i] = ExternalSwapAsset({
                token: token,
                actualBalance: _nativeOrTokenBalance(token),
                pendingSwapBalance: t.pendingSwapBalances(token),
                isNativePls: token == address(0),
                isListed: t.isExternalToken(token)
            });
        }
    }

    function getHoldingAssets() external view returns (HoldingAsset[] memory assets) {
        IJackTreasury t = IJackTreasury(treasury);

        address pdai = t.pdai();
        address[] memory tokens = t.getHoldingTokens();

        assets = new HoldingAsset[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];

            assets[i] = HoldingAsset({
                token: token,
                actualBalance: _nativeOrTokenBalance(token),
                usableHolding: _usableHoldingBalance(t, token),
                pendingSwapBalance: t.pendingSwapBalances(token),
                isPdai: pdai != address(0) && token == pdai,
                isNativePls: token == address(0),
                isListed: t.isHoldingToken(token)
            });
        }
    }

    function getLpAssets() external view returns (LpAsset[] memory assets) {
        IJackTreasury t = IJackTreasury(treasury);

        address[] memory tokens = t.getLpTokens();
        assets = new LpAsset[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];

            assets[i] = LpAsset({
                token: token,
                balance: IERC20View(token).balanceOf(treasury),
                isListed: t.isLpToken(token)
            });
        }
    }

    function getExternalSwapAsset(address token) external view returns (ExternalSwapAsset memory asset) {
        IJackTreasury t = IJackTreasury(treasury);

        asset = ExternalSwapAsset({
            token: token,
            actualBalance: _nativeOrTokenBalance(token),
            pendingSwapBalance: t.pendingSwapBalances(token),
            isNativePls: token == address(0),
            isListed: t.isExternalToken(token)
        });
    }

    function getHoldingAsset(address token) external view returns (HoldingAsset memory asset) {
        IJackTreasury t = IJackTreasury(treasury);

        address pdai = t.pdai();

        asset = HoldingAsset({
            token: token,
            actualBalance: _nativeOrTokenBalance(token),
            usableHolding: _usableHoldingBalance(t, token),
            pendingSwapBalance: t.pendingSwapBalances(token),
            isPdai: pdai != address(0) && token == pdai,
            isNativePls: token == address(0),
            isListed: t.isHoldingToken(token)
        });
    }

    function getLpAsset(address token) external view returns (LpAsset memory asset) {
        IJackTreasury t = IJackTreasury(treasury);

        asset = LpAsset({
            token: token,
            balance: IERC20View(token).balanceOf(treasury),
            isListed: t.isLpToken(token)
        });
    }

    function _pdaiBucketNumbers(
        IJackTreasury t,
        address pdai
    )
        internal
        view
        returns (
            uint256 pdaiBalance_,
            uint256 usablePdaiHolding_,
            uint256 pendingPdaiSwap_
        )
    {
        if (pdai == address(0)) {
            return (0, 0, 0);
        }

        pdaiBalance_ = IERC20View(pdai).balanceOf(treasury);
        usablePdaiHolding_ = _usableHoldingBalance(t, pdai);
        pendingPdaiSwap_ = t.pendingSwapBalances(pdai);
    }

    function _usableHoldingBalance(
        IJackTreasury t,
        address token
    ) internal view returns (uint256 usable) {
        if (!t.isHoldingToken(token)) return 0;

        uint256 actualBalance = _nativeOrTokenBalance(token);
        uint256 locked = t.pendingSwapBalances(token);

        address pdai = t.pdai();

        if (pdai != address(0) && token == pdai) {
            locked += t.treasuryPdaiReserves();
        }

        if (actualBalance <= locked) return 0;

        usable = actualBalance - locked;
    }

    function _nativeOrTokenBalance(address token) internal view returns (uint256) {
        if (token == address(0)) {
            return treasury.balance;
        }

        return IERC20View(token).balanceOf(treasury);
    }

    function _executorAddresses(address executor)
        internal
        view
        returns (
            address router_,
            address wpls_,
            address oracleHub_
        )
    {
        if (executor == address(0)) {
            return (address(0), address(0), address(0));
        }

        IJackTreasurySwapExecutor e = IJackTreasurySwapExecutor(executor);

        router_ = e.router();
        wpls_ = e.wpls();
        oracleHub_ = e.oracleHub();
    }
}