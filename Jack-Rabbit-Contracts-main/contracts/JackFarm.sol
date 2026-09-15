// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IJackTreasury.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

library SafeERC20Lite {
    function safeTransfer(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "SAFE_TRANSFER_FAILED");
    }

    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "SAFE_TRANSFER_FROM_FAILED");
    }

    function safeApprove(address token, address spender, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.approve.selector, spender, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "SAFE_APPROVE_FAILED");
    }
}

abstract contract OwnableLite {
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(address initialOwner) {
        require(initialOwner != address(0), "ZERO_OWNER");
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_OWNER");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

abstract contract ReentrancyGuardLite {
    uint256 private _locked = 1;

    modifier nonReentrant() {
        require(_locked == 1, "REENTRANCY");
        _locked = 2;
        _;
        _locked = 1;
    }
}

contract JackFarm is OwnableLite, ReentrancyGuardLite {
    using SafeERC20Lite for address;

    uint256 public constant FEE_DENOMINATOR = 10_000;
    uint256 public constant MAX_PROTOCOL_FEE_BPS = 500;
    uint256 public constant ACC_PRECISION = 1e24;

    uint16 public constant MIN_MANUAL_REWARD_DAYS = 1;
    uint16 public constant MAX_REWARD_DAYS = 30;
    uint16 public constant BASE_AUTO_MIN_REWARD_DAYS = 7;
    uint16 public constant DEFAULT_REWARD_DAYS = 30;
    uint16 public constant DEFAULT_AUTO_STEP_DAYS = 3;
    uint32 public constant DEFAULT_AUTO_COOLDOWN = 1 days;

    address public immutable jack;
    IJackTreasury public treasury;

    uint256 public protocolFeeBps = 500;
    bool public farmDepositsPaused;
    uint256 public runningPoolCount;

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

    PoolInfo[] private _pools;

    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    mapping(address => bool) public acceptedRewardToken;
    mapping(address => bool) public isPoolLpToken;
    mapping(address => uint256) public totalStakedByLpToken;
    mapping(address => uint256) public trackedBalance;
    mapping(address => uint256) public reservedRewards;

    mapping(address => uint256) public activePoolForRewardToken;
    mapping(address => mapping(address => uint256)) public latestEpoch;

    address[] private _acceptedRewardTokens;

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
    event PoolRewardDurationUpdated(uint256 indexed poolId, uint16 oldDurationDays, uint16 newDurationDays, bool automatic);

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

    constructor(address jackToken_, address treasury_) OwnableLite(msg.sender) {
        require(jackToken_ != address(0), "ZERO_JACK");
        require(treasury_ != address(0), "ZERO_TREASURY");

        jack = jackToken_;
        treasury = IJackTreasury(treasury_);

        _acceptRewardToken(jackToken_);
    }

    // =============================================================
    // USER FUNCTIONS
    // =============================================================

    function deposit(uint256 poolId, uint256 amount) external nonReentrant {
        _requirePool(poolId);
        require(amount > 0, "ZERO_AMOUNT");
        require(!farmDepositsPaused, "FARM_DEPOSITS_PAUSED");

        PoolInfo storage pool = _pools[poolId];
        require(pool.status == PoolStatus.Active, "POOL_NOT_ACTIVE");

        _updatePool(poolId);

        UserInfo storage user = userInfo[poolId][msg.sender];
        _settleBothRewards(poolId, msg.sender, user);

        uint256 received = _transferInActual(pool.lpToken, msg.sender, amount);
        require(received > 0, "NO_LP_RECEIVED");

        uint256 fee = (received * protocolFeeBps) / FEE_DENOMINATOR;
        uint256 stakeAmount = received - fee;
        require(stakeAmount > 0, "STAKE_ZERO_AFTER_FEE");

        if (fee > 0) {
            _depositLpFeeToTreasury(pool.lpToken, fee);
        }

        user.amount += stakeAmount;
        pool.totalStaked += stakeAmount;
        totalStakedByLpToken[pool.lpToken] += stakeAmount;

        _refreshPoolControl(poolId, false);
        _setBothRewardDebts(pool, user);

        emit Deposit(msg.sender, poolId, received, stakeAmount, fee);
    }

    function withdraw(uint256 poolId, uint256 amount) external nonReentrant {
        _requirePool(poolId);
        require(amount > 0, "ZERO_AMOUNT");

        PoolInfo storage pool = _pools[poolId];
        require(pool.status != PoolStatus.Removed, "POOL_REMOVED");

        UserInfo storage user = userInfo[poolId][msg.sender];
        require(user.amount >= amount, "INSUFFICIENT_STAKE");

        _updatePool(poolId);
        _settleBothRewards(poolId, msg.sender, user);

        user.amount -= amount;
        pool.totalStaked -= amount;
        totalStakedByLpToken[pool.lpToken] -= amount;

        pool.lpToken.safeTransfer(msg.sender, amount);

        _refreshPoolControl(poolId, false);
        _setBothRewardDebts(pool, user);

        emit Withdraw(msg.sender, poolId, amount);
    }

    function harvest(uint256 poolId) external nonReentrant {
        _requirePool(poolId);

        PoolInfo storage pool = _pools[poolId];
        require(pool.status != PoolStatus.Removed, "POOL_REMOVED");

        _updatePool(poolId);
        _refreshPoolControl(poolId, false);

        UserInfo storage user = userInfo[poolId][msg.sender];
        _settleBothRewards(poolId, msg.sender, user);
        _setBothRewardDebts(pool, user);
    }

    function harvestToken(uint256 poolId, address rewardToken) external nonReentrant {
        _requirePool(poolId);

        PoolInfo storage pool = _pools[poolId];
        require(pool.status != PoolStatus.Removed, "POOL_REMOVED");

        _updatePool(poolId);
        _refreshPoolControl(poolId, false);

        UserInfo storage user = userInfo[poolId][msg.sender];

        if (rewardToken == jack) {
            _settleSingleReward(poolId, msg.sender, user, true);
            user.jackRewardDebt = _rewardDebt(user.amount, pool.jackStream.accRewardPerShare);
        } else if (rewardToken == pool.pairedRewardToken) {
            _settleSingleReward(poolId, msg.sender, user, false);
            user.pairedRewardDebt = _rewardDebt(user.amount, pool.pairedStream.accRewardPerShare);
        } else {
            revert("INVALID_REWARD_TOKEN_FOR_POOL");
        }
    }

    function emergencyWithdraw(uint256 poolId) external nonReentrant {
        _requirePool(poolId);

        PoolInfo storage pool = _pools[poolId];
        require(pool.status != PoolStatus.Removed, "POOL_REMOVED");

        UserInfo storage user = userInfo[poolId][msg.sender];
        uint256 amount = user.amount;
        require(amount > 0, "NO_STAKE");

        _updatePool(poolId);

        uint256 forfeitedJack =
            _pendingFromStream(user.amount, pool.jackStream.accRewardPerShare, user.jackRewardDebt) +
            user.unpaidJack;

        uint256 forfeitedPaired =
            _pendingFromStream(user.amount, pool.pairedStream.accRewardPerShare, user.pairedRewardDebt) +
            user.unpaidPaired;

        if (forfeitedJack > 0) {
            _moveStreamAmountToTreasury(pool.jackStream, forfeitedJack, 5);
        }

        if (forfeitedPaired > 0) {
            _moveStreamAmountToTreasury(pool.pairedStream, forfeitedPaired, 5);
        }

        user.amount = 0;
        user.jackRewardDebt = 0;
        user.pairedRewardDebt = 0;
        user.unpaidJack = 0;
        user.unpaidPaired = 0;

        pool.totalStaked -= amount;
        totalStakedByLpToken[pool.lpToken] -= amount;

        pool.lpToken.safeTransfer(msg.sender, amount);

        _refreshPoolControl(poolId, false);

        emit EmergencyWithdraw(msg.sender, poolId, amount, forfeitedJack, forfeitedPaired);
    }

    // =============================================================
    // REWARD DEPOSIT / SYNC
    // =============================================================

    function depositReward(address token, uint256 amount) external nonReentrant returns (uint256 actualReceived) {
        require(acceptedRewardToken[token], "TOKEN_NOT_ACCEPTED");
        require(amount > 0, "ZERO_AMOUNT");

        actualReceived = _transferInActual(token, msg.sender, amount);
        require(actualReceived > 0, "NO_REWARD_RECEIVED");

        trackedBalance[token] += actualReceived;

        emit RewardDeposited(msg.sender, token, actualReceived);

        _routeReward(token, actualReceived);
    }

    function syncRewardToken(address token) external nonReentrant returns (uint256 amountSynced) {
        require(acceptedRewardToken[token], "TOKEN_NOT_ACCEPTED");

        uint256 actual = IERC20(token).balanceOf(address(this));
        uint256 tracked = trackedBalance[token];
        require(actual > tracked, "NO_UNTRACKED_BALANCE");

        amountSynced = actual - tracked;
        trackedBalance[token] += amountSynced;

        emit RewardSynced(token, amountSynced);

        _routeReward(token, amountSynced);
    }

    function syncPool(uint256 poolId) external nonReentrant {
        _requirePool(poolId);

        _updatePool(poolId);
        _refreshPoolControl(poolId, false);

        emit PoolSynced(poolId, _pools[poolId].rewardDurationDays);
    }

    // =============================================================
    // ADMIN POOL MANAGEMENT
    // =============================================================

    function addPool(
        address lpToken,
        address pairedRewardToken,
        uint256 targetStake,
        bool autoAdjustEnabled
    ) external onlyOwner returns (uint256 poolId) {
        require(lpToken != address(0), "ZERO_LP");
        require(pairedRewardToken != address(0), "ZERO_PAIR_REWARD");
        require(pairedRewardToken != jack, "PAIR_REWARD_CANNOT_BE_JACK");
        require(lpToken != jack, "LP_CANNOT_BE_JACK");
        require(lpToken != pairedRewardToken, "LP_CANNOT_BE_REWARD_TOKEN");
        require(activePoolForRewardToken[pairedRewardToken] == 0, "ACTIVE_POOL_EXISTS_FOR_TOKEN");

        _acceptRewardToken(pairedRewardToken);

        uint256 epoch = latestEpoch[lpToken][pairedRewardToken] + 1;
        latestEpoch[lpToken][pairedRewardToken] = epoch;

        RewardStream memory jackStream = RewardStream({
            token: jack,
            rewardRate: 0,
            periodFinish: block.timestamp,
            lastRewardTime: block.timestamp,
            accRewardPerShare: 0,
            reserved: 0,
            queuedRewards: 0
        });

        RewardStream memory pairedStream = RewardStream({
            token: pairedRewardToken,
            rewardRate: 0,
            periodFinish: block.timestamp,
            lastRewardTime: block.timestamp,
            accRewardPerShare: 0,
            reserved: 0,
            queuedRewards: 0
        });

        _pools.push(
            PoolInfo({
                lpToken: lpToken,
                pairedRewardToken: pairedRewardToken,
                epoch: epoch,
                totalStaked: 0,
                baseRewardDurationDays: DEFAULT_REWARD_DAYS,
                rewardDurationDays: DEFAULT_REWARD_DAYS,
                manualOverrideActive: false,
                manualOverrideUntil: 0,
                autoAdjustEnabled: autoAdjustEnabled,
                targetStake: targetStake,
                lastAutoAdjust: 0,
                autoCooldown: DEFAULT_AUTO_COOLDOWN,
                autoStepDays: DEFAULT_AUTO_STEP_DAYS,
                status: PoolStatus.Active,
                jackStream: jackStream,
                pairedStream: pairedStream
            })
        );

        poolId = _pools.length - 1;

        isPoolLpToken[lpToken] = true;
        activePoolForRewardToken[pairedRewardToken] = poolId + 1;
        runningPoolCount += 1;

        emit PoolAdded(poolId, epoch, lpToken, pairedRewardToken, targetStake, autoAdjustEnabled);
    }

    function setPoolPaused(uint256 poolId, bool paused) external onlyOwner {
        _requirePool(poolId);

        PoolInfo storage pool = _pools[poolId];
        require(pool.status == PoolStatus.Active || pool.status == PoolStatus.Paused, "POOL_NOT_RUNNING");

        pool.status = paused ? PoolStatus.Paused : PoolStatus.Active;

        emit PoolPaused(poolId, paused);
    }

    function endPool(uint256 poolId) external onlyOwner nonReentrant {
        _requirePool(poolId);

        PoolInfo storage pool = _pools[poolId];
        require(_isRunning(pool.status), "POOL_NOT_RUNNING");

        _updatePool(poolId);

        uint256 movedJack = _cancelFutureRewardsToTreasury(pool.jackStream, 4);
        uint256 movedPaired = _cancelFutureRewardsToTreasury(pool.pairedStream, 4);

        pool.manualOverrideActive = false;
        pool.manualOverrideUntil = 0;
        pool.status = PoolStatus.Ended;
        runningPoolCount -= 1;

        if (activePoolForRewardToken[pool.pairedRewardToken] == poolId + 1) {
            activePoolForRewardToken[pool.pairedRewardToken] = 0;
        }

        emit PoolEnded(poolId, movedJack, movedPaired);
    }

    function markPoolRemoved(uint256 poolId) external onlyOwner nonReentrant {
        _requirePool(poolId);

        PoolInfo storage pool = _pools[poolId];
        require(pool.status == PoolStatus.Ended, "POOL_NOT_ENDED");
        require(pool.totalStaked == 0, "POOL_HAS_STAKE");

        if (pool.jackStream.reserved > 0) {
            _moveStreamAmountToTreasury(pool.jackStream, pool.jackStream.reserved, 7);
        }

        if (pool.pairedStream.reserved > 0) {
            _moveStreamAmountToTreasury(pool.pairedStream, pool.pairedStream.reserved, 7);
        }

        pool.jackStream.rewardRate = 0;
        pool.jackStream.periodFinish = block.timestamp;
        pool.jackStream.lastRewardTime = block.timestamp;
        pool.jackStream.queuedRewards = 0;

        pool.pairedStream.rewardRate = 0;
        pool.pairedStream.periodFinish = block.timestamp;
        pool.pairedStream.lastRewardTime = block.timestamp;
        pool.pairedStream.queuedRewards = 0;

        require(pool.jackStream.reserved == 0, "JACK_REWARD_DUST_LEFT");
        require(pool.pairedStream.reserved == 0, "PAIRED_REWARD_DUST_LEFT");

        pool.status = PoolStatus.Removed;

        emit PoolRemoved(poolId);
    }

    function setFarmDepositsPaused(bool paused) external onlyOwner {
        farmDepositsPaused = paused;
        emit FarmDepositsPaused(paused);
    }

    // =============================================================
    // ADMIN REWARD DURATION / AUTO CONTROL
    // =============================================================

    function setPoolBaseRewardDuration(uint256 poolId, uint16 durationDays) external onlyOwner nonReentrant {
        _requirePool(poolId);
        _requireRewardDuration(durationDays);

        PoolInfo storage pool = _pools[poolId];
        require(_isRunning(pool.status), "POOL_NOT_RUNNING");

        _updatePool(poolId);

        pool.baseRewardDurationDays = durationDays;

        emit PoolBaseRewardDurationUpdated(poolId, durationDays);

        if (!pool.manualOverrideActive && !pool.autoAdjustEnabled) {
            _applyRewardDuration(poolId, durationDays, false);
        }
    }

    function setManualRewardDuration(
        uint256 poolId,
        uint16 durationDays,
        OverridePeriod period
    ) external onlyOwner nonReentrant {
        _requirePool(poolId);
        _requireRewardDuration(durationDays);

        PoolInfo storage pool = _pools[poolId];
        require(_isRunning(pool.status), "POOL_NOT_RUNNING");

        _updatePool(poolId);

        uint64 until = uint64(block.timestamp + _overridePeriodSeconds(period));

        pool.manualOverrideActive = true;
        pool.manualOverrideUntil = until;

        _applyRewardDuration(poolId, durationDays, false);

        emit ManualRewardDurationSet(poolId, durationDays, until, period);
    }

    function clearManualRewardDuration(uint256 poolId) external onlyOwner nonReentrant {
        _requirePool(poolId);

        PoolInfo storage pool = _pools[poolId];
        require(_isRunning(pool.status), "POOL_NOT_RUNNING");

        _updatePool(poolId);

        pool.manualOverrideActive = false;
        pool.manualOverrideUntil = 0;

        emit ManualRewardDurationCleared(poolId);

        _refreshPoolControl(poolId, true);
    }

    function setPoolAutoConfig(
        uint256 poolId,
        bool enabled,
        uint256 targetStake,
        uint32 cooldown,
        uint16 stepDays
    ) external onlyOwner nonReentrant {
        _requirePool(poolId);
        require(stepDays > 0 && stepDays <= MAX_REWARD_DAYS, "BAD_STEP_DAYS");

        PoolInfo storage pool = _pools[poolId];
        require(_isRunning(pool.status), "POOL_NOT_RUNNING");

        _updatePool(poolId);

        pool.autoAdjustEnabled = enabled;
        pool.targetStake = targetStake;
        pool.autoCooldown = cooldown;
        pool.autoStepDays = stepDays;

        emit PoolAutoConfigUpdated(poolId, enabled, targetStake, cooldown, stepDays);

        _refreshPoolControl(poolId, true);
    }

    // =============================================================
    // ADMIN TREASURY / FEES / WITHDRAWALS
    // =============================================================

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "ZERO_TREASURY");

        emit TreasuryUpdated(address(treasury), newTreasury);

        treasury = IJackTreasury(newTreasury);
    }

    function setProtocolFeeBps(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_PROTOCOL_FEE_BPS, "FEE_TOO_HIGH");

        emit ProtocolFeeUpdated(protocolFeeBps, newFeeBps);

        protocolFeeBps = newFeeBps;
    }

    function withdrawRewardSurplus(address token, uint256 amount) external onlyOwner nonReentrant {
        require(acceptedRewardToken[token], "TOKEN_NOT_ACCEPTED");
        require(!isPoolLpToken[token], "TOKEN_IS_POOL_LP");
        require(amount > 0, "ZERO_AMOUNT");

        uint256 withdrawable = getWithdrawableRewardSurplus(token);

        require(amount <= withdrawable, "AMOUNT_EXCEEDS_SURPLUS");

        trackedBalance[token] -= amount;

        token.safeTransfer(msg.sender, amount);

        emit RewardSurplusWithdrawn(token, msg.sender, amount);
    }

    function rescueUnsupportedToken(address token, uint256 amount) external onlyOwner nonReentrant {
        require(!acceptedRewardToken[token], "ACCEPTED_TOKEN_USE_SURPLUS");
        require(amount > 0, "ZERO_AMOUNT");

        if (isPoolLpToken[token]) {
            uint256 surplus = getLpTokenSurplus(token);
            require(amount <= surplus, "AMOUNT_EXCEEDS_LP_SURPLUS");

            emit LpSurplusRescued(token, msg.sender, amount);
        } else {
            emit UnsupportedTokenRescued(token, msg.sender, amount);
        }

        token.safeTransfer(msg.sender, amount);
    }

    function rescueLpSurplus(address lpToken, uint256 amount) external onlyOwner nonReentrant {
        require(isPoolLpToken[lpToken], "NOT_POOL_LP");
        require(amount > 0, "ZERO_AMOUNT");

        uint256 surplus = getLpTokenSurplus(lpToken);
        require(amount <= surplus, "AMOUNT_EXCEEDS_LP_SURPLUS");

        lpToken.safeTransfer(msg.sender, amount);

        emit LpSurplusRescued(lpToken, msg.sender, amount);
    }

    // =============================================================
    // VIEW FUNCTIONS
    // =============================================================

    function poolCount() external view returns (uint256) {
        return _pools.length;
    }

    function getAcceptedRewardTokens() external view returns (address[] memory) {
        return _acceptedRewardTokens;
    }

    function getPool(uint256 poolId) external view returns (PoolInfo memory) {
        _requirePool(poolId);
        return _pools[poolId];
    }

    function pendingRewards(uint256 poolId, address account)
        external
        view
        returns (uint256 pendingJack, uint256 pendingPaired)
    {
        _requirePool(poolId);

        PoolInfo storage pool = _pools[poolId];
        UserInfo storage user = userInfo[poolId][account];

        uint256 jackAcc = _viewAccRewardPerShare(pool.jackStream, pool.totalStaked);
        uint256 pairedAcc = _viewAccRewardPerShare(pool.pairedStream, pool.totalStaked);

        pendingJack = user.unpaidJack + _pendingFromStream(user.amount, jackAcc, user.jackRewardDebt);
        pendingPaired = user.unpaidPaired + _pendingFromStream(user.amount, pairedAcc, user.pairedRewardDebt);
    }

    function pendingToken(uint256 poolId, address account, address rewardToken) external view returns (uint256) {
        _requirePool(poolId);

        PoolInfo storage pool = _pools[poolId];
        UserInfo storage user = userInfo[poolId][account];

        if (rewardToken == jack) {
            uint256 jackAcc = _viewAccRewardPerShare(pool.jackStream, pool.totalStaked);
            return user.unpaidJack + _pendingFromStream(user.amount, jackAcc, user.jackRewardDebt);
        }

        if (rewardToken == pool.pairedRewardToken) {
            uint256 pairedAcc = _viewAccRewardPerShare(pool.pairedStream, pool.totalStaked);
            return user.unpaidPaired + _pendingFromStream(user.amount, pairedAcc, user.pairedRewardDebt);
        }

        return 0;
    }

    function getWithdrawableRewardSurplus(address token) public view returns (uint256) {
        if (!acceptedRewardToken[token]) return 0;
        if (isPoolLpToken[token]) return 0;

        uint256 actual = IERC20(token).balanceOf(address(this));
        uint256 tracked = trackedBalance[token];
        uint256 reserved = reservedRewards[token];

        if (actual == 0 || tracked <= reserved) return 0;

        uint256 surplusTracked = tracked - reserved;

        return actual < surplusTracked ? actual : surplusTracked;
    }

    function getLpTokenSurplus(address lpToken) public view returns (uint256) {
        uint256 actual = IERC20(lpToken).balanceOf(address(this));
        uint256 staked = totalStakedByLpToken[lpToken];

        if (actual <= staked) return 0;

        return actual - staked;
    }

    function getAutoMinRewardDays() public view returns (uint256) {
        if (runningPoolCount > BASE_AUTO_MIN_REWARD_DAYS) {
            return runningPoolCount;
        }

        return BASE_AUTO_MIN_REWARD_DAYS;
    }

    // =============================================================
    // INTERNAL REWARD ROUTING
    // =============================================================

    function _routeReward(address token, uint256 amount) internal {
        if (amount == 0) return;

        if (token == jack) {
            _routeJackReward(amount);
        } else {
            _routePairedReward(token, amount);
        }
    }

    function _routeJackReward(uint256 amount) internal {
        if (runningPoolCount == 0) {
            _transferTrackedToTreasury(jack, amount, 1);
            return;
        }

        uint256 share = amount / runningPoolCount;

        if (share == 0) {
            _transferTrackedToTreasury(jack, amount, 3);
            return;
        }

        uint256 routed;

        for (uint256 i = 0; i < _pools.length; i++) {
            if (_isRunning(_pools[i].status)) {
                _addRewardToPoolStream(i, true, share);
                routed += share;
            }
        }

        uint256 remainder = amount - routed;

        if (remainder > 0) {
            _transferTrackedToTreasury(jack, remainder, 3);
        }
    }

    function _routePairedReward(address token, uint256 amount) internal {
        uint256 poolIdPlusOne = activePoolForRewardToken[token];

        if (poolIdPlusOne == 0) {
            _transferTrackedToTreasury(token, amount, 1);
            return;
        }

        uint256 poolId = poolIdPlusOne - 1;
        PoolInfo storage pool = _pools[poolId];

        if (!_isRunning(pool.status)) {
            _transferTrackedToTreasury(token, amount, 2);
            return;
        }

        _addRewardToPoolStream(poolId, false, amount);
    }

    function _addRewardToPoolStream(uint256 poolId, bool isJackReward, uint256 amount) internal {
        if (amount == 0) return;

        _updatePool(poolId);
        _refreshPoolControl(poolId, false);

        PoolInfo storage pool = _pools[poolId];

        if (isJackReward) {
            _reserveAndReschedule(poolId, pool.jackStream, amount, pool.rewardDurationDays);
        } else {
            _reserveAndReschedule(poolId, pool.pairedStream, amount, pool.rewardDurationDays);
        }
    }

    function _reserveAndReschedule(
        uint256 poolId,
        RewardStream storage stream,
        uint256 amount,
        uint16 rewardDurationDays
    ) internal {
        stream.reserved += amount;
        reservedRewards[stream.token] += amount;
        stream.queuedRewards += amount;

        _rescheduleStream(stream, rewardDurationDays);

        emit RewardRoutedToPool(stream.token, poolId, amount);
    }

    // =============================================================
    // INTERNAL POOL / STREAM ACCOUNTING
    // =============================================================

    function _updatePool(uint256 poolId) internal {
        PoolInfo storage pool = _pools[poolId];

        _updateStream(pool.jackStream, pool.totalStaked);
        _updateStream(pool.pairedStream, pool.totalStaked);
    }

    function _updateStream(RewardStream storage stream, uint256 totalStaked) internal {
        if (stream.lastRewardTime == 0) {
            stream.lastRewardTime = block.timestamp;
            return;
        }

        if (stream.rewardRate == 0) {
            stream.lastRewardTime = block.timestamp;
            return;
        }

        if (totalStaked == 0) {
            if (block.timestamp > stream.lastRewardTime && stream.periodFinish > stream.lastRewardTime) {
                uint256 elapsed = block.timestamp - stream.lastRewardTime;
                stream.periodFinish += elapsed;
                stream.lastRewardTime = block.timestamp;
            } else if (block.timestamp > stream.lastRewardTime) {
                stream.lastRewardTime = block.timestamp;
            }

            return;
        }

        uint256 applicable = block.timestamp < stream.periodFinish ? block.timestamp : stream.periodFinish;

        if (applicable > stream.lastRewardTime) {
            uint256 reward = (applicable - stream.lastRewardTime) * stream.rewardRate;
            stream.accRewardPerShare += (reward * ACC_PRECISION) / totalStaked;
            stream.lastRewardTime = applicable;
        }

        if (block.timestamp >= stream.periodFinish) {
            stream.rewardRate = 0;
            stream.lastRewardTime = block.timestamp;
        }
    }

    function _rescheduleStream(RewardStream storage stream, uint16 durationDays) internal {
        uint256 futureRewards = _streamRemainingRewards(stream) + stream.queuedRewards;

        if (futureRewards == 0) {
            stream.rewardRate = 0;
            stream.periodFinish = block.timestamp;
            stream.lastRewardTime = block.timestamp;
            stream.queuedRewards = 0;
            return;
        }

        uint256 durationSeconds = uint256(durationDays) * 1 days;
        uint256 newRate = futureRewards / durationSeconds;

        if (newRate == 0) {
            stream.rewardRate = 0;
            stream.periodFinish = block.timestamp;
            stream.lastRewardTime = block.timestamp;
            stream.queuedRewards = futureRewards;
            return;
        }

        uint256 scheduled = newRate * durationSeconds;

        stream.queuedRewards = futureRewards - scheduled;
        stream.rewardRate = newRate;
        stream.periodFinish = block.timestamp + durationSeconds;
        stream.lastRewardTime = block.timestamp;
    }

    function _streamRemainingRewards(RewardStream storage stream) internal view returns (uint256) {
        if (stream.rewardRate == 0 || block.timestamp >= stream.periodFinish) {
            return 0;
        }

        return (stream.periodFinish - block.timestamp) * stream.rewardRate;
    }

    function _cancelFutureRewardsToTreasury(RewardStream storage stream, uint8 reason) internal returns (uint256 moved) {
        moved = _streamRemainingRewards(stream) + stream.queuedRewards;

        if (moved > 0) {
            moved = _moveStreamAmountToTreasury(stream, moved, reason);
        }

        stream.rewardRate = 0;
        stream.periodFinish = block.timestamp;
        stream.lastRewardTime = block.timestamp;
        stream.queuedRewards = 0;
    }

    // =============================================================
    // INTERNAL USER REWARD SETTLEMENT
    // =============================================================

    function _settleBothRewards(uint256 poolId, address account, UserInfo storage user) internal {
        _settleSingleReward(poolId, account, user, true);
        _settleSingleReward(poolId, account, user, false);
    }

    function _settleSingleReward(
        uint256 poolId,
        address account,
        UserInfo storage user,
        bool isJackReward
    ) internal {
        PoolInfo storage pool = _pools[poolId];

        if (isJackReward) {
            uint256 pendingJack = _pendingFromStream(
                user.amount,
                pool.jackStream.accRewardPerShare,
                user.jackRewardDebt
            );

            uint256 totalJackDue = user.unpaidJack + pendingJack;

            if (totalJackDue == 0) return;

            uint256 paidJack = _payRewardFromStream(pool.jackStream, account, totalJackDue);

            user.unpaidJack = totalJackDue - paidJack;

            emit Harvest(account, poolId, pool.jackStream.token, paidJack, user.unpaidJack);
        } else {
            uint256 pendingPaired = _pendingFromStream(
                user.amount,
                pool.pairedStream.accRewardPerShare,
                user.pairedRewardDebt
            );

            uint256 totalPairedDue = user.unpaidPaired + pendingPaired;

            if (totalPairedDue == 0) return;

            uint256 paidPaired = _payRewardFromStream(pool.pairedStream, account, totalPairedDue);

            user.unpaidPaired = totalPairedDue - paidPaired;

            emit Harvest(account, poolId, pool.pairedStream.token, paidPaired, user.unpaidPaired);
        }
    }

    function _setBothRewardDebts(PoolInfo storage pool, UserInfo storage user) internal {
        user.jackRewardDebt = _rewardDebt(user.amount, pool.jackStream.accRewardPerShare);
        user.pairedRewardDebt = _rewardDebt(user.amount, pool.pairedStream.accRewardPerShare);
    }

    function _rewardDebt(uint256 amount, uint256 accRewardPerShare) internal pure returns (uint256) {
        return (amount * accRewardPerShare) / ACC_PRECISION;
    }

    function _pendingFromStream(
        uint256 userAmount,
        uint256 accRewardPerShare,
        uint256 rewardDebt
    ) internal pure returns (uint256) {
        uint256 accumulated = (userAmount * accRewardPerShare) / ACC_PRECISION;

        return accumulated > rewardDebt ? accumulated - rewardDebt : 0;
    }

    // =============================================================
    // INTERNAL AUTO / MANUAL DURATION CONTROL
    // =============================================================

    function _refreshPoolControl(uint256 poolId, bool force) internal {
        PoolInfo storage pool = _pools[poolId];

        if (!_isRunning(pool.status)) return;

        if (pool.manualOverrideActive) {
            if (block.timestamp < pool.manualOverrideUntil) {
                return;
            }

            pool.manualOverrideActive = false;
            pool.manualOverrideUntil = 0;

            emit ManualRewardDurationExpired(poolId);
        }

        if (!pool.autoAdjustEnabled) return;

        if (!force && pool.lastAutoAdjust != 0 && block.timestamp < uint256(pool.lastAutoAdjust) + pool.autoCooldown) {
            return;
        }

        uint16 desired = _desiredAutoRewardDuration(pool);
        uint16 current = pool.rewardDurationDays;

        if (desired == current) {
            pool.lastAutoAdjust = uint64(block.timestamp);
            return;
        }

        uint16 step = pool.autoStepDays == 0 ? DEFAULT_AUTO_STEP_DAYS : pool.autoStepDays;
        uint16 nextDuration;

        if (desired > current) {
            uint16 increase = desired - current;
            nextDuration = current + (increase > step ? step : increase);
        } else {
            uint16 decrease = current - desired;
            nextDuration = current - (decrease > step ? step : decrease);
        }

        uint16 minAuto = uint16(getAutoMinRewardDays());

        if (nextDuration < minAuto) nextDuration = minAuto;
        if (nextDuration > MAX_REWARD_DAYS) nextDuration = MAX_REWARD_DAYS;

        if (nextDuration != current) {
            _applyRewardDuration(poolId, nextDuration, true);
        }

        pool.lastAutoAdjust = uint64(block.timestamp);
    }

    function _desiredAutoRewardDuration(PoolInfo storage pool) internal view returns (uint16) {
        uint16 minAuto = uint16(getAutoMinRewardDays());

        if (pool.targetStake == 0 || pool.totalStaked == 0) {
            return MAX_REWARD_DAYS;
        }

        uint256 ratioBps = (pool.totalStaked * FEE_DENOMINATOR) / pool.targetStake;

        uint16 desired;

        if (ratioBps < 2_500) {
            desired = 30;
        } else if (ratioBps < 5_000) {
            desired = 24;
        } else if (ratioBps < 7_500) {
            desired = 18;
        } else if (ratioBps < 10_000) {
            desired = 14;
        } else {
            desired = minAuto;
        }

        if (desired < minAuto) desired = minAuto;
        if (desired > MAX_REWARD_DAYS) desired = MAX_REWARD_DAYS;

        return desired;
    }

    function _applyRewardDuration(uint256 poolId, uint16 newDurationDays, bool automatic) internal {
        _requireRewardDuration(newDurationDays);

        PoolInfo storage pool = _pools[poolId];
        uint16 oldDuration = pool.rewardDurationDays;

        pool.rewardDurationDays = newDurationDays;

        _rescheduleStream(pool.jackStream, newDurationDays);
        _rescheduleStream(pool.pairedStream, newDurationDays);

        if (oldDuration != newDurationDays) {
            emit PoolRewardDurationUpdated(poolId, oldDuration, newDurationDays, automatic);
        }
    }

    // =============================================================
    // INTERNAL TRANSFER / BALANCE HELPERS
    // =============================================================

    function _transferInActual(address token, address from, uint256 amount) internal returns (uint256 actualReceived) {
        uint256 beforeBalance = IERC20(token).balanceOf(address(this));

        token.safeTransferFrom(from, address(this), amount);

        uint256 afterBalance = IERC20(token).balanceOf(address(this));

        require(afterBalance >= beforeBalance, "BAD_TOKEN_BALANCE");

        actualReceived = afterBalance - beforeBalance;
    }

    function _depositLpFeeToTreasury(address lpToken, uint256 amount) internal {
        if (amount == 0) return;

        lpToken.safeApprove(address(treasury), 0);
        lpToken.safeApprove(address(treasury), amount);

        treasury.depositLpToken(lpToken, amount);

        emit LpFeeDepositedToTreasury(lpToken, amount);
    }

    function _payRewardFromStream(
        RewardStream storage stream,
        address to,
        uint256 amount
    ) internal returns (uint256 paid) {
        if (amount == 0) return 0;

        uint256 available = IERC20(stream.token).balanceOf(address(this));

        paid = _min(amount, stream.reserved);
        paid = _min(paid, reservedRewards[stream.token]);
        paid = _min(paid, trackedBalance[stream.token]);
        paid = _min(paid, available);

        if (paid == 0) return 0;

        stream.reserved -= paid;
        reservedRewards[stream.token] -= paid;
        trackedBalance[stream.token] -= paid;

        stream.token.safeTransfer(to, paid);
    }

    function _moveStreamAmountToTreasury(
        RewardStream storage stream,
        uint256 amount,
        uint8 reason
    ) internal returns (uint256 moved) {
        if (amount == 0) return 0;

        moved = _min(amount, stream.reserved);
        moved = _min(moved, reservedRewards[stream.token]);
        moved = _min(moved, trackedBalance[stream.token]);
        moved = _min(moved, IERC20(stream.token).balanceOf(address(this)));

        if (moved == 0) return 0;

        stream.reserved -= moved;
        reservedRewards[stream.token] -= moved;

        _transferTrackedToTreasury(stream.token, moved, reason);
    }

    function _transferTrackedToTreasury(address token, uint256 amount, uint8 reason) internal {
        if (amount == 0) return;

        require(trackedBalance[token] >= amount, "TRACKED_BALANCE_LOW");

        trackedBalance[token] -= amount;

        token.safeApprove(address(treasury), 0);
        token.safeApprove(address(treasury), amount);

        if (token == jack) {
            treasury.depositJackReserve(amount);
        } else {
            treasury.receiveFunds(token, amount);
        }

        emit RewardSentToTreasury(token, amount, reason);
    }

    // =============================================================
    // INTERNAL VIEW HELPERS
    // =============================================================

    function _viewAccRewardPerShare(RewardStream storage stream, uint256 totalStaked) internal view returns (uint256) {
        if (totalStaked == 0 || stream.rewardRate == 0) {
            return stream.accRewardPerShare;
        }

        uint256 applicable = block.timestamp < stream.periodFinish ? block.timestamp : stream.periodFinish;

        if (applicable <= stream.lastRewardTime) {
            return stream.accRewardPerShare;
        }

        uint256 reward = (applicable - stream.lastRewardTime) * stream.rewardRate;

        return stream.accRewardPerShare + ((reward * ACC_PRECISION) / totalStaked);
    }

    // =============================================================
    // INTERNAL GENERAL HELPERS
    // =============================================================

    function _acceptRewardToken(address token) internal {
        if (!acceptedRewardToken[token]) {
            acceptedRewardToken[token] = true;
            _acceptedRewardTokens.push(token);
        }
    }

    function _requirePool(uint256 poolId) internal view {
        require(poolId < _pools.length, "BAD_POOL_ID");
    }

    function _requireRewardDuration(uint16 durationDays) internal pure {
        require(
            durationDays >= MIN_MANUAL_REWARD_DAYS && durationDays <= MAX_REWARD_DAYS,
            "BAD_REWARD_DURATION"
        );
    }

    function _isRunning(PoolStatus status) internal pure returns (bool) {
        return status == PoolStatus.Active || status == PoolStatus.Paused;
    }

    function _overridePeriodSeconds(OverridePeriod period) internal pure returns (uint256) {
        if (period == OverridePeriod.D1) return 1 days;
        if (period == OverridePeriod.W1) return 7 days;
        if (period == OverridePeriod.M1) return 30 days;
        if (period == OverridePeriod.M3) return 90 days;
        if (period == OverridePeriod.M6) return 180 days;

        return 365 days;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}