// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts@4.9.5/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts@4.9.5/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts@4.9.5/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts@4.9.5/access/Ownable.sol";
import "@openzeppelin/contracts@4.9.5/security/ReentrancyGuard.sol";

import "./interfaces/IJackTreasury.sol";
import "./interfaces/IJackOracleHub.sol";

contract JackBarrow is ERC721, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant KEEPER_BPS_DENOMINATOR = 100_000;

    uint256 public constant MIN_VEST_SECONDS = 90 days;
    uint256 public constant MAX_VEST_SECONDS = 1825 days;

    struct Bond {
        uint256 pdaiDeposited;
        uint256 baseJack;
        uint256 rewardJack;
        uint256 claimedBase;
        uint256 claimedReward;
        uint64 startTime;
        uint64 vestEnd;
        uint64 expiryTime;
        bool swept;
    }

    struct BondCalc {
        uint256 payoutBps;
        uint256 feeBps;
        uint256 feePdai;
        uint256 netPdai;
        uint256 baseJack;
        uint256 rewardJack;
    }

    struct SyncWindow {
        uint256 fromDay;
        uint256 toDay;
        uint256 currentReserve;
        uint256 reserveBaseline;
        uint256 currentIncomeTotal;
        uint256 incomeDeltaToUse;
        bool fullSync;
    }

    struct PullResult {
        uint256 keeperReward;
        uint256 netAdded;
    }

    IERC20 public immutable pdai;
    IERC20 public immutable jack;

    IJackTreasury public treasury;
    IJackOracleHub public oracle;

    uint256 public nextTokenId = 1;

    uint256 public promiseBucketJack;
    uint256 public rewardBucketJack;
    uint256 public promisedBaseLiability;
    uint256 public promisedRewardLiability;

    uint256 public lastSyncedDay;
    uint256 public lastKnownTreasuryJackReserve;
    uint256 public lastKnownTreasuryJackIncomeTotal;

    uint256 public treasuryJackTarget;
    uint256 public requestThresholdJack;
    uint256 public maxDailyTakeBps;
    uint256 public takeMultiplierBps;
    uint256 public keeperRewardBps;

    uint256 public minPdaiTarget;
    uint256 public maxPdaiTargetConfigured;
    uint256 public maxPdaiTargetLive;
    uint256 public maxTargetStepPerAction;

    uint256 public minPayoutBps;
    uint256 public maxPayoutBps;
    uint256 public minFeeBps;
    uint256 public variableFeeRangeBps;
    uint256 public bondGracePeriod;

    bool public bootstrapMode;

    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => uint256) public customVestWeightBps;

    event Synced(
        uint256 indexed fromDay,
        uint256 indexed toDay,
        uint256 reserveBaseline,
        uint256 currentReserve,
        uint256 requestedNet,
        uint256 netAdded,
        uint256 keeperReward
    );

    event DirectJackSynced(uint256 amountBucketed, uint256 promiseAdded, uint256 rewardAdded);

    event BondOpened(
        uint256 indexed tokenId,
        address indexed user,
        uint256 pdaiAmount,
        uint256 feePdai,
        uint256 netPdai,
        uint256 baseJack,
        uint256 rewardJack,
        uint256 vestSeconds
    );

    event BondClaimed(uint256 indexed tokenId, address indexed user, uint256 baseJack, uint256 rewardJack);
    event BondSwept(uint256 indexed tokenId, uint256 unclaimedBase, uint256 unclaimedReward);

    event TreasuryUpdated(address indexed treasury);
    event OracleUpdated(address indexed oracle);
    event ThresholdUpdated(uint256 newThresholdJack);
    event TreasuryJackTargetUpdated(uint256 newTarget);
    event TakeConfigUpdated(uint256 maxDailyTakeBps, uint256 takeMultiplierBps, uint256 keeperRewardBps);

    event PayoutConfigUpdated(
        uint256 minPayoutBps,
        uint256 maxPayoutBps,
        uint256 minFeeBps,
        uint256 variableFeeRangeBps,
        uint256 bondGracePeriod
    );

    event BootstrapConfigUpdated(bool enabled);

    event PdaiTargetConfigUpdated(
        uint256 minPdaiTarget,
        uint256 configuredMaxPdaiTarget,
        uint256 liveMaxPdaiTarget,
        uint256 maxTargetStepPerAction
    );

    event VestWeightUpdated(uint256 vestSeconds, uint256 weightBps);
    event Seeded(uint256 promiseAdded, uint256 rewardAdded);
    event Rebucketed(uint256 promiseAdded, uint256 rewardAdded);

    constructor(
        address _pdai,
        address _jack,
        address _treasury,
        address _oracle,
        address initialOwner
    ) ERC721("JackBarrow Bond", "JBOND") {
        require(_pdai != address(0), "pDAI zero");
        require(_jack != address(0), "JACK zero");
        require(_treasury != address(0), "treasury zero");
        require(_oracle != address(0), "oracle zero");
        require(initialOwner != address(0), "owner zero");

        _transferOwnership(initialOwner);

        pdai = IERC20(_pdai);
        jack = IERC20(_jack);
        treasury = IJackTreasury(_treasury);
        oracle = IJackOracleHub(_oracle);

        treasuryJackTarget = 50_000_000e18;
        requestThresholdJack = 1_000_000e18;

        maxDailyTakeBps = 1_500;
        takeMultiplierBps = 10_000;
        keeperRewardBps = 25;

        minPdaiTarget = 15_000_000_000e18;
        maxPdaiTargetConfigured = 40_000_000_000e18;
        maxPdaiTargetLive = 40_000_000_000e18;
        maxTargetStepPerAction = 500_000_000e18;

        minPayoutBps = 200;
        maxPayoutBps = 2_500;

        minFeeBps = 100;
        variableFeeRangeBps = 700;
        bondGracePeriod = 30 days;

        bootstrapMode = true;

        uint256 dayNow_ = _currentDay();

        lastSyncedDay = dayNow_ == 0 ? 0 : dayNow_ - 1;
        lastKnownTreasuryJackReserve = _treasuryJackBalance();
        lastKnownTreasuryJackIncomeTotal = treasury.totalJackIncomeFiveYears();
    }

    function openBond(
        uint256 pdaiAmount,
        uint256 vestSeconds,
        uint256 minBaseJackQuote,
        uint256 maxSyncDays
    ) external nonReentrant returns (uint256 tokenId) {
        require(pdaiAmount > 0, "zero deposit");
        require(_isValidVestTerm(vestSeconds), "invalid vest term");

        _pokeAndCheckOracle();
        _sync(maxSyncDays, msg.sender);

        require(_isFullySynced(), "sync incomplete");

        BondCalc memory c = _calcBond(pdaiAmount, vestSeconds);

        require(c.netPdai > 0, "net pDAI zero");
        require(c.baseJack >= minBaseJackQuote, "quote too low");
        require(c.baseJack <= freePromiseJack(), "insufficient promise bucket");
        require(c.rewardJack <= freeRewardJack(), "insufficient reward bucket");

        _handlePdaiTransfer(msg.sender, pdaiAmount, c.netPdai, c.feePdai);

        tokenId = nextTokenId++;

        bonds[tokenId] = Bond({
            pdaiDeposited: pdaiAmount,
            baseJack: c.baseJack,
            rewardJack: c.rewardJack,
            claimedBase: 0,
            claimedReward: 0,
            startTime: uint64(block.timestamp),
            vestEnd: uint64(block.timestamp + vestSeconds),
            expiryTime: uint64(block.timestamp + vestSeconds + bondGracePeriod),
            swept: false
        });

        promisedBaseLiability += c.baseJack;
        promisedRewardLiability += c.rewardJack;

        _safeMint(msg.sender, tokenId);

        emit BondOpened(
            tokenId,
            msg.sender,
            pdaiAmount,
            c.feePdai,
            c.netPdai,
            c.baseJack,
            c.rewardJack,
            vestSeconds
        );
    }

    function claim(uint256 tokenId) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "not owner");

        Bond storage bond = bonds[tokenId];

        require(!bond.swept, "swept");
        require(block.timestamp <= bond.expiryTime, "expired");

        (uint256 claimBase, uint256 claimReward) = claimable(tokenId);

        require(claimBase > 0 || claimReward > 0, "nothing claimable");

        bond.claimedBase += claimBase;
        bond.claimedReward += claimReward;

        promisedBaseLiability -= claimBase;
        promisedRewardLiability -= claimReward;

        promiseBucketJack -= claimBase;
        rewardBucketJack -= claimReward;

        jack.safeTransfer(msg.sender, claimBase + claimReward);

        emit BondClaimed(tokenId, msg.sender, claimBase, claimReward);
    }

    function sweepExpiredBond(uint256 tokenId) public nonReentrant {
        require(_tokenExists(tokenId), "bad token");

        Bond storage bond = bonds[tokenId];

        require(!bond.swept, "already swept");
        require(block.timestamp > bond.expiryTime, "not expired");

        uint256 unclaimedBase = bond.baseJack - bond.claimedBase;
        uint256 unclaimedReward = bond.rewardJack - bond.claimedReward;

        bond.swept = true;

        promisedBaseLiability -= unclaimedBase;
        promisedRewardLiability -= unclaimedReward;

        _burn(tokenId);

        emit BondSwept(tokenId, unclaimedBase, unclaimedReward);
    }

    function sweepExpiredBatch(uint256[] calldata tokenIds) external {
        for (uint256 i = 0; i < tokenIds.length; ++i) {
            sweepExpiredBond(tokenIds[i]);
        }
    }

    function seedJack(uint256 amount) external nonReentrant {
        require(amount > 0, "zero amount");

        uint256 beforeBal = jack.balanceOf(address(this));

        jack.safeTransferFrom(msg.sender, address(this), amount);

        uint256 received = jack.balanceOf(address(this)) - beforeBal;

        require(received > 0, "zero received");

        (uint256 promiseAdded, uint256 rewardAdded) = _bucketJack(received);

        emit Seeded(promiseAdded, rewardAdded);
    }

    function syncDirectJack() external nonReentrant returns (uint256 bucketed) {
        bucketed = unbucketedJack();

        require(bucketed > 0, "no unbucketed JACK");

        (uint256 promiseAdded, uint256 rewardAdded) = _bucketJack(bucketed);

        emit DirectJackSynced(bucketed, promiseAdded, rewardAdded);
    }

    function sync(uint256 maxSyncDays) external nonReentrant {
        _sync(maxSyncDays, msg.sender);
    }

    function _sync(uint256 maxSyncDays, address keeper) internal {
        uint256 dayNow_ = _currentDay();

        if (dayNow_ == 0) return;

        _rollLiveMaxTarget();

        uint256 latestFinishedDay = dayNow_ - 1;

        if (lastSyncedDay >= latestFinishedDay) {
            lastKnownTreasuryJackReserve = _treasuryJackBalance();
            lastKnownTreasuryJackIncomeTotal = treasury.totalJackIncomeFiveYears();
            return;
        }

        SyncWindow memory w = _buildSyncWindow(latestFinishedDay, maxSyncDays);

        uint256 requestedNet = _calculateRequestedNet(w.incomeDeltaToUse, w.reserveBaseline);

        PullResult memory pulled;

        if (requestedNet > 0) {
            pulled = _pullJackAndBucket(requestedNet, keeper);
        }

        lastSyncedDay = w.toDay;
        lastKnownTreasuryJackReserve = w.currentReserve;

        if (w.fullSync) {
            lastKnownTreasuryJackIncomeTotal = w.currentIncomeTotal;
        } else {
            lastKnownTreasuryJackIncomeTotal += w.incomeDeltaToUse;
        }

        emit Synced(
            w.fromDay,
            w.toDay,
            w.reserveBaseline,
            w.currentReserve,
            requestedNet,
            pulled.netAdded,
            pulled.keeperReward
        );
    }

    function _buildSyncWindow(
        uint256 latestFinishedDay,
        uint256 maxSyncDays
    ) internal view returns (SyncWindow memory w) {
        uint256 unsynced = latestFinishedDay - lastSyncedDay;

        uint256 processDays = maxSyncDays == 0 || maxSyncDays > unsynced
            ? unsynced
            : maxSyncDays;

        w.fromDay = lastSyncedDay + 1;
        w.toDay = lastSyncedDay + processDays;
        w.currentReserve = _treasuryJackBalance();

        w.reserveBaseline = w.currentReserve < lastKnownTreasuryJackReserve
            ? w.currentReserve
            : lastKnownTreasuryJackReserve;

        w.currentIncomeTotal = treasury.totalJackIncomeFiveYears();

        for (uint256 d = w.fromDay; d <= w.toDay; d++) {
            w.incomeDeltaToUse += treasury.getJackIncomeForDay(d);
        }

        w.fullSync = processDays >= unsynced;
    }

    function _calculateRequestedNet(
        uint256 incomeDelta,
        uint256 reserveBaseline
    ) internal view returns (uint256 requestedNet) {
        if (incomeDelta == 0) return 0;
        if (requestThresholdJack == 0 || treasuryJackTarget == 0) return 0;

        uint256 idleBefore = idleUnpromisedJack();

        if (idleBefore >= requestThresholdJack) return 0;

        uint256 reserveProgressBps = reserveBaseline >= treasuryJackTarget
            ? BPS_DENOMINATOR
            : (reserveBaseline * BPS_DENOMINATOR) / treasuryJackTarget;

        uint256 takeRateBps = (maxDailyTakeBps * reserveProgressBps) / BPS_DENOMINATOR;

        if (takeRateBps == 0) return 0;

        uint256 baseTake = (incomeDelta * takeRateBps) / BPS_DENOMINATOR;
        requestedNet = (baseTake * takeMultiplierBps) / BPS_DENOMINATOR;

        uint256 idleGap = requestThresholdJack - idleBefore;
        uint256 maxRequestByGap = _requestAmountForNetAfterKeeperCap(idleGap);

        if (requestedNet > maxRequestByGap) {
            requestedNet = maxRequestByGap;
        }
    }

    function _pullJackAndBucket(
        uint256 requestedNet,
        address keeper
    ) internal returns (PullResult memory r) {
        uint256 idleBefore = idleUnpromisedJack();
        uint256 beforeBal = jack.balanceOf(address(this));

        treasury.requestJack(requestedNet, address(this));

        uint256 received = _balanceIncrease(beforeBal);

        if (received == 0) return r;

        r.keeperReward = (received * keeperRewardBps) / KEEPER_BPS_DENOMINATOR;

        _payKeeper(keeper, r.keeperReward);

        uint256 afterKeeperBal = jack.balanceOf(address(this));
        uint256 rawNetAdded = afterKeeperBal > beforeBal ? afterKeeperBal - beforeBal : 0;

        r.netAdded = _capNetToIdleGap(rawNetAdded, idleBefore);

        if (r.netAdded > 0) {
            _bucketJack(r.netAdded);
        }
    }

    function _payKeeper(address keeper, uint256 amount) internal {
        if (amount > 0 && keeper != address(0)) {
            jack.safeTransfer(keeper, amount);
        }
    }

    function _capNetToIdleGap(uint256 amount, uint256 idleBefore) internal view returns (uint256) {
        if (amount == 0) return 0;
        if (requestThresholdJack == 0 || idleBefore >= requestThresholdJack) return 0;

        uint256 gap = requestThresholdJack - idleBefore;

        return amount > gap ? gap : amount;
    }

    function _balanceIncrease(uint256 beforeBal) internal view returns (uint256) {
        uint256 afterBal = jack.balanceOf(address(this));

        return afterBal > beforeBal ? afterBal - beforeBal : 0;
    }

    function currentActivePdaiTarget() public view returns (uint256) {
        if (maxPdaiTargetLive == 0) return 0;
        if (maxPdaiTargetLive <= minPdaiTarget) return maxPdaiTargetLive;

        uint256 reserves = treasury.treasuryPdaiReserves();
        uint256 range = maxPdaiTargetLive - minPdaiTarget;
        uint256 activeTarget = minPdaiTarget + ((range * reserves) / maxPdaiTargetLive);

        return activeTarget > maxPdaiTargetLive ? maxPdaiTargetLive : activeTarget;
    }

    function currentTargetDrivenPayoutBps() public view returns (uint256) {
        uint256 activeTarget = currentActivePdaiTarget();

        if (activeTarget == 0) return maxPayoutBps;

        uint256 reserves = treasury.treasuryPdaiReserves();

        uint256 progressBps = reserves >= activeTarget
            ? BPS_DENOMINATOR
            : (reserves * BPS_DENOMINATOR) / activeTarget;

        uint256 variableRange = maxPayoutBps - minPayoutBps;

        return minPayoutBps + ((variableRange * (BPS_DENOMINATOR - progressBps)) / BPS_DENOMINATOR);
    }

    function environmentStrengthBps() public view returns (uint256) {
        if (maxPayoutBps <= minPayoutBps) return 0;

        uint256 currentPayout = currentTargetDrivenPayoutBps();

        if (currentPayout <= minPayoutBps) return 0;
        if (currentPayout >= maxPayoutBps) return BPS_DENOMINATOR;

        return ((currentPayout - minPayoutBps) * BPS_DENOMINATOR) / (maxPayoutBps - minPayoutBps);
    }

    function coverageCapBps() public view returns (uint256) {
        uint256 freePromise = freePromiseJack();

        if (freePromise == 0) return maxPayoutBps;

        uint256 freeReward = freeRewardJack();
        uint256 cap = (freeReward * BPS_DENOMINATOR) / freePromise;

        return cap > maxPayoutBps ? maxPayoutBps : cap;
    }

    function maxCurrentPayoutBps() public view returns (uint256) {
        uint256 targetDriven = currentTargetDrivenPayoutBps();
        uint256 coverage = coverageCapBps();

        return targetDriven < coverage ? targetDriven : coverage;
    }

    function userPayoutBps(uint256 vestSeconds) public view returns (uint256) {
        require(_isValidVestTerm(vestSeconds), "invalid vest term");

        uint256 env = environmentStrengthBps();

        uint256 weakGross = _termCurveValue(vestSeconds, 200, 500, 800, 1200);
        uint256 strongGross = _termCurveValue(vestSeconds, 500, 1000, 1500, 2500);

        uint256 payout = weakGross + (((strongGross - weakGross) * env) / BPS_DENOMINATOR);

        uint256 cap = maxCurrentPayoutBps();

        return payout > cap ? cap : payout;
    }

    function feeBpsForUserPayout(
        uint256,
        uint256 vestSeconds
    ) public view returns (uint256) {
        require(_isValidVestTerm(vestSeconds), "invalid vest term");

        uint256 env = environmentStrengthBps();

        uint256 weakFee = _termCurveValue(vestSeconds, 200, 160, 130, 100);
        uint256 strongFee = _termCurveValue(vestSeconds, 800, 640, 520, 320);

        return weakFee + (((strongFee - weakFee) * env) / BPS_DENOMINATOR);
    }

    function quoteBond(
        uint256 pdaiAmount,
        uint256 vestSeconds
    )
        external
        view
        returns (
            uint256 payoutBps,
            uint256 feeBps,
            uint256 feePdai,
            uint256 netPdai,
            uint256 baseJack,
            uint256 rewardJack,
            uint256 totalJack,
            uint256 vestWeight
        )
    {
        BondCalc memory c = _calcBond(pdaiAmount, vestSeconds);

        payoutBps = c.payoutBps;
        feeBps = c.feeBps;
        feePdai = c.feePdai;
        netPdai = c.netPdai;
        baseJack = c.baseJack;
        rewardJack = c.rewardJack;
        totalJack = c.baseJack + c.rewardJack;
        vestWeight = vestWeightFor(vestSeconds);
    }

    function vestedAmounts(uint256 tokenId) public view returns (uint256 vestedBase, uint256 vestedReward) {
        Bond memory bond = bonds[tokenId];

        if (bond.startTime == 0 || block.timestamp <= bond.startTime) return (0, 0);

        uint256 effectiveTime = block.timestamp >= bond.vestEnd ? bond.vestEnd : block.timestamp;
        uint256 elapsed = effectiveTime - bond.startTime;
        uint256 duration = bond.vestEnd - bond.startTime;

        vestedBase = (bond.baseJack * elapsed) / duration;
        vestedReward = (bond.rewardJack * elapsed) / duration;
    }

    function claimable(uint256 tokenId) public view returns (uint256 claimBase, uint256 claimReward) {
        Bond memory bond = bonds[tokenId];

        if (bond.swept || bond.startTime == 0 || block.timestamp > bond.expiryTime) {
            return (0, 0);
        }

        (uint256 vestedBase, uint256 vestedReward) = vestedAmounts(tokenId);

        if (vestedBase > bond.claimedBase) claimBase = vestedBase - bond.claimedBase;
        if (vestedReward > bond.claimedReward) claimReward = vestedReward - bond.claimedReward;
    }

    function freePromiseJack() public view returns (uint256) {
        return promiseBucketJack > promisedBaseLiability ? promiseBucketJack - promisedBaseLiability : 0;
    }

    function freeRewardJack() public view returns (uint256) {
        return rewardBucketJack > promisedRewardLiability ? rewardBucketJack - promisedRewardLiability : 0;
    }

    function unbucketedJack() public view returns (uint256) {
        uint256 bal = jack.balanceOf(address(this));
        uint256 bucketed = promiseBucketJack + rewardBucketJack;

        return bal > bucketed ? bal - bucketed : 0;
    }

    function idleUnpromisedJack() public view returns (uint256) {
        return freePromiseJack() + freeRewardJack() + unbucketedJack();
    }

    function isFullySynced() external view returns (bool) {
        return _isFullySynced();
    }

    function currentDay() external view returns (uint256) {
        return _currentDay();
    }

    function finishedDay() external view returns (uint256) {
        uint256 dayNow_ = _currentDay();

        return dayNow_ == 0 ? 0 : dayNow_ - 1;
    }

    function unsyncedDays() external view returns (uint256) {
        uint256 dayNow_ = _currentDay();

        if (dayNow_ == 0) return 0;

        uint256 latestFinished = dayNow_ - 1;

        if (lastSyncedDay >= latestFinished) return 0;

        return latestFinished - lastSyncedDay;
    }

    function treasuryJackReserveNow() external view returns (uint256) {
        return _treasuryJackBalance();
    }

    function treasuryPdaiReserveNow() external view returns (uint256) {
        return treasury.treasuryPdaiReserves();
    }

    function treasuryJackIncomeFiveYearsNow() external view returns (uint256) {
        return treasury.totalJackIncomeFiveYears();
    }

    function treasuryJackIncomeDeltaSinceLastSync() external view returns (uint256) {
        uint256 currentTotal = treasury.totalJackIncomeFiveYears();

        if (currentTotal <= lastKnownTreasuryJackIncomeTotal) return 0;

        return currentTotal - lastKnownTreasuryJackIncomeTotal;
    }

    function treasuryJackIncomeToday() external view returns (uint256) {
        return treasury.getJackIncomeForDay(treasury.getCurrentDay());
    }

    function treasuryJackIncomeForDay(uint256 dayIndex) external view returns (uint256) {
        return treasury.getJackIncomeForDay(dayIndex);
    }

    function oracleStatus() external view returns (bool ready, bool stale, bool liquidityGood) {
        ready = oracle.isReady();
        stale = oracle.isStale();
        liquidityGood = oracle.liquidityOk();
    }

    function vestWeightFor(uint256 vestSeconds) public view returns (uint256) {
        require(_isValidVestTerm(vestSeconds), "invalid vest term");

        uint256 customWeight = customVestWeightBps[vestSeconds];

        if (customWeight > 0) return customWeight;

        return _defaultVestWeightFor(vestSeconds);
    }

    function _defaultVestWeightFor(uint256 vestSeconds) internal pure returns (uint256) {
        return _termCurveValue(vestSeconds, 1_000, 4_000, 7_000, 10_000);
    }

    function _termCurveValue(
        uint256 vestSeconds,
        uint256 value90d,
        uint256 value1y,
        uint256 value2y,
        uint256 value5y
    ) internal pure returns (uint256) {
        if (vestSeconds <= 365 days) {
            return _interpolate(vestSeconds, 90 days, 365 days, value90d, value1y);
        }

        if (vestSeconds <= 730 days) {
            return _interpolate(vestSeconds, 365 days, 730 days, value1y, value2y);
        }

        return _interpolate(vestSeconds, 730 days, 1825 days, value2y, value5y);
    }

    function _interpolate(
        uint256 x,
        uint256 x0,
        uint256 x1,
        uint256 y0,
        uint256 y1
    ) internal pure returns (uint256) {
        if (x <= x0) return y0;
        if (x >= x1) return y1;

        // Fee curves decrease with term length; payout curves increase.
        // Round the interpolated delta down in either direction.
        if (y1 >= y0) {
            return y0 + (((y1 - y0) * (x - x0)) / (x1 - x0));
        }
        return y0 - (((y0 - y1) * (x - x0)) / (x1 - x0));
    }

    function _isValidVestTerm(uint256 vestSeconds) internal pure returns (bool) {
        return vestSeconds >= MIN_VEST_SECONDS && vestSeconds <= MAX_VEST_SECONDS;
    }

    function bondCore(uint256 tokenId)
        external
        view
        returns (
            uint256 pdaiDeposited,
            uint256 baseJack,
            uint256 rewardJack,
            uint256 claimedBase,
            uint256 claimedReward,
            uint256 startTime,
            uint256 vestEnd,
            uint256 expiryTime,
            bool swept,
            address owner
        )
    {
        Bond storage b = bonds[tokenId];

        owner = _tokenExists(tokenId) ? ownerOf(tokenId) : address(0);

        return (
            b.pdaiDeposited,
            b.baseJack,
            b.rewardJack,
            b.claimedBase,
            b.claimedReward,
            b.startTime,
            b.vestEnd,
            b.expiryTime,
            b.swept,
            owner
        );
    }

    function bondProgress(uint256 tokenId)
        external
        view
        returns (
            uint256 vestedBase,
            uint256 vestedReward,
            uint256 claimBase,
            uint256 claimReward
        )
    {
        (vestedBase, vestedReward) = vestedAmounts(tokenId);
        (claimBase, claimReward) = claimable(tokenId);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "zero treasury");

        treasury = IJackTreasury(newTreasury);

        lastKnownTreasuryJackReserve = _treasuryJackBalance();
        lastKnownTreasuryJackIncomeTotal = treasury.totalJackIncomeFiveYears();

        emit TreasuryUpdated(newTreasury);
    }

    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "zero oracle");

        oracle = IJackOracleHub(newOracle);

        emit OracleUpdated(newOracle);
    }

    function setRequestThresholdJack(uint256 newThresholdJack) external onlyOwner {
        requestThresholdJack = newThresholdJack;

        emit ThresholdUpdated(newThresholdJack);
    }

    function setTreasuryJackTarget(uint256 newTarget) external onlyOwner {
        require(newTarget > 0, "zero target");

        treasuryJackTarget = newTarget;

        emit TreasuryJackTargetUpdated(newTarget);
    }

    function setTakeConfig(
        uint256 _maxDailyTakeBps,
        uint256 _takeMultiplierBps,
        uint256 _keeperRewardBps
    ) external onlyOwner {
        require(_maxDailyTakeBps <= BPS_DENOMINATOR, "take too high");
        require(_takeMultiplierBps > 0, "bad multiplier");
        require(_keeperRewardBps < KEEPER_BPS_DENOMINATOR, "keeper too high");

        maxDailyTakeBps = _maxDailyTakeBps;
        takeMultiplierBps = _takeMultiplierBps;
        keeperRewardBps = _keeperRewardBps;

        emit TakeConfigUpdated(_maxDailyTakeBps, _takeMultiplierBps, _keeperRewardBps);
    }

    function setPdaiTargetConfig(
        uint256 _minPdaiTarget,
        uint256 _configuredMaxPdaiTarget,
        uint256 _maxTargetStepPerAction
    ) external onlyOwner {
        require(_configuredMaxPdaiTarget >= _minPdaiTarget, "bad target config");
        require(_maxTargetStepPerAction > 0, "zero step");

        minPdaiTarget = _minPdaiTarget;
        maxPdaiTargetConfigured = _configuredMaxPdaiTarget;

        if (maxPdaiTargetLive < _minPdaiTarget) {
            maxPdaiTargetLive = _minPdaiTarget;
        }

        maxTargetStepPerAction = _maxTargetStepPerAction;

        emit PdaiTargetConfigUpdated(
            minPdaiTarget,
            maxPdaiTargetConfigured,
            maxPdaiTargetLive,
            maxTargetStepPerAction
        );
    }

    function setMaxPdaiTargetLive(uint256 newLiveMaxPdaiTarget) external onlyOwner {
        require(newLiveMaxPdaiTarget >= minPdaiTarget, "live max too low");

        maxPdaiTargetLive = newLiveMaxPdaiTarget;

        emit PdaiTargetConfigUpdated(
            minPdaiTarget,
            maxPdaiTargetConfigured,
            maxPdaiTargetLive,
            maxTargetStepPerAction
        );
    }

    function setPayoutConfig(
        uint256 _minPayoutBps,
        uint256 _maxPayoutBps,
        uint256 _minFeeBps,
        uint256 _variableFeeRangeBps,
        uint256 _bondGracePeriod
    ) external onlyOwner {
        require(_minPayoutBps <= _maxPayoutBps, "bad payout range");
        require(_maxPayoutBps <= BPS_DENOMINATOR, "payout too high");
        require(_minFeeBps + _variableFeeRangeBps < BPS_DENOMINATOR, "fee too high");

        minPayoutBps = _minPayoutBps;
        maxPayoutBps = _maxPayoutBps;
        minFeeBps = _minFeeBps;
        variableFeeRangeBps = _variableFeeRangeBps;
        bondGracePeriod = _bondGracePeriod;

        emit PayoutConfigUpdated(
            _minPayoutBps,
            _maxPayoutBps,
            _minFeeBps,
            _variableFeeRangeBps,
            _bondGracePeriod
        );
    }

    function setBootstrapMode(bool enabled) external onlyOwner {
        bootstrapMode = enabled;

        emit BootstrapConfigUpdated(enabled);
    }

    function setVestWeight(uint256 vestSeconds, uint256 weightBps) external onlyOwner {
        require(_isValidVestTerm(vestSeconds), "invalid vest term");
        require(weightBps <= BPS_DENOMINATOR, "bad weight");

        customVestWeightBps[vestSeconds] = weightBps;

        emit VestWeightUpdated(vestSeconds, weightBps);
    }

    function setLastKnownTreasuryJackReserve(uint256 reserveAmount) external onlyOwner {
        lastKnownTreasuryJackReserve = reserveAmount;
    }

    function setLastKnownTreasuryJackIncomeTotal(uint256 incomeTotal) external onlyOwner {
        lastKnownTreasuryJackIncomeTotal = incomeTotal;
    }

    function rebucketExistingJack(uint256 promiseAdd, uint256 rewardAdd) external onlyOwner {
        require(promiseAdd + rewardAdd <= unbucketedJack(), "insufficient unbucketed JACK");

        promiseBucketJack += promiseAdd;
        rewardBucketJack += rewardAdd;

        emit Rebucketed(promiseAdd, rewardAdd);
    }

    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(jack), "no JACK rescue");
        require(token != address(pdai), "no pDAI rescue");
        require(to != address(0), "zero to");

        IERC20(token).safeTransfer(to, amount);
    }

    function _treasuryJackBalance() internal view returns (uint256) {
        return jack.balanceOf(address(treasury));
    }

    function _pokeAndCheckOracle() internal {
        oracle.updateIfNeeded();

        require(oracle.isReady(), "oracle not ready");
        require(!oracle.isStale(), "oracle stale");
        require(oracle.liquidityOk(), "oracle liquidity low");
    }

    function _calcBond(uint256 pdaiAmount, uint256 vestSeconds) internal view returns (BondCalc memory c) {
        require(pdaiAmount > 0, "zero deposit");
        require(_isValidVestTerm(vestSeconds), "invalid vest term");

        c.payoutBps = userPayoutBps(vestSeconds);
        c.feeBps = feeBpsForUserPayout(c.payoutBps, vestSeconds);

        c.feePdai = (pdaiAmount * c.feeBps) / BPS_DENOMINATOR;
        c.netPdai = pdaiAmount - c.feePdai;

        require(c.netPdai > 0, "net pDAI zero");

        c.baseJack = oracle.quotePdaiToJack(c.netPdai);
        c.rewardJack = (c.baseJack * c.payoutBps) / BPS_DENOMINATOR;
    }

    function _handlePdaiTransfer(
        address user,
        uint256 pdaiAmount,
        uint256 netPdai,
        uint256 feePdai
    ) internal {
        require(user != address(0), "zero user");
        require(netPdai + feePdai == pdaiAmount, "bad pDAI split");
        require(netPdai > 0, "net pDAI zero");

        uint256 beforeBal = pdai.balanceOf(address(this));

        pdai.safeTransferFrom(user, address(this), pdaiAmount);

        uint256 received = pdai.balanceOf(address(this)) - beforeBal;

        require(received == pdaiAmount, "pDAI fee unsupported");

        pdai.safeApprove(address(treasury), 0);
        pdai.safeApprove(address(treasury), pdaiAmount);

        treasury.depositPdaiReserve(netPdai);

        if (feePdai > 0) {
            treasury.receiveFunds(address(pdai), feePdai);
        }

        pdai.safeApprove(address(treasury), 0);

        uint256 afterBal = pdai.balanceOf(address(this));

        require(afterBal <= beforeBal, "pDAI not sent");
    }

    function _bucketJack(uint256 jackAmount) internal returns (uint256 promiseAdd, uint256 rewardAdd) {
        (promiseAdd, rewardAdd) = _splitByCurrentEnvironment(jackAmount);

        promiseBucketJack += promiseAdd;
        rewardBucketJack += rewardAdd;
    }

    function _splitByCurrentEnvironment(uint256 jackAmount)
        internal
        view
        returns (uint256 promiseAdd, uint256 rewardAdd)
    {
        uint256 payoutBps = currentTargetDrivenPayoutBps();
        uint256 denominator = BPS_DENOMINATOR + payoutBps;

        promiseAdd = (jackAmount * BPS_DENOMINATOR) / denominator;
        rewardAdd = jackAmount - promiseAdd;
    }

    function _requestAmountForNetAfterKeeperCap(uint256 netCapAfterKeeper) internal view returns (uint256) {
        if (netCapAfterKeeper == 0) return 0;
        if (keeperRewardBps == 0) return netCapAfterKeeper;

        require(keeperRewardBps < KEEPER_BPS_DENOMINATOR, "bad keeper");

        uint256 denominatorAfterKeeper = KEEPER_BPS_DENOMINATOR - keeperRewardBps;

        return (netCapAfterKeeper * KEEPER_BPS_DENOMINATOR) / denominatorAfterKeeper;
    }

    function _rollLiveMaxTarget() internal {
        uint256 live = maxPdaiTargetLive;
        uint256 configured = maxPdaiTargetConfigured;

        if (live == configured) return;

        uint256 step = maxTargetStepPerAction;

        if (step == 0) {
            maxPdaiTargetLive = configured;
            return;
        }

        if (live < configured) {
            uint256 diffUp = configured - live;
            maxPdaiTargetLive = live + (diffUp > step ? step : diffUp);
        } else {
            uint256 diffDown = live - configured;
            uint256 next = live - (diffDown > step ? step : diffDown);

            maxPdaiTargetLive = next < minPdaiTarget ? minPdaiTarget : next;
        }
    }

    function _isFullySynced() internal view returns (bool) {
        uint256 dayNow_ = _currentDay();

        return dayNow_ == 0 || lastSyncedDay >= dayNow_ - 1;
    }

    function _currentDay() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }

    function _tokenExists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
}
