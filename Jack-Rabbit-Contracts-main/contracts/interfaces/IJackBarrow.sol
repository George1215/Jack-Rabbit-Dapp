// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IJackBarrow {
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

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

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

    function BPS_DENOMINATOR() external view returns (uint256);
    function KEEPER_BPS_DENOMINATOR() external view returns (uint256);
    function MIN_VEST_SECONDS() external view returns (uint256);
    function MAX_VEST_SECONDS() external view returns (uint256);

    function pdai() external view returns (address);
    function jack() external view returns (address);
    function treasury() external view returns (address);
    function oracle() external view returns (address);
    function owner() external view returns (address);

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function supportsInterface(bytes4 interfaceId) external view returns (bool);

    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;

    function nextTokenId() external view returns (uint256);
    function promiseBucketJack() external view returns (uint256);
    function rewardBucketJack() external view returns (uint256);
    function promisedBaseLiability() external view returns (uint256);
    function promisedRewardLiability() external view returns (uint256);
    function lastSyncedDay() external view returns (uint256);
    function lastKnownTreasuryJackReserve() external view returns (uint256);
    function lastKnownTreasuryJackIncomeTotal() external view returns (uint256);
    function treasuryJackTarget() external view returns (uint256);
    function requestThresholdJack() external view returns (uint256);
    function maxDailyTakeBps() external view returns (uint256);
    function takeMultiplierBps() external view returns (uint256);
    function keeperRewardBps() external view returns (uint256);
    function minPdaiTarget() external view returns (uint256);
    function maxPdaiTargetConfigured() external view returns (uint256);
    function maxPdaiTargetLive() external view returns (uint256);
    function maxTargetStepPerAction() external view returns (uint256);
    function minPayoutBps() external view returns (uint256);
    function maxPayoutBps() external view returns (uint256);
    function minFeeBps() external view returns (uint256);
    function variableFeeRangeBps() external view returns (uint256);
    function bondGracePeriod() external view returns (uint256);
    function bootstrapMode() external view returns (bool);
    function customVestWeightBps(uint256 vestSeconds) external view returns (uint256);

    function bonds(uint256 tokenId)
        external
        view
        returns (
            uint256 pdaiDeposited,
            uint256 baseJack,
            uint256 rewardJack,
            uint256 claimedBase,
            uint256 claimedReward,
            uint64 startTime,
            uint64 vestEnd,
            uint64 expiryTime,
            bool swept
        );

    function openBond(
        uint256 pdaiAmount,
        uint256 vestSeconds,
        uint256 minBaseJackQuote,
        uint256 maxSyncDays
    ) external returns (uint256 tokenId);

    function claim(uint256 tokenId) external;
    function sweepExpiredBond(uint256 tokenId) external;
    function sweepExpiredBatch(uint256[] calldata tokenIds) external;
    function seedJack(uint256 amount) external;
    function syncDirectJack() external returns (uint256 bucketed);
    function sync(uint256 maxSyncDays) external;

    function currentActivePdaiTarget() external view returns (uint256);
    function currentTargetDrivenPayoutBps() external view returns (uint256);
    function environmentStrengthBps() external view returns (uint256);
    function coverageCapBps() external view returns (uint256);
    function maxCurrentPayoutBps() external view returns (uint256);
    function userPayoutBps(uint256 vestSeconds) external view returns (uint256);
    function feeBpsForUserPayout(uint256 payoutBps, uint256 vestSeconds) external view returns (uint256);

    function quoteBond(uint256 pdaiAmount, uint256 vestSeconds)
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
        );

    function vestedAmounts(uint256 tokenId) external view returns (uint256 vestedBase, uint256 vestedReward);
    function claimable(uint256 tokenId) external view returns (uint256 claimBase, uint256 claimReward);

    function freePromiseJack() external view returns (uint256);
    function freeRewardJack() external view returns (uint256);
    function unbucketedJack() external view returns (uint256);
    function idleUnpromisedJack() external view returns (uint256);
    function isFullySynced() external view returns (bool);
    function currentDay() external view returns (uint256);
    function finishedDay() external view returns (uint256);
    function unsyncedDays() external view returns (uint256);

    function treasuryJackReserveNow() external view returns (uint256);
    function treasuryPdaiReserveNow() external view returns (uint256);
    function treasuryJackIncomeFiveYearsNow() external view returns (uint256);
    function treasuryJackIncomeDeltaSinceLastSync() external view returns (uint256);
    function treasuryJackIncomeToday() external view returns (uint256);
    function treasuryJackIncomeForDay(uint256 dayIndex) external view returns (uint256);

    function oracleStatus() external view returns (bool ready, bool stale, bool liquidityGood);
    function vestWeightFor(uint256 vestSeconds) external view returns (uint256);

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
        );

    function bondProgress(uint256 tokenId)
        external
        view
        returns (
            uint256 vestedBase,
            uint256 vestedReward,
            uint256 claimBase,
            uint256 claimReward
        );

    function setTreasury(address newTreasury) external;
    function setOracle(address newOracle) external;
    function setRequestThresholdJack(uint256 newThresholdJack) external;
    function setTreasuryJackTarget(uint256 newTarget) external;

    function setTakeConfig(
        uint256 _maxDailyTakeBps,
        uint256 _takeMultiplierBps,
        uint256 _keeperRewardBps
    ) external;

    function setPdaiTargetConfig(
        uint256 _minPdaiTarget,
        uint256 _configuredMaxPdaiTarget,
        uint256 _maxTargetStepPerAction
    ) external;

    function setMaxPdaiTargetLive(uint256 newLiveMaxPdaiTarget) external;

    function setPayoutConfig(
        uint256 _minPayoutBps,
        uint256 _maxPayoutBps,
        uint256 _minFeeBps,
        uint256 _variableFeeRangeBps,
        uint256 _bondGracePeriod
    ) external;

    function setBootstrapMode(bool enabled) external;
    function setVestWeight(uint256 vestSeconds, uint256 weightBps) external;
    function setLastKnownTreasuryJackReserve(uint256 reserveAmount) external;
    function setLastKnownTreasuryJackIncomeTotal(uint256 incomeTotal) external;
    function rebucketExistingJack(uint256 promiseAdd, uint256 rewardAdd) external;
    function rescueToken(address token, address to, uint256 amount) external;
    function transferOwnership(address newOwner) external;
    function renounceOwnership() external;
}