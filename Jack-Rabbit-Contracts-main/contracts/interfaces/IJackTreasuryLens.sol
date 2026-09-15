// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IJackTreasuryLens {
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

    function treasury() external view returns (address);

    function getSystemStatus() external view returns (SystemStatus memory);
    function getTreasuryOverview() external view returns (TreasuryOverview memory);
    function getFiveYearJackIn() external view returns (FiveYearJackIn memory);
    function getFiveYearPdaiIn() external view returns (FiveYearPdaiIn memory);
    function getDailyBuckets(uint256 day_) external view returns (DailyBuckets memory);
    function getDailyRangeBuckets(uint256 startDay, uint256 endDay) external view returns (DailyRangeBuckets memory);
    function getProtectedReserves() external view returns (ProtectedReserves memory);
    function getProtocolStatus(address protocol) external view returns (ProtocolStatus memory);
    function getPdaiBuckets() external view returns (PdaiBuckets memory);
    function getTokenLists() external view returns (TokenLists memory);
    function getExternalSwapAssets() external view returns (ExternalSwapAsset[] memory);
    function getHoldingAssets() external view returns (HoldingAsset[] memory);
    function getLpAssets() external view returns (LpAsset[] memory);
    function getExternalSwapAsset(address token) external view returns (ExternalSwapAsset memory);
    function getHoldingAsset(address token) external view returns (HoldingAsset memory);
    function getLpAsset(address token) external view returns (LpAsset memory);
}