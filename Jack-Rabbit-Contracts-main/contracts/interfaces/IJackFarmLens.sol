// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IJackFarmLens {
    // =============================================================
    // ENUMS
    // =============================================================

    enum PoolStatus {
        Active,
        Paused,
        Ended,
        Removed
    }

    // =============================================================
    // STRUCTS
    // =============================================================

    struct FarmDashboard {
        address farmAddress;
        address jack;
        address treasury;
        uint256 protocolFeeBps;
        bool farmDepositsPaused;
        uint256 totalPoolCount;
        uint256 runningPoolCount;
        uint256 acceptedRewardTokenCount;
        uint256 autoMinRewardDays;
        bool nativePLSSupported;
    }

    struct StreamDashboard {
        address rewardToken;
        bool isNativePLS;
        uint256 rewardRate;
        uint256 rewardPerDay;
        uint256 periodFinish;
        uint256 lastRewardTime;
        uint256 accRewardPerShare;
        uint256 reserved;
        uint256 queuedRewards;
        uint256 unvestedRewards;
        uint256 earnedButUnclaimedEstimate;
        bool active;
    }

    struct PoolDashboard {
        uint256 poolId;
        uint256 epoch;
        address lpToken;
        address pairedRewardToken;
        bool pairedRewardIsNativePLS;
        PoolStatus status;

        uint256 totalStaked;
        uint256 totalStakedForLpToken;
        uint256 farmLpActualBalance;
        uint256 lpSurplus;
        uint256 poolShareOfLpTokenBps;

        uint16 baseRewardDurationDays;
        uint16 rewardDurationDays;

        bool manualOverrideActive;
        uint64 manualOverrideUntil;
        uint256 manualOverrideSecondsLeft;

        bool autoAdjustEnabled;
        uint256 targetStake;
        uint256 stakeTargetBps;
        uint64 lastAutoAdjust;
        uint32 autoCooldown;
        uint256 nextAutoAdjustTime;
        uint16 autoStepDays;
        uint256 autoMinRewardDays;

        StreamDashboard jackReward;
        StreamDashboard pairedReward;
    }

    struct UserPosition {
        uint256 poolId;
        address user;

        uint256 userStakedLp;
        uint256 poolTotalStaked;
        uint256 userPoolShareBps;

        uint256 pendingJack;
        uint256 pendingPaired;

        uint256 jackRewardDebt;
        uint256 pairedRewardDebt;
        uint256 unpaidJack;
        uint256 unpaidPaired;
    }

    struct RewardTokenDashboard {
        address token;
        bool isAccepted;
        bool isJack;
        bool isNativePLS;

        uint256 actualBalance;
        uint256 trackedBalance;
        uint256 reservedRewards;

        uint256 allocatedToActiveRewards;
        uint256 earnedButUnclaimedEstimate;

        uint256 untrackedBalance;
        uint256 unallocatedTrackedBalance;
        uint256 withdrawableSurplus;

        uint256 activePoolIdPlusOne;
        bool hasActivePool;
        bool willRouteToTreasuryIfSynced;
    }

    struct LpTokenDashboard {
        address lpToken;
        bool isPoolLpToken;
        uint256 actualBalance;
        uint256 totalStakedByLpToken;
        uint256 lpSurplus;
    }

    struct RemovalSafety {
        uint256 poolId;
        bool canMarkRemoved;
        string reason;

        uint256 totalStaked;

        uint256 jackReserved;
        uint256 pairedReserved;

        uint256 jackUnvestedRewards;
        uint256 pairedUnvestedRewards;

        uint256 jackEarnedButUnclaimedEstimate;
        uint256 pairedEarnedButUnclaimedEstimate;
    }

    // =============================================================
    // CORE VIEW
    // =============================================================

    function farm() external view returns (address);

    function PLS() external pure returns (address);

    function BPS() external pure returns (uint256);

    // =============================================================
    // MAIN DASHBOARD
    // =============================================================

    function getFarmDashboard() external view returns (FarmDashboard memory data);

    // =============================================================
    // POOL LIST HELPERS
    // =============================================================

    function getActivePoolIds() external view returns (uint256[] memory ids);

    function getPausedPoolIds() external view returns (uint256[] memory ids);

    function getEndedPoolIds() external view returns (uint256[] memory ids);

    function getRemovedPoolIds() external view returns (uint256[] memory ids);

    function getPoolsByStatus(PoolStatus status) external view returns (uint256[] memory ids);

    function getRunningPoolIds() external view returns (uint256[] memory ids);

    // =============================================================
    // POOL DASHBOARD
    // =============================================================

    function getPoolDashboard(uint256 poolId) external view returns (PoolDashboard memory data);

    function getAllPoolDashboards() external view returns (PoolDashboard[] memory data);

    function getPoolDashboards(uint256[] calldata poolIds)
        external
        view
        returns (PoolDashboard[] memory data);

    // =============================================================
    // USER POSITION HELPERS
    // =============================================================

    function getUserPosition(uint256 poolId, address user)
        external
        view
        returns (UserPosition memory data);

    function getUserPositions(address user) external view returns (UserPosition[] memory data);

    function getUserPositionsForPools(address user, uint256[] calldata poolIds)
        external
        view
        returns (UserPosition[] memory data);

    function getUserStakedAmount(uint256 poolId, address user) external view returns (uint256 amount);

    // =============================================================
    // REWARD TOKEN DASHBOARD
    // =============================================================

    function getRewardTokenDashboard(address token)
        external
        view
        returns (RewardTokenDashboard memory data);

    function getAllRewardTokenDashboards()
        external
        view
        returns (RewardTokenDashboard[] memory data);

    function getRewardTokenDashboards(address[] calldata tokens)
        external
        view
        returns (RewardTokenDashboard[] memory data);

    // =============================================================
    // LP TOKEN DASHBOARD
    // =============================================================

    function getLpTokenDashboard(address lpToken)
        external
        view
        returns (LpTokenDashboard memory data);

    function getPoolLpDashboard(uint256 poolId)
        external
        view
        returns (LpTokenDashboard memory data);

    function getAllPoolLpDashboards()
        external
        view
        returns (LpTokenDashboard[] memory data);

    // =============================================================
    // ROUTING HELPERS
    // =============================================================

    function getRewardTokenRoutingInfo(address token)
        external
        view
        returns (
            bool isAccepted,
            bool isJack,
            bool isNativePLS,
            uint256 activePoolIdPlusOne,
            bool hasActivePool,
            bool willRouteToTreasuryIfSynced
        );

    // =============================================================
    // POOL REMOVAL SAFETY
    // =============================================================

    function getPoolRemovalSafety(uint256 poolId)
        external
        view
        returns (RemovalSafety memory data);

    // =============================================================
    // SIMPLE HELPERS
    // =============================================================

    function getPoolRewardTokens(uint256 poolId)
        external
        view
        returns (address jackRewardToken, address pairedRewardToken);

    function getPoolRewardRates(uint256 poolId)
        external
        view
        returns (
            uint256 jackRewardRate,
            uint256 jackRewardPerDay,
            uint256 pairedRewardRate,
            uint256 pairedRewardPerDay
        );

    function getPoolRewardEndTimes(uint256 poolId)
        external
        view
        returns (uint256 jackPeriodFinish, uint256 pairedPeriodFinish);

    function getUserPendingToken(
        uint256 poolId,
        address user,
        address rewardToken
    ) external view returns (uint256);
}