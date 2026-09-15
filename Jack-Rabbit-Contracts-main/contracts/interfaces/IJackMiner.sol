// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IJackMining {
    // =============================================================
    // ERRORS
    // =============================================================

    error ZeroAddress();
    error ZeroAmount();
    error BadBps();
    error BadDuration();
    error BadTargetCount();
    error BadPath();
    error BadToken();
    error TokenAlreadyAdded();
    error TokenNotAdded();
    error ActiveWeek();
    error WeekNotRunning();
    error AlreadyFinalized();
    error DeploymentClosed();

    error PaymentBelowMinimum(
        uint256 paid,
        uint256 minimumRequired
    );

    error BadMsgValue();
    error NoPLSAllowed();
    error NoTokensReceived();
    error TreasuryDepositFailed();
    error FundingUnavailable();
    error OracleQuoteUnavailable();
    error OracleSwapUnsafe();
    error NoJackReceived();
    error InvalidWeek();
    error ClaimWindowClosed();
    error AlreadyClaimed();
    error NoPoints();
    error CannotRescueJack();
    error PlsSendFailed();
    error CreditInvariant();

    // =============================================================
    // ENUMS / STRUCTS
    // =============================================================

    enum WeekMode {
        NONE,
        ORGANIC,
        TREASURY
    }

    /*
        WeekData is included as the complete Mining week model.

        The contract does not expose the full structure through one
        automatic getter because that caused the stack-too-deep error.

        Use:
        - getWeekInfo()
        - getWeekFundingInfo()
        - getWeekEconomics()
    */
    struct WeekData {
        uint256 startTime;
        uint256 endTime;

        uint256 totalPoints;
        uint256 totalDeployments;

        uint256 rewardPool;
        uint256 unlockedRewardPool;
        uint256 paidOut;
        uint256 rolledOver;

        uint256 totalProtocolFees;
        uint256 adminFeesPaid;
        uint256 treasuryFeesDeposited;

        uint256 rewardValueAtActivation;
        uint256 rewardValueAtFinalization;
        uint256 economicCostBasis;
        uint256 requiredTreasuryRevenue;

        uint256 minDeployAmount;
        uint256 targetDeploymentCount;
        uint256 targetProfitBps;
        uint256 reinvestmentBps;

        uint256 treasuryFundingRequested;
        uint256 treasuryFundingReceived;
        uint256 treasuryFundingConsumed;
        uint256 treasuryFundingReturned;
        uint256 fundingCreditConsumed;

        uint256 organicJackAdded;
        uint256 treasuryJackBought;

        address feeToken;
        WeekMode mode;

        bool finalized;
        bool swept;
    }

    struct Miner {
        uint256 amountPaid;
        uint256 points;
        uint256 deployedAt;
    }

    struct FundingAccount {
        uint256 availableCredit;
        uint256 pendingCredit;

        uint256 lifetimeTreasuryDeposited;
        uint256 lifetimeCreditCreated;
        uint256 lifetimeFundingRequested;
        uint256 lifetimeFundingReceived;
        uint256 lifetimeFundingConsumed;
        uint256 lifetimeFundingReturned;
        uint256 lifetimeProtectedAccumulation;
    }

    // =============================================================
    // EVENTS
    // =============================================================

    event WeekPending(
        uint256 indexed weekId,
        address indexed feeToken
    );

    event WeekStarted(
        uint256 indexed weekId,
        uint256 startTime,
        uint256 endTime,
        WeekMode mode,
        address indexed feeToken,
        uint256 rewardPool,
        uint256 minimumDeployment,
        uint256 requiredTreasuryRevenue
    );

    event WeekFinalized(
        uint256 indexed weekId,
        uint256 rewardPool,
        uint256 unlockedRewardPool,
        uint256 treasuryFeesDeposited,
        uint256 requiredTreasuryRevenue,
        uint256 rolledOver,
        WeekMode mode
    );

    event WeekSwept(
        uint256 indexed weekId,
        uint256 sweptAmount
    );

    event JackSynced(
        uint256 detectedInflow,
        uint256 addedToReserve
    );

    event OrganicWeekPrepared(
        uint256 indexed weekId,
        uint256 jackAmount,
        uint256 rewardValue
    );

    event TreasuryFundingAttempt(
        uint256 indexed weekId,
        address indexed token,
        uint256 requestedAmount,
        uint256 availableCredit
    );

    event TreasuryFundingCompleted(
        uint256 indexed weekId,
        address indexed token,
        uint256 requestedAmount,
        uint256 receivedAmount,
        uint256 consumedAmount,
        uint256 returnedAmount,
        uint256 jackReceived
    );

    event MinerDeployed(
        uint256 indexed weekId,
        address indexed user,
        uint256 indexed minerId,
        uint256 amountPaid,
        uint256 timeRemaining,
        uint256 points
    );

    event ProtocolFeeRouted(
        uint256 indexed weekId,
        address indexed token,
        uint256 totalPaid,
        uint256 adminPaid,
        uint256 treasuryDeposited
    );

    event CreditMatured(
        uint256 indexed weekId,
        address indexed token,
        uint256 treasuryDeposit,
        uint256 reusableCredit,
        uint256 protectedAccumulation
    );

    event CreditConsumed(
        uint256 indexed weekId,
        address indexed token,
        uint256 amount,
        uint256 remainingCredit
    );

    event RewardUnlockCalculated(
        uint256 indexed weekId,
        uint256 economicCostBasis,
        uint256 requiredTreasuryRevenue,
        uint256 treasuryFeesDeposited,
        uint256 unlockedRewardPool
    );

    event Claimed(
        uint256 indexed weekId,
        address indexed user,
        uint256 grossReward,
        uint256 jackSpent
    );

    event TreasuryUpdated(
        address indexed oldTreasury,
        address indexed newTreasury
    );

    event RouterUpdated(
        address indexed oldRouter,
        address indexed newRouter
    );

    event OracleHubUpdated(
        address indexed oldOracleHub,
        address indexed newOracleHub
    );

    event AdminUpdated(
        address indexed oldAdmin,
        address indexed newAdmin
    );

    event PayTokenUpdated(
        address indexed oldToken,
        address indexed newToken
    );

    event HardcapUpdated(
        uint256 oldCap,
        uint256 newCap
    );

    event WeekDurationUpdated(
        uint256 oldDuration,
        uint256 newDuration
    );

    event MinerCutoffUpdated(
        uint256 oldCutoff,
        uint256 newCutoff
    );

    event TargetDeploymentCountUpdated(
        uint256 oldCount,
        uint256 newCount
    );

    event TargetProfitUpdated(
        uint256 oldBps,
        uint256 newBps
    );

    event ReinvestmentUpdated(
        uint256 oldBps,
        uint256 newBps
    );

    event MinOutUpdated(
        uint256 oldBps,
        uint256 newBps
    );

    event TokenEconomicsUpdated(
        address indexed token,
        uint256 baseMinimumDeployment,
        uint256 minTreasuryActivationCredit,
        uint256 maxTreasuryFundingPerWeek
    );

    event ProtocolFeeTokenAdded(
        address indexed token
    );

    event ProtocolFeeTokenRemoved(
        address indexed token
    );

    event SwapPathUpdated(
        address indexed token,
        address[] path
    );

    // =============================================================
    // OWNERSHIP
    // =============================================================

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    function owner()
        external
        view
        returns (address);

    function transferOwnership(
        address newOwner
    ) external;

    function renounceOwnership() external;

    // =============================================================
    // CONSTANT GETTERS
    // =============================================================

    function BPS()
        external
        view
        returns (uint256);

    function ADMIN_FEE_BPS()
        external
        view
        returns (uint256);

    function TREASURY_FEE_BPS()
        external
        view
        returns (uint256);

    function MAX_REINVESTMENT_BPS()
        external
        view
        returns (uint256);

    function MAX_TARGET_PROFIT_BPS()
        external
        view
        returns (uint256);

    // =============================================================
    // CORE CONTRACT REFERENCES
    // =============================================================

    function JACK()
        external
        view
        returns (address);

    function WPLS()
        external
        view
        returns (address);

    function treasury()
        external
        view
        returns (address);

    function router()
        external
        view
        returns (address);

    function oracleHub()
        external
        view
        returns (address);

    function admin()
        external
        view
        returns (address);

    function payToken()
        external
        view
        returns (address);

    function fundingToken()
        external
        view
        returns (address);

    // =============================================================
    // GLOBAL CONFIGURATION GETTERS
    // =============================================================

    function weekDuration()
        external
        view
        returns (uint256);

    function minerCutoff()
        external
        view
        returns (uint256);

    function currentWeekId()
        external
        view
        returns (uint256);

    function maxJackPerWeek()
        external
        view
        returns (uint256);

    function storedReserveForNextWeek()
        external
        view
        returns (uint256);

    function lastJackBalance()
        external
        view
        returns (uint256);

    function targetDeploymentCount()
        external
        view
        returns (uint256);

    function targetProfitBps()
        external
        view
        returns (uint256);

    function reinvestmentBps()
        external
        view
        returns (uint256);

    function minOutBps()
        external
        view
        returns (uint256);

    function protocolTokenIndex()
        external
        view
        returns (uint256);

    // =============================================================
    // TOKEN CONFIGURATION GETTERS
    // =============================================================

    function swapPath(
        address token,
        uint256 index
    )
        external
        view
        returns (address);

    function baseMinimumDeployment(
        address token
    )
        external
        view
        returns (uint256);

    function minTreasuryActivationCredit(
        address token
    )
        external
        view
        returns (uint256);

    function maxTreasuryFundingPerWeek(
        address token
    )
        external
        view
        returns (uint256);

    function protocolFeeTokens(
        uint256 index
    )
        external
        view
        returns (address);

    function isProtocolFeeToken(
        address token
    )
        external
        view
        returns (bool);

    // =============================================================
    // FUNDING ACCOUNT GETTERS
    // =============================================================

    /*
        Automatic getter generated by:

        mapping(address => FundingAccount)
            public fundingAccounts;
    */
    function fundingAccounts(
        address token
    )
        external
        view
        returns (
            uint256 availableCredit,
            uint256 pendingCredit,
            uint256 lifetimeTreasuryDeposited,
            uint256 lifetimeCreditCreated,
            uint256 lifetimeFundingRequested,
            uint256 lifetimeFundingReceived,
            uint256 lifetimeFundingConsumed,
            uint256 lifetimeFundingReturned,
            uint256 lifetimeProtectedAccumulation
        );

    function getFundingAccount(
        address token
    )
        external
        view
        returns (FundingAccount memory);

    // =============================================================
    // USER ACCOUNTING GETTERS
    // =============================================================

    function userPoints(
        uint256 weekId,
        address user
    )
        external
        view
        returns (uint256);

    function minerCount(
        uint256 weekId,
        address user
    )
        external
        view
        returns (uint256);

    function miners(
        uint256 weekId,
        address user,
        uint256 minerId
    )
        external
        view
        returns (
            uint256 amountPaid,
            uint256 points,
            uint256 deployedAt
        );

    function userClaimed(
        uint256 weekId,
        address user
    )
        external
        view
        returns (bool);

    // =============================================================
    // MAIN USER / PUBLIC ACTIONS
    // =============================================================

    function deployMiner(
        uint256 amount
    ) external payable;

    function claim(
        uint256 weekId
    ) external;

    function sync() external;

    function syncWeek() external;

    /*
        Returns true when a week is already running
        or when an organic week was activated.

        This function does not spend Treasury credit.
    */
    function tryFunding()
        external
        returns (bool activated);

    // =============================================================
    // ADMIN SETTERS
    // =============================================================

    function setTreasury(
        address newTreasury
    ) external;

    function setRouter(
        address newRouter
    ) external;

    function setOracleHub(
        address newOracleHub
    ) external;

    function setAdmin(
        address newAdmin
    ) external;

    function setPayToken(
        address token
    ) external;

    function selectNextProtocolFeeToken()
        external;

    function setHardcap(
        uint256 newCap
    ) external;

    function setWeekDuration(
        uint256 newDuration
    ) external;

    function setMinerCutoff(
        uint256 newCutoff
    ) external;

    function setTargetDeploymentCount(
        uint256 newCount
    ) external;

    function setTargetProfitBps(
        uint256 newBps
    ) external;

    function setReinvestmentBps(
        uint256 newBps
    ) external;

    function setMinOutBps(
        uint256 newBps
    ) external;

    function setTokenEconomics(
        address token,
        uint256 baseMinimum,
        uint256 activationMinimum,
        uint256 weeklyFundingCap
    ) external;

    function setSwapPath(
        address token,
        address[] calldata path
    ) external;

    function addProtocolFeeToken(
        address token
    ) external;

    function removeProtocolFeeToken(
        uint256 index
    ) external;

    // =============================================================
    // BASIC WEEK VIEWS
    // =============================================================

    function getCurrentWeek()
        external
        view
        returns (uint256);

    function claimableWeekId()
        external
        view
        returns (uint256);

    function currentWeekTimeRemaining()
        external
        view
        returns (uint256);

    function isCurrentWeekRunning()
        external
        view
        returns (bool);

    /*
        Replaces the old public weekData() automatic getter.
    */
    function getWeekInfo(
        uint256 weekId
    )
        external
        view
        returns (
            uint256 rewardPool,
            uint256 unlockedRewardPool,
            uint256 totalPoints,
            uint256 totalProtocolFees,
            uint256 treasuryFeesDeposited,
            uint256 requiredTreasuryRevenue,
            uint256 minDeployAmount,
            uint256 totalDeployments,
            address feeToken,
            WeekMode mode,
            bool finalized
        );

    function getWeekFundingInfo(
        uint256 weekId
    )
        external
        view
        returns (
            uint256 requested,
            uint256 received,
            uint256 consumed,
            uint256 returnedAmount,
            uint256 creditConsumed,
            uint256 organicJackAdded,
            uint256 treasuryJackBought
        );

    function getWeekEconomics(
        uint256 weekId
    )
        external
        view
        returns (
            uint256 rewardValueAtActivation,
            uint256 rewardValueAtFinalization,
            uint256 economicCostBasis,
            uint256 requiredTreasuryRevenue,
            uint256 treasuryFeesDeposited,
            uint256 recoveryBps,
            uint256 operatingSurplus,
            uint256 operatingShortfall
        );

    // =============================================================
    // USER VIEWS
    // =============================================================

    function getUserWeekStats(
        uint256 weekId,
        address user
    )
        external
        view
        returns (
            uint256 points,
            uint256 minersDeployed,
            bool claimed
        );

    function getUserMiner(
        uint256 weekId,
        address user,
        uint256 minerId
    )
        external
        view
        returns (Miner memory);

    function getUserMiners(
        uint256 weekId,
        address user
    )
        external
        view
        returns (Miner[] memory list);

    function getUserGrossReward(
        uint256 weekId,
        address user
    )
        external
        view
        returns (uint256);

    // =============================================================
    // ECONOMIC / REWARD VIEWS
    // =============================================================

    function getCurrentUnlockEstimate()
        external
        view
        returns (
            uint256 estimatedUnlockedJack,
            uint256 recoveryBps,
            uint256 treasuryFees,
            uint256 requiredRevenue
        );

    function getProtocolFeeTokens()
        external
        view
        returns (address[] memory);

    function getSwapPath(
        address token
    )
        external
        view
        returns (address[] memory);

    function getFeeSplit(
        uint256 amount
    )
        external
        pure
        returns (
            uint256 adminShare,
            uint256 treasuryShare
        );

    // =============================================================
    // RESCUE
    // =============================================================

    function rescueToken(
        address token,
        uint256 amount,
        address to
    ) external;
}