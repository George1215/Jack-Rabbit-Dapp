// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IJackFarmLens {
    enum PoolStatus {
        Active,
        Paused,
        Ended,
        Removed
    }

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

    function pendingRewards(uint256 poolId, address account)
        external
        view
        returns (uint256 pendingJack, uint256 pendingPaired);

    function pendingToken(
        uint256 poolId,
        address account,
        address rewardToken
    ) external view returns (uint256);

    function activePoolForRewardToken(address token) external view returns (uint256);
    function acceptedRewardToken(address token) external view returns (bool);
    function isPoolLpToken(address token) external view returns (bool);
    function totalStakedByLpToken(address lpToken) external view returns (uint256);
    function getAutoMinRewardDays() external view returns (uint256);

    function trackedBalance(address token) external view returns (uint256);
    function reservedRewards(address token) external view returns (uint256);
    function getWithdrawableRewardSurplus(address token) external view returns (uint256);
    function getLpTokenSurplus(address lpToken) external view returns (uint256);
}

interface IERC20Lens {
    function balanceOf(address account) external view returns (uint256);
}

contract JackFarmLens {
    IJackFarmLens public immutable farm;

    address public constant PLS = address(0);
    uint256 public constant BPS = 10_000;

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
        IJackFarmLens.PoolStatus status;

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

    constructor(address jackFarm_) {
        require(jackFarm_ != address(0), "ZERO_FARM");
        farm = IJackFarmLens(jackFarm_);
    }

    // =============================================================
    // MAIN DASHBOARD
    // =============================================================

    function getFarmDashboard() external view returns (FarmDashboard memory data) {
        address[] memory tokens = farm.getAcceptedRewardTokens();

        data.farmAddress = address(farm);
        data.jack = farm.jack();
        data.treasury = farm.treasury();
        data.protocolFeeBps = farm.protocolFeeBps();
        data.farmDepositsPaused = farm.farmDepositsPaused();
        data.totalPoolCount = farm.poolCount();
        data.runningPoolCount = farm.runningPoolCount();
        data.acceptedRewardTokenCount = tokens.length;
        data.autoMinRewardDays = farm.getAutoMinRewardDays();
        data.nativePLSSupported = farm.acceptedRewardToken(PLS);
    }

    // =============================================================
    // POOL LIST HELPERS
    // =============================================================

    function getActivePoolIds() external view returns (uint256[] memory ids) {
        return _getPoolsByStatus(IJackFarmLens.PoolStatus.Active);
    }

    function getPausedPoolIds() external view returns (uint256[] memory ids) {
        return _getPoolsByStatus(IJackFarmLens.PoolStatus.Paused);
    }

    function getEndedPoolIds() external view returns (uint256[] memory ids) {
        return _getPoolsByStatus(IJackFarmLens.PoolStatus.Ended);
    }

    function getRemovedPoolIds() external view returns (uint256[] memory ids) {
        return _getPoolsByStatus(IJackFarmLens.PoolStatus.Removed);
    }

    function getPoolsByStatus(IJackFarmLens.PoolStatus status)
        external
        view
        returns (uint256[] memory ids)
    {
        return _getPoolsByStatus(status);
    }

    function getRunningPoolIds() external view returns (uint256[] memory ids) {
        uint256 total = farm.poolCount();
        uint256 count;

        for (uint256 i = 0; i < total; i++) {
            IJackFarmLens.PoolInfo memory p = farm.getPool(i);

            if (
                p.status == IJackFarmLens.PoolStatus.Active ||
                p.status == IJackFarmLens.PoolStatus.Paused
            ) {
                count++;
            }
        }

        ids = new uint256[](count);
        uint256 index;

        for (uint256 i = 0; i < total; i++) {
            IJackFarmLens.PoolInfo memory p = farm.getPool(i);

            if (
                p.status == IJackFarmLens.PoolStatus.Active ||
                p.status == IJackFarmLens.PoolStatus.Paused
            ) {
                ids[index] = i;
                index++;
            }
        }
    }

    // =============================================================
    // POOL DASHBOARD
    // =============================================================

    function getPoolDashboard(uint256 poolId) public view returns (PoolDashboard memory data) {
        IJackFarmLens.PoolInfo memory p = farm.getPool(poolId);

        data.poolId = poolId;
        data.epoch = p.epoch;
        data.lpToken = p.lpToken;
        data.pairedRewardToken = p.pairedRewardToken;
        data.pairedRewardIsNativePLS = p.pairedRewardToken == PLS;
        data.status = p.status;

        data.totalStaked = p.totalStaked;
        data.totalStakedForLpToken = farm.totalStakedByLpToken(p.lpToken);
        data.farmLpActualBalance = _actualTokenBalance(p.lpToken);
        data.lpSurplus = farm.getLpTokenSurplus(p.lpToken);

        if (data.totalStakedForLpToken > 0) {
            data.poolShareOfLpTokenBps = (p.totalStaked * BPS) / data.totalStakedForLpToken;
        }

        data.baseRewardDurationDays = p.baseRewardDurationDays;
        data.rewardDurationDays = p.rewardDurationDays;

        data.manualOverrideActive = p.manualOverrideActive && block.timestamp < p.manualOverrideUntil;
        data.manualOverrideUntil = p.manualOverrideUntil;

        if (data.manualOverrideActive && p.manualOverrideUntil > block.timestamp) {
            data.manualOverrideSecondsLeft = p.manualOverrideUntil - block.timestamp;
        }

        data.autoAdjustEnabled = p.autoAdjustEnabled;
        data.targetStake = p.targetStake;

        if (p.targetStake > 0) {
            data.stakeTargetBps = (p.totalStaked * BPS) / p.targetStake;
        }

        data.lastAutoAdjust = p.lastAutoAdjust;
        data.autoCooldown = p.autoCooldown;

        if (p.lastAutoAdjust > 0) {
            data.nextAutoAdjustTime = uint256(p.lastAutoAdjust) + uint256(p.autoCooldown);
        }

        data.autoStepDays = p.autoStepDays;
        data.autoMinRewardDays = farm.getAutoMinRewardDays();

        data.jackReward = _streamDashboard(p.jackStream, p.totalStaked);
        data.pairedReward = _streamDashboard(p.pairedStream, p.totalStaked);
    }

    function getAllPoolDashboards() external view returns (PoolDashboard[] memory data) {
        uint256 total = farm.poolCount();

        data = new PoolDashboard[](total);

        for (uint256 i = 0; i < total; i++) {
            data[i] = getPoolDashboard(i);
        }
    }

    function getPoolDashboards(uint256[] calldata poolIds)
        external
        view
        returns (PoolDashboard[] memory data)
    {
        data = new PoolDashboard[](poolIds.length);

        for (uint256 i = 0; i < poolIds.length; i++) {
            data[i] = getPoolDashboard(poolIds[i]);
        }
    }

    // =============================================================
    // USER POSITION HELPERS
    // =============================================================

    function getUserPosition(uint256 poolId, address user) public view returns (UserPosition memory data) {
        IJackFarmLens.PoolInfo memory p = farm.getPool(poolId);

        (
            uint256 amount,
            uint256 jackRewardDebt,
            uint256 pairedRewardDebt,
            uint256 unpaidJack,
            uint256 unpaidPaired
        ) = farm.userInfo(poolId, user);

        (uint256 pendingJack, uint256 pendingPaired) = farm.pendingRewards(poolId, user);

        data.poolId = poolId;
        data.user = user;

        data.userStakedLp = amount;
        data.poolTotalStaked = p.totalStaked;

        if (p.totalStaked > 0) {
            data.userPoolShareBps = (amount * BPS) / p.totalStaked;
        }

        data.pendingJack = pendingJack;
        data.pendingPaired = pendingPaired;

        data.jackRewardDebt = jackRewardDebt;
        data.pairedRewardDebt = pairedRewardDebt;
        data.unpaidJack = unpaidJack;
        data.unpaidPaired = unpaidPaired;
    }

    function getUserPositions(address user) external view returns (UserPosition[] memory data) {
        uint256 total = farm.poolCount();

        data = new UserPosition[](total);

        for (uint256 i = 0; i < total; i++) {
            data[i] = getUserPosition(i, user);
        }
    }

    function getUserPositionsForPools(address user, uint256[] calldata poolIds)
        external
        view
        returns (UserPosition[] memory data)
    {
        data = new UserPosition[](poolIds.length);

        for (uint256 i = 0; i < poolIds.length; i++) {
            data[i] = getUserPosition(poolIds[i], user);
        }
    }

    function getUserStakedAmount(uint256 poolId, address user) external view returns (uint256 amount) {
        (amount, , , , ) = farm.userInfo(poolId, user);
    }

    // =============================================================
    // REWARD TOKEN DASHBOARD
    // =============================================================

    function getRewardTokenDashboard(address token) public view returns (RewardTokenDashboard memory data) {
        data.token = token;
        data.isAccepted = farm.acceptedRewardToken(token);
        data.isJack = token == farm.jack();
        data.isNativePLS = token == PLS;

        data.actualBalance = _actualRewardTokenBalance(token);
        data.trackedBalance = farm.trackedBalance(token);
        data.reservedRewards = farm.reservedRewards(token);

        (data.allocatedToActiveRewards, data.earnedButUnclaimedEstimate) = _tokenRewardBreakdown(token);

        if (data.actualBalance > data.trackedBalance) {
            data.untrackedBalance = data.actualBalance - data.trackedBalance;
        }

        if (data.trackedBalance > data.reservedRewards) {
            data.unallocatedTrackedBalance = data.trackedBalance - data.reservedRewards;
        }

        data.withdrawableSurplus = farm.getWithdrawableRewardSurplus(token);
        data.activePoolIdPlusOne = farm.activePoolForRewardToken(token);

        if (data.isJack) {
            data.hasActivePool = farm.runningPoolCount() > 0;
        } else {
            data.hasActivePool = data.activePoolIdPlusOne != 0;
        }

        data.willRouteToTreasuryIfSynced = data.isAccepted && !data.hasActivePool;
    }

    function getAllRewardTokenDashboards() external view returns (RewardTokenDashboard[] memory data) {
        address[] memory tokens = farm.getAcceptedRewardTokens();

        data = new RewardTokenDashboard[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            data[i] = getRewardTokenDashboard(tokens[i]);
        }
    }

    function getRewardTokenDashboards(address[] calldata tokens)
        external
        view
        returns (RewardTokenDashboard[] memory data)
    {
        data = new RewardTokenDashboard[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            data[i] = getRewardTokenDashboard(tokens[i]);
        }
    }

    // =============================================================
    // LP TOKEN DASHBOARD
    // =============================================================

    function getLpTokenDashboard(address lpToken) public view returns (LpTokenDashboard memory data) {
        data.lpToken = lpToken;
        data.isPoolLpToken = farm.isPoolLpToken(lpToken);
        data.actualBalance = _actualTokenBalance(lpToken);
        data.totalStakedByLpToken = farm.totalStakedByLpToken(lpToken);

        if (data.isPoolLpToken) {
            data.lpSurplus = farm.getLpTokenSurplus(lpToken);
        }
    }

    function getPoolLpDashboard(uint256 poolId) external view returns (LpTokenDashboard memory data) {
        IJackFarmLens.PoolInfo memory p = farm.getPool(poolId);
        return getLpTokenDashboard(p.lpToken);
    }

    function getAllPoolLpDashboards() external view returns (LpTokenDashboard[] memory data) {
        uint256 total = farm.poolCount();

        data = new LpTokenDashboard[](total);

        for (uint256 i = 0; i < total; i++) {
            IJackFarmLens.PoolInfo memory p = farm.getPool(i);
            data[i] = getLpTokenDashboard(p.lpToken);
        }
    }

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
        )
    {
        isAccepted = farm.acceptedRewardToken(token);
        isJack = token == farm.jack();
        isNativePLS = token == PLS;
        activePoolIdPlusOne = farm.activePoolForRewardToken(token);

        hasActivePool = isJack
            ? farm.runningPoolCount() > 0
            : activePoolIdPlusOne != 0;

        willRouteToTreasuryIfSynced = isAccepted && !hasActivePool;
    }

    // =============================================================
    // POOL REMOVAL SAFETY
    // =============================================================

    function getPoolRemovalSafety(uint256 poolId) external view returns (RemovalSafety memory data) {
        IJackFarmLens.PoolInfo memory p = farm.getPool(poolId);

        StreamDashboard memory jackData = _streamDashboard(p.jackStream, p.totalStaked);
        StreamDashboard memory pairedData = _streamDashboard(p.pairedStream, p.totalStaked);

        data.poolId = poolId;
        data.totalStaked = p.totalStaked;

        data.jackReserved = p.jackStream.reserved;
        data.pairedReserved = p.pairedStream.reserved;

        data.jackUnvestedRewards = jackData.unvestedRewards;
        data.pairedUnvestedRewards = pairedData.unvestedRewards;

        data.jackEarnedButUnclaimedEstimate = jackData.earnedButUnclaimedEstimate;
        data.pairedEarnedButUnclaimedEstimate = pairedData.earnedButUnclaimedEstimate;

        data.reason = "OK";

        if (p.status != IJackFarmLens.PoolStatus.Ended) {
            data.reason = "POOL_NOT_ENDED";
        } else if (p.totalStaked > 0) {
            data.reason = "POOL_HAS_STAKE";
        } else if (jackData.earnedButUnclaimedEstimate > 0) {
            data.reason = "JACK_CLAIMS_LEFT";
        } else if (pairedData.earnedButUnclaimedEstimate > 0) {
            data.reason = "PAIRED_CLAIMS_LEFT";
        } else {
            data.canMarkRemoved = true;
        }
    }

    // =============================================================
    // SIMPLE HELPERS
    // =============================================================

    function getPoolRewardTokens(uint256 poolId)
        external
        view
        returns (address jackRewardToken, address pairedRewardToken)
    {
        IJackFarmLens.PoolInfo memory p = farm.getPool(poolId);

        jackRewardToken = p.jackStream.token;
        pairedRewardToken = p.pairedStream.token;
    }

    function getPoolRewardRates(uint256 poolId)
        external
        view
        returns (
            uint256 jackRewardRate,
            uint256 jackRewardPerDay,
            uint256 pairedRewardRate,
            uint256 pairedRewardPerDay
        )
    {
        IJackFarmLens.PoolInfo memory p = farm.getPool(poolId);

        jackRewardRate = p.jackStream.rewardRate;
        jackRewardPerDay = p.jackStream.rewardRate * 1 days;

        pairedRewardRate = p.pairedStream.rewardRate;
        pairedRewardPerDay = p.pairedStream.rewardRate * 1 days;
    }

    function getPoolRewardEndTimes(uint256 poolId)
        external
        view
        returns (uint256 jackPeriodFinish, uint256 pairedPeriodFinish)
    {
        IJackFarmLens.PoolInfo memory p = farm.getPool(poolId);

        jackPeriodFinish = p.jackStream.periodFinish;
        pairedPeriodFinish = p.pairedStream.periodFinish;
    }

    function getUserPendingToken(
        uint256 poolId,
        address user,
        address rewardToken
    ) external view returns (uint256) {
        return farm.pendingToken(poolId, user, rewardToken);
    }

    // =============================================================
    // INTERNAL HELPERS
    // =============================================================

    function _getPoolsByStatus(IJackFarmLens.PoolStatus status) internal view returns (uint256[] memory ids) {
        uint256 total = farm.poolCount();
        uint256 count;

        for (uint256 i = 0; i < total; i++) {
            IJackFarmLens.PoolInfo memory p = farm.getPool(i);

            if (p.status == status) {
                count++;
            }
        }

        ids = new uint256[](count);
        uint256 index;

        for (uint256 i = 0; i < total; i++) {
            IJackFarmLens.PoolInfo memory p = farm.getPool(i);

            if (p.status == status) {
                ids[index] = i;
                index++;
            }
        }
    }

    function _streamDashboard(
        IJackFarmLens.RewardStream memory s,
        uint256 totalStaked
    ) internal view returns (StreamDashboard memory data) {
        uint256 unvested = _streamUnvestedPlusQueued(s, totalStaked);

        data.rewardToken = s.token;
        data.isNativePLS = s.token == PLS;
        data.rewardRate = s.rewardRate;
        data.rewardPerDay = s.rewardRate * 1 days;
        data.periodFinish = s.periodFinish;
        data.lastRewardTime = s.lastRewardTime;
        data.accRewardPerShare = s.accRewardPerShare;
        data.reserved = s.reserved;
        data.queuedRewards = s.queuedRewards;
        data.unvestedRewards = unvested;

        if (s.reserved > unvested) {
            data.earnedButUnclaimedEstimate = s.reserved - unvested;
        }

        data.active = s.rewardRate > 0;
    }

    function _streamUnvestedPlusQueued(
        IJackFarmLens.RewardStream memory s,
        uint256 totalStaked
    ) internal view returns (uint256) {
        if (s.rewardRate == 0) {
            return s.queuedRewards;
        }

        if (totalStaked == 0) {
            if (s.periodFinish > s.lastRewardTime) {
                return ((s.periodFinish - s.lastRewardTime) * s.rewardRate) + s.queuedRewards;
            }

            return s.queuedRewards;
        }

        if (block.timestamp < s.periodFinish) {
            return ((s.periodFinish - block.timestamp) * s.rewardRate) + s.queuedRewards;
        }

        return s.queuedRewards;
    }

    function _tokenRewardBreakdown(address token)
        internal
        view
        returns (uint256 allocatedToActiveRewards, uint256 earnedButUnclaimedEstimate)
    {
        uint256 total = farm.poolCount();

        for (uint256 i = 0; i < total; i++) {
            IJackFarmLens.PoolInfo memory p = farm.getPool(i);

            if (p.jackStream.token == token) {
                StreamDashboard memory d = _streamDashboard(p.jackStream, p.totalStaked);
                allocatedToActiveRewards += d.unvestedRewards;
                earnedButUnclaimedEstimate += d.earnedButUnclaimedEstimate;
            }

            if (p.pairedStream.token == token) {
                StreamDashboard memory d2 = _streamDashboard(p.pairedStream, p.totalStaked);
                allocatedToActiveRewards += d2.unvestedRewards;
                earnedButUnclaimedEstimate += d2.earnedButUnclaimedEstimate;
            }
        }
    }

    function _actualRewardTokenBalance(address token) internal view returns (uint256) {
        if (token == PLS) {
            return address(farm).balance;
        }

        return IERC20Lens(token).balanceOf(address(farm));
    }

    function _actualTokenBalance(address token) internal view returns (uint256) {
        if (token == PLS) {
            return address(farm).balance;
        }

        return IERC20Lens(token).balanceOf(address(farm));
    }
}