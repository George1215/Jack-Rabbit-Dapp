// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
    JackMining.sol — Weekly, fee-backed JACK mining

    Core rules:
    - WeekMode.NONE means no mining week is running and no timer is active.
    - An ORGANIC week is funded only by JACK already held by Mining:
      organic JACK, stored rollover JACK, or unclaimed JACK swept from an older week.
    - A TREASURY week is funded only by an approved external holding token requested
      from Treasury and swapped into JACK.
    - Treasury never supplies JACK to start a Treasury week.
    - Both modes route deployment payments 10% to admin and 90% to Treasury.
    - Mining alone records token-specific funding credit. Treasury remains unchanged.
    - Current-week Treasury deposits are pending credit and mature only at finalization.
    - Only the configured reusable share becomes future funding credit. The rest is
      protected accumulation that Mining will never authorize itself to request back.
    - A Treasury request can never exceed Mining's matured credit for that token.
    - Every deployment must meet the fixed minimum calculated when the week starts.
    - At finalization, only the percentage of JACK economically backed by actual
      Treasury fee deposits becomes claimable. Locked JACK rolls forward.
*/

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/IPulseXRouter02.sol";
import "./interfaces/IJackTreasury.sol";
import "./interfaces/IWPLS.sol";
import "./interfaces/IJackOracleHub.sol";

contract JackMining is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============================================================
    // CONSTANTS
    // =============================================================

    uint256 public constant BPS = 10_000;
    uint256 public constant ADMIN_FEE_BPS = 1_000;
    uint256 public constant TREASURY_FEE_BPS = 9_000;
    uint256 public constant MAX_REINVESTMENT_BPS = 8_000;
    uint256 public constant MAX_TARGET_PROFIT_BPS = 10_000;

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
    error PaymentBelowMinimum(uint256 paid, uint256 minimumRequired);
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
    // TYPES
    // =============================================================

    enum WeekMode {
        NONE,
        ORGANIC,
        TREASURY
    }

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

    struct FundingResult {
        uint256 requested;
        uint256 received;
        uint256 consumed;
        uint256 returnedAmount;
        uint256 jackReceived;
    }

    // =============================================================
    // CORE REFERENCES
    // =============================================================

    IERC20 public immutable JACK;
    address public immutable WPLS;

    IJackTreasury public treasury;
    IPulseXRouter02 public router;
    IJackOracleHub public oracleHub;

    address public admin;

    // address(0) represents native PLS.
    address public payToken;
    address public fundingToken;

    // =============================================================
    // GLOBAL CONFIGURATION
    // =============================================================

    uint256 public weekDuration = 7 days;
    uint256 public minerCutoff = 5 minutes;
    uint256 public currentWeekId = 1;

    uint256 public maxJackPerWeek = 100_000e18;
    uint256 public storedReserveForNextWeek;
    uint256 public lastJackBalance;

    uint256 public targetDeploymentCount = 20;
    uint256 public targetProfitBps = 2_000;
    uint256 public reinvestmentBps = 6_000;
    uint256 public minOutBps = 9_500;

    // Token => token-to-JACK path.
    // Native PLS uses WPLS as the path key.
    mapping(address => address[]) public swapPath;

    mapping(address => uint256) public baseMinimumDeployment;
    mapping(address => uint256) public minTreasuryActivationCredit;
    mapping(address => uint256) public maxTreasuryFundingPerWeek;

    // =============================================================
    // ACCOUNTING
    // =============================================================

    /*
        This mapping is deliberately private.

        Making a mapping to the large WeekData struct public causes Solidity
        to generate an oversized automatic getter and can itself produce
        a stack-too-deep compiler error.

        Use:
        - getWeekInfo()
        - getWeekFundingInfo()
        - getWeekEconomics()
    */
    mapping(uint256 => WeekData) private _weekData;

    mapping(address => FundingAccount) public fundingAccounts;

    mapping(uint256 => mapping(address => uint256)) public userPoints;
    mapping(uint256 => mapping(address => uint256)) public minerCount;

    mapping(
        uint256 => mapping(address => mapping(uint256 => Miner))
    ) public miners;

    mapping(uint256 => mapping(address => bool)) public userClaimed;

    address[] public protocolFeeTokens;
    mapping(address => bool) public isProtocolFeeToken;

    uint256 public protocolTokenIndex;

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
    // CONSTRUCTOR / RECEIVE
    // =============================================================

    constructor(
        address _jack,
        address _treasury,
        address _router,
        address _oracleHub,
        address _admin,
        address _wpls
    ) Ownable(msg.sender) {
        if (
            _jack == address(0) ||
            _treasury == address(0) ||
            _router == address(0) ||
            _oracleHub == address(0) ||
            _admin == address(0) ||
            _wpls == address(0)
        ) {
            revert ZeroAddress();
        }

        JACK = IERC20(_jack);
        treasury = IJackTreasury(_treasury);
        router = IPulseXRouter02(_router);
        oracleHub = IJackOracleHub(_oracleHub);

        admin = _admin;
        WPLS = _wpls;

        _preparePendingWeek(false);

        lastJackBalance =
            JACK.balanceOf(address(this));
    }

    receive() external payable {}

    // =============================================================
    // USER ACTIONS
    // =============================================================

    function deployMiner(
        uint256 amount
    ) external payable nonReentrant {
        if (amount == 0) {
            revert ZeroAmount();
        }

        syncWeek();

        WeekData storage w =
            _weekData[currentWeekId];

        if (w.mode == WeekMode.NONE) {
            bool activated =
                _tryActivateOrganicWeek();

            if (!activated) {
                activated =
                    _tryActivateTreasuryWeek();
            }

            if (!activated) {
                revert FundingUnavailable();
            }
        }

        if (w.finalized) {
            revert AlreadyFinalized();
        }

        if (
            w.startTime == 0 ||
            block.timestamp >= w.endTime
        ) {
            revert WeekNotRunning();
        }

        if (
            block.timestamp + minerCutoff >=
            w.endTime
        ) {
            revert DeploymentClosed();
        }

        uint256 amountPaid =
            _collectPayment(
                w.feeToken,
                amount
            );

        if (amountPaid < w.minDeployAmount) {
            revert PaymentBelowMinimum(
                amountPaid,
                w.minDeployAmount
            );
        }

        (
            uint256 adminPaid,
            uint256 treasuryDeposited
        ) = _routeProtocolFee(
            w.feeToken,
            amountPaid
        );

        w.totalProtocolFees += amountPaid;
        w.adminFeesPaid += adminPaid;
        w.treasuryFeesDeposited +=
            treasuryDeposited;

        FundingAccount storage account =
            fundingAccounts[w.feeToken];

        account.pendingCredit +=
            treasuryDeposited;

        account.lifetimeTreasuryDeposited +=
            treasuryDeposited;

        uint256 timeRemaining =
            w.endTime - block.timestamp;

        uint256 points =
            amountPaid * timeRemaining;

        uint256 minerId =
            ++minerCount[currentWeekId][msg.sender];

        miners[currentWeekId][msg.sender][minerId] =
            Miner({
                amountPaid: amountPaid,
                points: points,
                deployedAt: block.timestamp
            });

        w.totalDeployments += 1;
        w.totalPoints += points;

        userPoints[currentWeekId][msg.sender] +=
            points;

        emit ProtocolFeeRouted(
            currentWeekId,
            w.feeToken,
            amountPaid,
            adminPaid,
            treasuryDeposited
        );

        emit MinerDeployed(
            currentWeekId,
            msg.sender,
            minerId,
            amountPaid,
            timeRemaining,
            points
        );
    }

    function claim(
        uint256 weekId
    ) external nonReentrant {
        syncWeek();

        if (weekId == 0) {
            revert InvalidWeek();
        }

        if (
            currentWeekId < 2 ||
            weekId != currentWeekId - 1
        ) {
            revert ClaimWindowClosed();
        }

        WeekData storage w =
            _weekData[weekId];

        if (!w.finalized) {
            revert WeekNotRunning();
        }

        if (w.swept) {
            revert ClaimWindowClosed();
        }

        if (
            userClaimed[weekId][msg.sender]
        ) {
            revert AlreadyClaimed();
        }

        uint256 points =
            userPoints[weekId][msg.sender];

        if (
            points == 0 ||
            w.totalPoints == 0
        ) {
            revert NoPoints();
        }

        userClaimed[weekId][msg.sender] =
            true;

        uint256 grossReward =
            (w.unlockedRewardPool * points) /
            w.totalPoints;

        uint256 remaining =
            w.unlockedRewardPool > w.paidOut
                ? w.unlockedRewardPool -
                    w.paidOut
                : 0;

        if (grossReward > remaining) {
            grossReward = remaining;
        }

        uint256 spent;

        if (grossReward > 0) {
            uint256 beforeBalance =
                JACK.balanceOf(address(this));

            JACK.safeTransfer(
                msg.sender,
                grossReward
            );

            uint256 afterBalance =
                JACK.balanceOf(address(this));

            spent =
                beforeBalance - afterBalance;

            w.paidOut += spent;
        }

        lastJackBalance =
            JACK.balanceOf(address(this));

        emit Claimed(
            weekId,
            msg.sender,
            grossReward,
            spent
        );
    }

    // =============================================================
    // PUBLIC SYNCHRONIZATION
    // =============================================================

    function sync() public {
        uint256 currentBalance =
            JACK.balanceOf(address(this));

        if (currentBalance <= lastJackBalance) {
            lastJackBalance = currentBalance;
            return;
        }

        uint256 inflow =
            currentBalance - lastJackBalance;

        /*
            Once a week has been prepared, its reward pool
            and minimum remain fixed.

            Any later JACK inflow is reserved for a future
            organic week.
        */
        storedReserveForNextWeek += inflow;

        lastJackBalance = currentBalance;

        emit JackSynced(
            inflow,
            inflow
        );

        WeekData storage w =
            _weekData[currentWeekId];

        if (w.mode == WeekMode.NONE) {
            _tryActivateOrganicWeek();
        }
    }

    function syncWeek() public {
        sync();

        WeekData storage w =
            _weekData[currentWeekId];

        if (
            w.mode == WeekMode.NONE ||
            w.finalized ||
            block.timestamp < w.endTime
        ) {
            return;
        }

        uint256 finishedWeekId =
            currentWeekId;

        _finalizeCurrentWeek();

        uint256 nextWeekId =
            finishedWeekId + 1;

        if (nextWeekId > 2) {
            _sweepWeek(nextWeekId - 2);
        }

        currentWeekId = nextWeekId;

        _preparePendingWeek(true);

        lastJackBalance =
            JACK.balanceOf(address(this));
    }

    /*
        This is a safe public trigger.

        It may synchronize and activate an organic week,
        but it cannot consume Treasury credit.

        Treasury credit can only be consumed atomically
        during deployMiner().
    */
    function tryFunding()
        external
        returns (bool activated)
    {
        syncWeek();

        WeekData storage w =
            _weekData[currentWeekId];

        if (w.mode != WeekMode.NONE) {
            return true;
        }

        activated =
            _tryActivateOrganicWeek();
    }

    // =============================================================
    // INTERNAL WEEK ACTIVATION
    // =============================================================

    function _tryActivateOrganicWeek()
        internal
        returns (bool)
    {
        WeekData storage w =
            _weekData[currentWeekId];

        if (
            w.mode != WeekMode.NONE ||
            w.finalized
        ) {
            return false;
        }

        if (storedReserveForNextWeek == 0) {
            return false;
        }

        if (!_tokenReady(payToken)) {
            return false;
        }

        uint256 rewardAmount =
            storedReserveForNextWeek >
                maxJackPerWeek
                ? maxJackPerWeek
                : storedReserveForNextWeek;

        uint256 rewardValue =
            _quoteJackValueInToken(
                payToken,
                rewardAmount
            );

        if (rewardValue == 0) {
            return false;
        }

        storedReserveForNextWeek -=
            rewardAmount;

        w.rewardPool = rewardAmount;
        w.organicJackAdded = rewardAmount;

        _activateWeek(
            WeekMode.ORGANIC,
            rewardValue,
            rewardValue
        );

        emit OrganicWeekPrepared(
            currentWeekId,
            rewardAmount,
            rewardValue
        );

        return true;
    }

    function _tryActivateTreasuryWeek()
        internal
        returns (bool)
    {
        WeekData storage w =
            _weekData[currentWeekId];

        if (
            w.mode != WeekMode.NONE ||
            w.finalized
        ) {
            return false;
        }

        address token = payToken;

        uint256 requestAmount =
            _treasuryFundingRequestAmount(token);

        if (requestAmount == 0) {
            return false;
        }

        emit TreasuryFundingAttempt(
            currentWeekId,
            token,
            requestAmount,
            fundingAccounts[token]
                .availableCredit
        );

        FundingResult memory result =
            _requestAndSwapTreasuryFunding(
                token,
                requestAmount,
                swapPath[_pathToken(token)]
            );

        if (
            result.jackReceived == 0 ||
            result.consumed == 0
        ) {
            return false;
        }

        _completeTreasuryActivation(
            w,
            token,
            result
        );

        return true;
    }

    function _treasuryFundingRequestAmount(
        address token
    ) internal view returns (uint256) {
        if (!_tokenReady(token)) {
            return 0;
        }

        uint256 availableCredit =
            fundingAccounts[token]
                .availableCredit;

        uint256 activationMinimum =
            minTreasuryActivationCredit[token];

        if (
            availableCredit == 0 ||
            availableCredit <
                activationMinimum
        ) {
            return 0;
        }

        address[] storage path =
            swapPath[_pathToken(token)];

        uint256 tokenNeeded =
            _quoteTokenNeededForJack(
                path,
                maxJackPerWeek
            );

        if (tokenNeeded == 0) {
            return 0;
        }

        uint256 desired =
            _min(
                tokenNeeded,
                availableCredit
            );

        uint256 ownerCap =
            maxTreasuryFundingPerWeek[token];

        if (ownerCap > 0) {
            desired =
                _min(
                    desired,
                    ownerCap
                );
        }

        uint256 safeAmount =
            _oracleSafeAmount(
                path,
                desired
            );

        if (
            safeAmount == 0 ||
            safeAmount < activationMinimum
        ) {
            return 0;
        }

        return safeAmount;
    }

    function _completeTreasuryActivation(
        WeekData storage w,
        address token,
        FundingResult memory result
    ) internal {
        FundingAccount storage account =
            fundingAccounts[token];

        if (
            result.consumed >
            account.availableCredit
        ) {
            revert CreditInvariant();
        }

        account.availableCredit -=
            result.consumed;

        account.lifetimeFundingRequested +=
            result.requested;

        account.lifetimeFundingReceived +=
            result.received;

        account.lifetimeFundingConsumed +=
            result.consumed;

        account.lifetimeFundingReturned +=
            result.returnedAmount;

        uint256 rewardAmount =
            _recordTreasuryWeekFunding(
                w,
                result
            );

        uint256 rewardValue =
            _quoteJackValueInToken(
                token,
                rewardAmount
            );

        if (rewardValue == 0) {
            revert OracleQuoteUnavailable();
        }

        uint256 activationCostBasis =
            rewardValue > result.consumed
                ? rewardValue
                : result.consumed;

        _activateWeek(
            WeekMode.TREASURY,
            rewardValue,
            activationCostBasis
        );

        _emitTreasuryActivationEvents(
            token,
            result,
            account.availableCredit
        );

        lastJackBalance =
            JACK.balanceOf(address(this));
    }

    function _recordTreasuryWeekFunding(
        WeekData storage w,
        FundingResult memory result
    ) internal returns (uint256 rewardAmount) {
        rewardAmount =
            result.jackReceived >
                maxJackPerWeek
                ? maxJackPerWeek
                : result.jackReceived;

        uint256 excess =
            result.jackReceived -
            rewardAmount;

        if (excess > 0) {
            storedReserveForNextWeek +=
                excess;
        }

        w.rewardPool = rewardAmount;

        w.treasuryJackBought =
            result.jackReceived;

        w.treasuryFundingRequested =
            result.requested;

        w.treasuryFundingReceived =
            result.received;

        w.treasuryFundingConsumed =
            result.consumed;

        w.treasuryFundingReturned =
            result.returnedAmount;

        w.fundingCreditConsumed =
            result.consumed;
    }

    function _emitTreasuryActivationEvents(
        address token,
        FundingResult memory result,
        uint256 remainingCredit
    ) internal {
        emit CreditConsumed(
            currentWeekId,
            token,
            result.consumed,
            remainingCredit
        );

        emit TreasuryFundingCompleted(
            currentWeekId,
            token,
            result.requested,
            result.received,
            result.consumed,
            result.returnedAmount,
            result.jackReceived
        );
    }

    function _activateWeek(
        WeekMode mode,
        uint256 rewardValue,
        uint256 activationCostBasis
    ) internal {
        if (mode == WeekMode.NONE) {
            revert WeekNotRunning();
        }

        if (
            rewardValue == 0 ||
            activationCostBasis == 0
        ) {
            revert OracleQuoteUnavailable();
        }

        WeekData storage w =
            _weekData[currentWeekId];

        w.mode = mode;
        w.feeToken = payToken;

        w.startTime = block.timestamp;
        w.endTime =
            block.timestamp + weekDuration;

        w.rewardValueAtActivation =
            rewardValue;

        w.economicCostBasis =
            activationCostBasis;

        w.targetDeploymentCount =
            targetDeploymentCount;

        w.targetProfitBps =
            targetProfitBps;

        w.reinvestmentBps =
            reinvestmentBps;

        w.requiredTreasuryRevenue =
            _requiredTreasuryRevenue(
                activationCostBasis,
                w.targetProfitBps
            );

        uint256 calculatedMinimum =
            _minimumDeployment(
                w.requiredTreasuryRevenue,
                w.targetDeploymentCount
            );

        uint256 baseMinimum =
            baseMinimumDeployment[
                w.feeToken
            ];

        w.minDeployAmount =
            calculatedMinimum > baseMinimum
                ? calculatedMinimum
                : baseMinimum;

        emit WeekStarted(
            currentWeekId,
            w.startTime,
            w.endTime,
            mode,
            w.feeToken,
            w.rewardPool,
            w.minDeployAmount,
            w.requiredTreasuryRevenue
        );
    }

    function _preparePendingWeek(
        bool rotateToken
    ) internal {
        WeekData storage w =
            _weekData[currentWeekId];

        w.startTime = 0;
        w.endTime = 0;
        w.mode = WeekMode.NONE;
        w.feeToken = payToken;

        if (
            rotateToken &&
            protocolFeeTokens.length > 0
        ) {
            _selectNextProtocolToken();
            w.feeToken = payToken;
        }

        emit WeekPending(
            currentWeekId,
            payToken
        );
    }

    function _selectNextProtocolToken()
        internal
    {
        uint256 length =
            protocolFeeTokens.length;

        if (length == 0) {
            return;
        }

        uint256 nextIndex =
            protocolTokenIndex % length;

        for (
            uint256 i = 0;
            i < length;
            i++
        ) {
            if (
                protocolFeeTokens[i] ==
                payToken
            ) {
                nextIndex =
                    (i + 1) % length;

                break;
            }
        }

        address nextToken =
            protocolFeeTokens[nextIndex];

        protocolTokenIndex =
            (nextIndex + 1) % length;

        address old = payToken;

        payToken = nextToken;
        fundingToken = nextToken;

        emit PayTokenUpdated(
            old,
            nextToken
        );
    }

    // =============================================================
    // TREASURY FUNDING / SWAPS
    // =============================================================

    function _requestAndSwapTreasuryFunding(
        address token,
        uint256 requestAmount,
        address[] storage path
    )
        internal
        returns (FundingResult memory result)
    {
        result.requested = requestAmount;

        uint256 miningBalanceBefore =
            _miningTokenBalance(token);

        uint256 jackBefore =
            JACK.balanceOf(address(this));

        try treasury.requestHoldingToken(
            token,
            requestAmount,
            address(this)
        ) {
            // Continue.
        } catch {
            return result;
        }

        uint256 miningBalanceAfterRequest =
            _miningTokenBalance(token);

        result.received =
            miningBalanceAfterRequest >
                miningBalanceBefore
                ? miningBalanceAfterRequest -
                    miningBalanceBefore
                : 0;

        if (result.received == 0) {
            return result;
        }

        uint256 safeReceived =
            _oracleSafeAmount(
                path,
                result.received
            );

        if (
            safeReceived == 0 ||
            !_oracleHealthy(
                path,
                safeReceived
            )
        ) {
            result.returnedAmount =
                _returnFundingToTreasury(
                    token,
                    result.received
                );

            result.consumed =
                result.received >
                    result.returnedAmount
                    ? result.received -
                        result.returnedAmount
                    : 0;

            return result;
        }

        if (token == address(0)) {
            _swapPLSToJack(
                safeReceived,
                path
            );
        } else {
            _swapERC20ToJack(
                token,
                safeReceived,
                path
            );
        }

        uint256 postSwapBalance =
            _miningTokenBalance(token);

        uint256 fundingLeft =
            postSwapBalance >
                miningBalanceBefore
                ? postSwapBalance -
                    miningBalanceBefore
                : 0;

        if (fundingLeft > 0) {
            result.returnedAmount =
                _returnFundingToTreasury(
                    token,
                    fundingLeft
                );
        }

        result.jackReceived =
            JACK.balanceOf(address(this)) -
            jackBefore;

        result.consumed =
            result.received >
                result.returnedAmount
                ? result.received -
                    result.returnedAmount
                : 0;
    }

    function _swapPLSToJack(
        uint256 amount,
        address[] storage path
    ) internal {
        IERC20 wrapped =
            IERC20(WPLS);

        uint256 wrappedBefore =
            wrapped.balanceOf(address(this));

        IWPLS(WPLS).deposit{
            value: amount
        }();

        wrapped.forceApprove(
            address(router),
            0
        );

        wrapped.forceApprove(
            address(router),
            amount
        );

        uint256 minOut =
            _minimumJackOut(
                path,
                amount
            );

        try router
            .swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amount,
                minOut,
                path,
                address(this),
                block.timestamp + 60
            )
        {
            wrapped.forceApprove(
                address(router),
                0
            );
        } catch {
            wrapped.forceApprove(
                address(router),
                0
            );
        }

        uint256 wrappedAfter =
            wrapped.balanceOf(address(this));

        uint256 fundingWrappedLeft =
            wrappedAfter > wrappedBefore
                ? wrappedAfter -
                    wrappedBefore
                : 0;

        if (fundingWrappedLeft > 0) {
            IWPLS(WPLS).withdraw(
                fundingWrappedLeft
            );
        }
    }

    function _swapERC20ToJack(
        address tokenAddress,
        uint256 amount,
        address[] storage path
    ) internal {
        IERC20 token =
            IERC20(tokenAddress);

        token.forceApprove(
            address(router),
            0
        );

        token.forceApprove(
            address(router),
            amount
        );

        uint256 minOut =
            _minimumJackOut(
                path,
                amount
            );

        try router
            .swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amount,
                minOut,
                path,
                address(this),
                block.timestamp + 60
            )
        {
            token.forceApprove(
                address(router),
                0
            );
        } catch {
            token.forceApprove(
                address(router),
                0
            );
        }
    }

    function _returnFundingToTreasury(
        address token,
        uint256 amount
    )
        internal
        returns (uint256 actualReturned)
    {
        if (amount == 0) {
            return 0;
        }

        uint256 beforeBalance =
            _treasuryBalance(token);

        _depositTreasuryHolding(
            token,
            amount
        );

        uint256 afterBalance =
            _treasuryBalance(token);

        actualReturned =
            afterBalance > beforeBalance
                ? afterBalance - beforeBalance
                : 0;
    }

    // =============================================================
    // PAYMENT / FEE ROUTING
    // =============================================================

    function _collectPayment(
        address token,
        uint256 amount
    ) internal returns (uint256 amountPaid) {
        if (token == address(0)) {
            if (msg.value != amount) {
                revert BadMsgValue();
            }

            return amount;
        }

        if (msg.value != 0) {
            revert NoPLSAllowed();
        }

        IERC20 paymentToken =
            IERC20(token);

        uint256 beforeBalance =
            paymentToken.balanceOf(
                address(this)
            );

        paymentToken.safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        uint256 afterBalance =
            paymentToken.balanceOf(
                address(this)
            );

        amountPaid =
            afterBalance > beforeBalance
                ? afterBalance - beforeBalance
                : 0;

        if (amountPaid == 0) {
            revert NoTokensReceived();
        }
    }

    function _routeProtocolFee(
        address token,
        uint256 amountPaid
    )
        internal
        returns (
            uint256 adminPaid,
            uint256 treasuryDeposited
        )
    {
        adminPaid =
            (amountPaid * ADMIN_FEE_BPS) /
            BPS;

        uint256 intendedTreasuryShare =
            amountPaid - adminPaid;

        _sendToken(
            token,
            admin,
            adminPaid
        );

        treasuryDeposited =
            _depositTreasuryHolding(
                token,
                intendedTreasuryShare
            );

        if (
            intendedTreasuryShare > 0 &&
            treasuryDeposited == 0
        ) {
            revert TreasuryDepositFailed();
        }
    }

    function _depositTreasuryHolding(
        address token,
        uint256 amount
    )
        internal
        returns (uint256 actualDeposited)
    {
        if (amount == 0) {
            return 0;
        }

        /*
            Native PLS transfers are exact. If Treasury's call
            succeeds, Mining records the full amount deposited.

            This avoids depending on Treasury retaining native PLS
            in its raw address balance after deposit.
        */
        if (token == address(0)) {
            treasury.depositHoldingToken{
                value: amount
            }(
                address(0),
                amount
            );

            return amount;
        }

        uint256 beforeBalance =
            _treasuryBalance(token);

        IERC20 erc =
            IERC20(token);

        erc.forceApprove(
            address(treasury),
            0
        );

        erc.forceApprove(
            address(treasury),
            amount
        );

        treasury.depositHoldingToken(
            token,
            amount
        );

        erc.forceApprove(
            address(treasury),
            0
        );

        uint256 afterBalance =
            _treasuryBalance(token);

        actualDeposited =
            afterBalance > beforeBalance
                ? afterBalance - beforeBalance
                : 0;
    }

    function _sendToken(
        address token,
        address to,
        uint256 amount
    ) internal {
        if (amount == 0) {
            return;
        }

        if (to == address(0)) {
            revert ZeroAddress();
        }

        if (token == address(0)) {
            _sendPLS(
                to,
                amount
            );
        } else {
            IERC20(token).safeTransfer(
                to,
                amount
            );
        }
    }

    // =============================================================
    // FINALIZATION / CREDIT MATURITY / SWEEP
    // =============================================================

    function _finalizeCurrentWeek()
        internal
    {
        WeekData storage w =
            _weekData[currentWeekId];

        if (w.mode == WeekMode.NONE) {
            revert WeekNotRunning();
        }

        if (w.finalized) {
            revert AlreadyFinalized();
        }

        uint256 finalRewardValue =
            _quoteJackValueInToken(
                w.feeToken,
                w.rewardPool
            );

        if (finalRewardValue == 0) {
            finalRewardValue =
                w.rewardValueAtActivation;
        }

        w.rewardValueAtFinalization =
            finalRewardValue;

        uint256 finalCostBasis =
            w.economicCostBasis;

        if (
            finalRewardValue >
            finalCostBasis
        ) {
            finalCostBasis =
                finalRewardValue;
        }

        if (
            w.treasuryFundingConsumed >
            finalCostBasis
        ) {
            finalCostBasis =
                w.treasuryFundingConsumed;
        }

        w.economicCostBasis =
            finalCostBasis;

        w.requiredTreasuryRevenue =
            _requiredTreasuryRevenue(
                finalCostBasis,
                w.targetProfitBps
            );

        uint256 unlocked;

        if (
            w.requiredTreasuryRevenue > 0 &&
            w.treasuryFeesDeposited > 0
        ) {
            uint256 achievedBps =
                (w.treasuryFeesDeposited *
                    BPS) /
                w.requiredTreasuryRevenue;

            if (achievedBps > BPS) {
                achievedBps = BPS;
            }

            unlocked =
                (w.rewardPool * achievedBps) /
                BPS;
        }

        w.unlockedRewardPool = unlocked;

        uint256 lockedReward =
            w.rewardPool - unlocked;

        if (lockedReward > 0) {
            storedReserveForNextWeek +=
                lockedReward;

            w.rolledOver +=
                lockedReward;
        }

        _matureWeekCredit(w);

        w.finalized = true;

        emit RewardUnlockCalculated(
            currentWeekId,
            w.economicCostBasis,
            w.requiredTreasuryRevenue,
            w.treasuryFeesDeposited,
            w.unlockedRewardPool
        );

        emit WeekFinalized(
            currentWeekId,
            w.rewardPool,
            w.unlockedRewardPool,
            w.treasuryFeesDeposited,
            w.requiredTreasuryRevenue,
            w.rolledOver,
            w.mode
        );
    }

    function _matureWeekCredit(
        WeekData storage w
    ) internal {
        FundingAccount storage account =
            fundingAccounts[w.feeToken];

        uint256 depositAmount =
            w.treasuryFeesDeposited;

        if (depositAmount == 0) {
            return;
        }

        if (
            account.pendingCredit <
            depositAmount
        ) {
            revert CreditInvariant();
        }

        account.pendingCredit -=
            depositAmount;

        uint256 reusable =
            (depositAmount *
                w.reinvestmentBps) /
            BPS;

        uint256 protectedAmount =
            depositAmount - reusable;

        account.availableCredit +=
            reusable;

        account.lifetimeCreditCreated +=
            reusable;

        account
            .lifetimeProtectedAccumulation +=
            protectedAmount;

        emit CreditMatured(
            currentWeekId,
            w.feeToken,
            depositAmount,
            reusable,
            protectedAmount
        );
    }

    function _sweepWeek(
        uint256 weekId
    ) internal {
        WeekData storage w =
            _weekData[weekId];

        if (
            !w.finalized ||
            w.swept
        ) {
            return;
        }

        uint256 remaining =
            w.unlockedRewardPool > w.paidOut
                ? w.unlockedRewardPool -
                    w.paidOut
                : 0;

        w.swept = true;

        if (remaining > 0) {
            storedReserveForNextWeek +=
                remaining;

            w.rolledOver += remaining;

            w.paidOut =
                w.unlockedRewardPool;
        }

        emit WeekSwept(
            weekId,
            remaining
        );
    }

    // =============================================================
    // QUOTING / ECONOMIC CALCULATIONS
    // =============================================================

    function _quoteJackValueInToken(
        address token,
        uint256 jackAmount
    ) internal view returns (uint256 value) {
        if (jackAmount == 0) {
            return 0;
        }

        address pathToken =
            _pathToken(token);

        address[] storage forward =
            swapPath[pathToken];

        if (forward.length < 2) {
            return 0;
        }

        address[] memory reverse =
            _reversePath(forward);

        try oracleHub.getValidatedTwapValue(
            reverse,
            jackAmount
        ) returns (uint256 amountOut) {
            value = amountOut;
        } catch {
            value = 0;
        }
    }

    function _quoteTokenNeededForJack(
        address[] storage path,
        uint256 jackAmount
    )
        internal
        view
        returns (uint256 tokenNeeded)
    {
        if (
            jackAmount == 0 ||
            path.length < 2
        ) {
            return 0;
        }

        try router.getAmountsIn(
            jackAmount,
            path
        ) returns (
            uint256[] memory amountsIn
        ) {
            if (amountsIn.length > 0) {
                tokenNeeded = amountsIn[0];
            }
        } catch {
            tokenNeeded = 0;
        }
    }

    function _oracleSafeAmount(
        address[] storage path,
        uint256 desired
    )
        internal
        view
        returns (uint256 safeAmount)
    {
        if (
            desired == 0 ||
            path.length < 2
        ) {
            return 0;
        }

        try oracleHub.getMaxSafeSwapIn(
            path,
            desired
        ) returns (uint256 amount) {
            safeAmount =
                amount > desired
                    ? desired
                    : amount;
        } catch {
            safeAmount = 0;
        }
    }

    function _oracleHealthy(
        address[] storage path,
        uint256 amount
    )
        internal
        view
        returns (bool healthy)
    {
        if (
            amount == 0 ||
            path.length < 2
        ) {
            return false;
        }

        try oracleHub.isSwapHealthy(
            path,
            amount
        ) returns (bool ok) {
            healthy = ok;
        } catch {
            healthy = false;
        }
    }

    function _minimumJackOut(
        address[] storage path,
        uint256 amountIn
    )
        internal
        view
        returns (uint256 minOut)
    {
        uint256 expected;

        try oracleHub.getExpectedOut(
            path,
            amountIn
        ) returns (uint256 amountOut) {
            expected = amountOut;
        } catch {
            revert OracleQuoteUnavailable();
        }

        if (expected == 0) {
            revert OracleQuoteUnavailable();
        }

        minOut =
            (expected * minOutBps) /
            BPS;

        if (minOut == 0) {
            minOut = 1;
        }
    }

    function _requiredTreasuryRevenue(
        uint256 costBasis,
        uint256 profitBps
    ) internal pure returns (uint256) {
        return _mulDivUp(
            costBasis,
            BPS + profitBps,
            BPS
        );
    }

    function _minimumDeployment(
        uint256 requiredRevenue,
        uint256 targetCount
    ) internal pure returns (uint256) {
        uint256 requiredGrossFees =
            _mulDivUp(
                requiredRevenue,
                BPS,
                TREASURY_FEE_BPS
            );

        return _ceilDiv(
            requiredGrossFees,
            targetCount
        );
    }

    function _tokenReady(
        address token
    ) internal view returns (bool) {
        address pathToken =
            _pathToken(token);

        address[] storage path =
            swapPath[pathToken];

        return (
            path.length >= 2 &&
            path[0] == pathToken &&
            path[path.length - 1] ==
                address(JACK)
        );
    }

    function _pathToken(
        address token
    ) internal view returns (address) {
        return
            token == address(0)
                ? WPLS
                : token;
    }

    function _reversePath(
        address[] storage source
    )
        internal
        view
        returns (address[] memory reversed)
    {
        uint256 length =
            source.length;

        reversed =
            new address[](length);

        for (
            uint256 i = 0;
            i < length;
            i++
        ) {
            reversed[i] =
                source[length - 1 - i];
        }
    }

    // =============================================================
    // ADMIN CONFIGURATION
    // =============================================================

    function setTreasury(
        address newTreasury
    ) external onlyOwner {
        if (newTreasury == address(0)) {
            revert ZeroAddress();
        }

        emit TreasuryUpdated(
            address(treasury),
            newTreasury
        );

        treasury =
            IJackTreasury(newTreasury);
    }

    function setRouter(
        address newRouter
    ) external onlyOwner {
        if (newRouter == address(0)) {
            revert ZeroAddress();
        }

        emit RouterUpdated(
            address(router),
            newRouter
        );

        router =
            IPulseXRouter02(newRouter);
    }

    function setOracleHub(
        address newOracleHub
    ) external onlyOwner {
        if (newOracleHub == address(0)) {
            revert ZeroAddress();
        }

        emit OracleHubUpdated(
            address(oracleHub),
            newOracleHub
        );

        oracleHub =
            IJackOracleHub(newOracleHub);
    }

    function setAdmin(
        address newAdmin
    ) external onlyOwner {
        if (newAdmin == address(0)) {
            revert ZeroAddress();
        }

        emit AdminUpdated(
            admin,
            newAdmin
        );

        admin = newAdmin;
    }

    function setPayToken(
        address token
    ) external onlyOwner {
        WeekData storage w =
            _weekData[currentWeekId];

        if (w.mode != WeekMode.NONE) {
            revert ActiveWeek();
        }

        if (!isProtocolFeeToken[token]) {
            revert TokenNotAdded();
        }

        if (!_tokenReady(token)) {
            revert BadPath();
        }

        address old = payToken;

        payToken = token;
        fundingToken = token;
        w.feeToken = token;

        emit PayTokenUpdated(
            old,
            token
        );

        emit WeekPending(
            currentWeekId,
            token
        );
    }

    function selectNextProtocolFeeToken()
        external
        onlyOwner
    {
        WeekData storage w =
            _weekData[currentWeekId];

        if (w.mode != WeekMode.NONE) {
            revert ActiveWeek();
        }

        if (
            protocolFeeTokens.length == 0
        ) {
            revert TokenNotAdded();
        }

        _selectNextProtocolToken();

        w.feeToken = payToken;

        emit WeekPending(
            currentWeekId,
            payToken
        );
    }

    function setHardcap(
        uint256 newCap
    ) external onlyOwner {
        if (newCap == 0) {
            revert ZeroAmount();
        }

        emit HardcapUpdated(
            maxJackPerWeek,
            newCap
        );

        maxJackPerWeek = newCap;
    }

    function setWeekDuration(
        uint256 newDuration
    ) external onlyOwner {
        if (
            newDuration == 0 ||
            newDuration <= minerCutoff
        ) {
            revert BadDuration();
        }

        emit WeekDurationUpdated(
            weekDuration,
            newDuration
        );

        weekDuration = newDuration;
    }

    function setMinerCutoff(
        uint256 newCutoff
    ) external onlyOwner {
        if (newCutoff >= weekDuration) {
            revert BadDuration();
        }

        emit MinerCutoffUpdated(
            minerCutoff,
            newCutoff
        );

        minerCutoff = newCutoff;
    }

    function setTargetDeploymentCount(
        uint256 newCount
    ) external onlyOwner {
        if (newCount == 0) {
            revert BadTargetCount();
        }

        emit TargetDeploymentCountUpdated(
            targetDeploymentCount,
            newCount
        );

        targetDeploymentCount =
            newCount;
    }

    function setTargetProfitBps(
        uint256 newBps
    ) external onlyOwner {
        if (
            newBps >
            MAX_TARGET_PROFIT_BPS
        ) {
            revert BadBps();
        }

        emit TargetProfitUpdated(
            targetProfitBps,
            newBps
        );

        targetProfitBps = newBps;
    }

    function setReinvestmentBps(
        uint256 newBps
    ) external onlyOwner {
        if (
            newBps >
            MAX_REINVESTMENT_BPS
        ) {
            revert BadBps();
        }

        emit ReinvestmentUpdated(
            reinvestmentBps,
            newBps
        );

        reinvestmentBps = newBps;
    }

    function setMinOutBps(
        uint256 newBps
    ) external onlyOwner {
        if (
            newBps == 0 ||
            newBps > BPS
        ) {
            revert BadBps();
        }

        emit MinOutUpdated(
            minOutBps,
            newBps
        );

        minOutBps = newBps;
    }

    function setTokenEconomics(
        address token,
        uint256 baseMinimum,
        uint256 activationMinimum,
        uint256 weeklyFundingCap
    ) external onlyOwner {
        if (!isProtocolFeeToken[token]) {
            revert TokenNotAdded();
        }

        baseMinimumDeployment[token] =
            baseMinimum;

        minTreasuryActivationCredit[token] =
            activationMinimum;

        maxTreasuryFundingPerWeek[token] =
            weeklyFundingCap;

        emit TokenEconomicsUpdated(
            token,
            baseMinimum,
            activationMinimum,
            weeklyFundingCap
        );
    }

    function setSwapPath(
        address token,
        address[] calldata path
    ) external onlyOwner {
        if (token == address(0)) {
            revert BadToken();
        }

        if (path.length < 2) {
            revert BadPath();
        }

        if (path[0] != token) {
            revert BadPath();
        }

        if (
            path[path.length - 1] !=
            address(JACK)
        ) {
            revert BadPath();
        }

        for (
            uint256 i = 0;
            i < path.length;
            i++
        ) {
            if (path[i] == address(0)) {
                revert BadPath();
            }

            if (
                i > 0 &&
                path[i] == path[i - 1]
            ) {
                revert BadPath();
            }
        }

        swapPath[token] = path;

        emit SwapPathUpdated(
            token,
            path
        );
    }

    function addProtocolFeeToken(
        address token
    ) external onlyOwner {
        if (isProtocolFeeToken[token]) {
            revert TokenAlreadyAdded();
        }

        if (!_tokenReady(token)) {
            revert BadPath();
        }

        isProtocolFeeToken[token] = true;

        protocolFeeTokens.push(token);

        emit ProtocolFeeTokenAdded(token);

        if (
            protocolFeeTokens.length == 1
        ) {
            address old = payToken;

            payToken = token;
            fundingToken = token;
            protocolTokenIndex = 0;

            _weekData[currentWeekId]
                .feeToken = token;

            emit PayTokenUpdated(
                old,
                token
            );

            emit WeekPending(
                currentWeekId,
                token
            );
        }
    }

    function removeProtocolFeeToken(
        uint256 index
    ) external onlyOwner {
        uint256 length =
            protocolFeeTokens.length;

        if (index >= length) {
            revert TokenNotAdded();
        }

        address token =
            protocolFeeTokens[index];

        if (token == payToken) {
            revert ActiveWeek();
        }

        protocolFeeTokens[index] =
            protocolFeeTokens[length - 1];

        protocolFeeTokens.pop();

        isProtocolFeeToken[token] = false;

        if (
            protocolFeeTokens.length == 0
        ) {
            protocolTokenIndex = 0;
        } else {
            protocolTokenIndex %=
                protocolFeeTokens.length;
        }

        emit ProtocolFeeTokenRemoved(
            token
        );
    }

    // =============================================================
    // VIEWS
    // =============================================================

    function getCurrentWeek()
        external
        view
        returns (uint256)
    {
        return currentWeekId;
    }

    function claimableWeekId()
        external
        view
        returns (uint256)
    {
        return
            currentWeekId < 2
                ? 0
                : currentWeekId - 1;
    }

    function currentWeekTimeRemaining()
        external
        view
        returns (uint256)
    {
        WeekData storage w =
            _weekData[currentWeekId];

        if (
            w.mode == WeekMode.NONE ||
            w.finalized ||
            w.startTime == 0 ||
            block.timestamp >= w.endTime
        ) {
            return 0;
        }

        return
            w.endTime - block.timestamp;
    }

    function isCurrentWeekRunning()
        external
        view
        returns (bool)
    {
        WeekData storage w =
            _weekData[currentWeekId];

        return (
            w.mode != WeekMode.NONE &&
            !w.finalized &&
            w.startTime != 0 &&
            block.timestamp < w.endTime
        );
    }

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
        )
    {
        WeekData storage w =
            _weekData[weekId];

        return (
            w.rewardPool,
            w.unlockedRewardPool,
            w.totalPoints,
            w.totalProtocolFees,
            w.treasuryFeesDeposited,
            w.requiredTreasuryRevenue,
            w.minDeployAmount,
            w.totalDeployments,
            w.feeToken,
            w.mode,
            w.finalized
        );
    }

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
        )
    {
        WeekData storage w =
            _weekData[weekId];

        return (
            w.treasuryFundingRequested,
            w.treasuryFundingReceived,
            w.treasuryFundingConsumed,
            w.treasuryFundingReturned,
            w.fundingCreditConsumed,
            w.organicJackAdded,
            w.treasuryJackBought
        );
    }

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
        )
    {
        WeekData storage w =
            _weekData[weekId];

        if (
            w.requiredTreasuryRevenue > 0
        ) {
            recoveryBps =
                (w.treasuryFeesDeposited *
                    BPS) /
                w.requiredTreasuryRevenue;

            if (recoveryBps > BPS) {
                recoveryBps = BPS;
            }
        }

        if (
            w.treasuryFeesDeposited >=
            w.treasuryFundingConsumed
        ) {
            operatingSurplus =
                w.treasuryFeesDeposited -
                w.treasuryFundingConsumed;
        } else {
            operatingShortfall =
                w.treasuryFundingConsumed -
                w.treasuryFeesDeposited;
        }

        return (
            w.rewardValueAtActivation,
            w.rewardValueAtFinalization,
            w.economicCostBasis,
            w.requiredTreasuryRevenue,
            w.treasuryFeesDeposited,
            recoveryBps,
            operatingSurplus,
            operatingShortfall
        );
    }

    function getFundingAccount(
        address token
    )
        external
        view
        returns (FundingAccount memory)
    {
        return fundingAccounts[token];
    }

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
        )
    {
        return (
            userPoints[weekId][user],
            minerCount[weekId][user],
            userClaimed[weekId][user]
        );
    }

    function getUserMiner(
        uint256 weekId,
        address user,
        uint256 minerId
    ) external view returns (Miner memory) {
        return
            miners[weekId][user][minerId];
    }

    function getUserMiners(
        uint256 weekId,
        address user
    )
        external
        view
        returns (Miner[] memory list)
    {
        uint256 count =
            minerCount[weekId][user];

        list =
            new Miner[](count);

        for (
            uint256 i = 0;
            i < count;
            i++
        ) {
            list[i] =
                miners[weekId][user][i + 1];
        }
    }

    function getUserGrossReward(
        uint256 weekId,
        address user
    ) external view returns (uint256) {
        WeekData storage w =
            _weekData[weekId];

        if (
            !w.finalized ||
            w.totalPoints == 0
        ) {
            return 0;
        }

        uint256 points =
            userPoints[weekId][user];

        if (points == 0) {
            return 0;
        }

        uint256 gross =
            (w.unlockedRewardPool * points) /
            w.totalPoints;

        uint256 remaining =
            w.unlockedRewardPool > w.paidOut
                ? w.unlockedRewardPool -
                    w.paidOut
                : 0;

        return
            gross > remaining
                ? remaining
                : gross;
    }

    function getCurrentUnlockEstimate()
        external
        view
        returns (
            uint256 estimatedUnlockedJack,
            uint256 recoveryBps,
            uint256 treasuryFees,
            uint256 requiredRevenue
        )
    {
        WeekData storage w =
            _weekData[currentWeekId];

        treasuryFees =
            w.treasuryFeesDeposited;

        requiredRevenue =
            w.requiredTreasuryRevenue;

        if (
            w.mode == WeekMode.NONE ||
            requiredRevenue == 0
        ) {
            return (
                0,
                0,
                treasuryFees,
                requiredRevenue
            );
        }

        recoveryBps =
            (treasuryFees * BPS) /
            requiredRevenue;

        if (recoveryBps > BPS) {
            recoveryBps = BPS;
        }

        estimatedUnlockedJack =
            (w.rewardPool * recoveryBps) /
            BPS;
    }

    function getProtocolFeeTokens()
        external
        view
        returns (address[] memory)
    {
        return protocolFeeTokens;
    }

    function getSwapPath(
        address token
    )
        external
        view
        returns (address[] memory)
    {
        return swapPath[token];
    }

    function getFeeSplit(
        uint256 amount
    )
        external
        pure
        returns (
            uint256 adminShare,
            uint256 treasuryShare
        )
    {
        adminShare =
            (amount * ADMIN_FEE_BPS) /
            BPS;

        treasuryShare =
            amount - adminShare;
    }

    // =============================================================
    // RESCUE
    // =============================================================

    function rescueToken(
        address token,
        uint256 amount,
        address to
    )
        external
        onlyOwner
        nonReentrant
    {
        if (to == address(0)) {
            revert ZeroAddress();
        }

        if (token == address(JACK)) {
            revert CannotRescueJack();
        }

        _sendToken(
            token,
            to,
            amount
        );
    }

    // =============================================================
    // LOW-LEVEL HELPERS
    // =============================================================

    function _treasuryBalance(
        address token
    ) internal view returns (uint256) {
        return
            token == address(0)
                ? address(treasury).balance
                : IERC20(token).balanceOf(
                    address(treasury)
                );
    }

    function _miningTokenBalance(
        address token
    ) internal view returns (uint256) {
        return
            token == address(0)
                ? address(this).balance
                : IERC20(token).balanceOf(
                    address(this)
                );
    }

    function _sendPLS(
        address to,
        uint256 amount
    ) internal {
        if (amount == 0) {
            return;
        }

        (bool ok, ) =
            payable(to).call{
                value: amount
            }("");

        if (!ok) {
            revert PlsSendFailed();
        }
    }

    function _min(
        uint256 a,
        uint256 b
    ) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _ceilDiv(
        uint256 a,
        uint256 b
    ) internal pure returns (uint256) {
        if (b == 0) {
            revert ZeroAmount();
        }

        return
            a == 0
                ? 0
                : ((a - 1) / b) + 1;
    }

    function _mulDivUp(
        uint256 x,
        uint256 y,
        uint256 denominator
    ) internal pure returns (uint256) {
        if (denominator == 0) {
            revert ZeroAmount();
        }

        if (
            x == 0 ||
            y == 0
        ) {
            return 0;
        }

        uint256 product =
            x * y;

        return _ceilDiv(
            product,
            denominator
        );
    }
}