// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IJackFarm {
    // =============================================================
    // ENUMS
    // =============================================================

    enum PoolStatus {
        Active,
        Paused,
        Ended,
        Removed
    }

    enum OverridePeriod {
        D1,
        W1,
        M1,
        M3,
        M6,
        Y1
    }

    // =============================================================
    // STRUCTS
    // =============================================================

    struct RewardStream {
        address token;
        uint256 rewardRate;
        uint256 periodFinish;
        uint256 lastRewardTime;
        uint256 accRewardPerShare;
        uint256 reserved;
        uint256 queuedRewards;
    }

    struct PoolInfo {
        address lpToken;
        address pairedRewardToken;
        uint256 epoch;
        uint256 totalStaked;

        uint16 baseRewardDurationDays;
        uint16 rewardDurationDays;

        bool manualOverrideActive;
        uint64 manualOverrideUntil;

        bool autoAdjustEnabled;
        uint256 targetStake;
        uint64 lastAutoAdjust;
        uint32 autoCooldown;
        uint16 autoStepDays;

        PoolStatus status;

        RewardStream jackStream;
        RewardStream pairedStream;
    }

    struct UserInfo {
        uint256 amount;
        uint256 jackRewardDebt;
        uint256 pairedRewardDebt;
        uint256 unpaidJack;
        uint256 unpaidPaired;
    }

    // =============================================================
    // EVENTS
    // =============================================================

    event PoolAdded(
        uint256 indexed poolId,
        uint256 indexed epoch,
        address indexed lpToken,
        address pairedRewardToken,
        uint256 targetStake,
        bool autoAdjustEnabled
    );

    event PoolPaused(uint256 indexed poolId, bool paused);
    event PoolEnded(uint256 indexed poolId, uint256 movedJackToTreasury, uint256 movedPairedToTreasury);
    event PoolRemoved(uint256 indexed poolId);
    event PoolSynced(uint256 indexed poolId, uint16 rewardDurationDays);

    event Deposit(
        address indexed user,
        uint256 indexed poolId,
        uint256 receivedAmount,
        uint256 stakedAmount,
        uint256 protocolFee
    );

    event Withdraw(address indexed user, uint256 indexed poolId, uint256 amount);

    event EmergencyWithdraw(
        address indexed user,
        uint256 indexed poolId,
        uint256 amount,
        uint256 forfeitedJack,
        uint256 forfeitedPaired
    );

    event Harvest(
        address indexed user,
        uint256 indexed poolId,
        address indexed rewardToken,
        uint256 paid,
        uint256 unpaidRemaining
    );

    event RewardDeposited(address indexed from, address indexed token, uint256 amountReceived);
    event RewardSynced(address indexed token, uint256 amountSynced);
    event RewardRoutedToPool(address indexed token, uint256 indexed poolId, uint256 amount);
    event RewardSentToTreasury(address indexed token, uint256 amount, uint8 indexed reason);
    event LpFeeDepositedToTreasury(address indexed lpToken, uint256 amount);

    event ProtocolFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event FarmDepositsPaused(bool paused);

    event PoolBaseRewardDurationUpdated(uint256 indexed poolId, uint16 durationDays);

    event ManualRewardDurationSet(
        uint256 indexed poolId,
        uint16 durationDays,
        uint64 overrideUntil,
        OverridePeriod period
    );

    event ManualRewardDurationCleared(uint256 indexed poolId);
    event ManualRewardDurationExpired(uint256 indexed poolId);

    event PoolRewardDurationUpdated(
        uint256 indexed poolId,
        uint16 oldDurationDays,
        uint16 newDurationDays,
        bool automatic
    );

    event PoolAutoConfigUpdated(
        uint256 indexed poolId,
        bool enabled,
        uint256 targetStake,
        uint32 cooldown,
        uint16 stepDays
    );

    event RewardSurplusWithdrawn(address indexed token, address indexed to, uint256 amount);
    event UnsupportedTokenRescued(address indexed token, address indexed to, uint256 amount);
    event LpSurplusRescued(address indexed lpToken, address indexed to, uint256 amount);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // =============================================================
    // CONSTANT GETTERS
    // =============================================================

    function FEE_DENOMINATOR() external view returns (uint256);

    function MAX_PROTOCOL_FEE_BPS() external view returns (uint256);

    function ACC_PRECISION() external view returns (uint256);

    function MIN_MANUAL_REWARD_DAYS() external view returns (uint16);

    function MAX_REWARD_DAYS() external view returns (uint16);

    function BASE_AUTO_MIN_REWARD_DAYS() external view returns (uint16);

    function DEFAULT_REWARD_DAYS() external view returns (uint16);

    function DEFAULT_AUTO_STEP_DAYS() external view returns (uint16);

    function DEFAULT_AUTO_COOLDOWN() external view returns (uint32);

    // =============================================================
    // CORE READ FUNCTIONS
    // =============================================================

    function owner() external view returns (address);

    function jack() external view returns (address);

    function treasury() external view returns (address);

    function protocolFeeBps() external view returns (uint256);

    function farmDepositsPaused() external view returns (bool);

    function runningPoolCount() external view returns (uint256);

    function poolCount() external view returns (uint256);

    function getPool(uint256 poolId) external view returns (PoolInfo memory);

    function getAcceptedRewardTokens() external view returns (address[] memory);

    function userInfo(uint256 poolId, address user)
        external
        view
        returns (
            uint256 amount,
            uint256 jackRewardDebt,
            uint256 pairedRewardDebt,
            uint256 unpaidJack,
            uint256 unpaidPaired
        );

    function acceptedRewardToken(address token) external view returns (bool);

    function isPoolLpToken(address token) external view returns (bool);

    function totalStakedByLpToken(address lpToken) external view returns (uint256);

    function trackedBalance(address token) external view returns (uint256);

    function reservedRewards(address token) external view returns (uint256);

    function activePoolForRewardToken(address token) external view returns (uint256);

    function latestEpoch(address lpToken, address pairedRewardToken) external view returns (uint256);

    function pendingRewards(uint256 poolId, address account)
        external
        view
        returns (uint256 pendingJack, uint256 pendingPaired);

    function pendingToken(
        uint256 poolId,
        address account,
        address rewardToken
    ) external view returns (uint256);

    function getWithdrawableRewardSurplus(address token) external view returns (uint256);

    function getLpTokenSurplus(address lpToken) external view returns (uint256);

    function getAutoMinRewardDays() external view returns (uint256);

    // =============================================================
    // USER FUNCTIONS
    // =============================================================

    function deposit(uint256 poolId, uint256 amount) external;

    function withdraw(uint256 poolId, uint256 amount) external;

    function harvest(uint256 poolId) external;

    function harvestToken(uint256 poolId, address rewardToken) external;

    function emergencyWithdraw(uint256 poolId) external;

    // =============================================================
    // REWARD DEPOSIT / SYNC
    // =============================================================

    function depositReward(address token, uint256 amount) external returns (uint256 actualReceived);

    function syncRewardToken(address token) external returns (uint256 amountSynced);

    function syncPool(uint256 poolId) external;

    // =============================================================
    // ADMIN POOL MANAGEMENT
    // =============================================================

    function addPool(
        address lpToken,
        address pairedRewardToken,
        uint256 targetStake,
        bool autoAdjustEnabled
    ) external returns (uint256 poolId);

    function setPoolPaused(uint256 poolId, bool paused) external;

    function endPool(uint256 poolId) external;

    function markPoolRemoved(uint256 poolId) external;

    function setFarmDepositsPaused(bool paused) external;

    // =============================================================
    // ADMIN REWARD DURATION / AUTO CONTROL
    // =============================================================

    function setPoolBaseRewardDuration(uint256 poolId, uint16 durationDays) external;

    function setManualRewardDuration(
        uint256 poolId,
        uint16 durationDays,
        OverridePeriod period
    ) external;

    function clearManualRewardDuration(uint256 poolId) external;

    function setPoolAutoConfig(
        uint256 poolId,
        bool enabled,
        uint256 targetStake,
        uint32 cooldown,
        uint16 stepDays
    ) external;

    // =============================================================
    // ADMIN TREASURY / FEES / WITHDRAWALS
    // =============================================================

    function setTreasury(address newTreasury) external;

    function setProtocolFeeBps(uint256 newFeeBps) external;

    function withdrawRewardSurplus(address token, uint256 amount) external;

    function rescueUnsupportedToken(address token, uint256 amount) external;

    function rescueLpSurplus(address lpToken, uint256 amount) external;

    // =============================================================
    // OWNERSHIP
    // =============================================================

    function transferOwnership(address newOwner) external;
}