// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IJackFarmRewardReceiver {
    function depositReward(address token, uint256 amount) external returns (uint256 actualReceived);
}

/// @notice Allocates only assets already held here. No Treasury withdrawal or swap authority.
/// @dev Supported assets must not rebase or charge additional sender-side transfer fees.
///      Classification is an owner attestation, not proof that a transfer generated profit.
contract JackRevenueDistributor is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_ALLOCATIONS = 32;
    address public constant PLS = address(0);

    enum Origin { Unclassified, SeedIncentive, ProtocolFee, ReturnedCapital }
    enum Delivery { Transfer, FarmReward }

    struct Allocation {
        address recipient;
        uint256 amount;
        Delivery delivery;
        bool claimed;
    }

    struct Plan {
        address token;
        Origin origin;
        bytes32 referenceId;
        uint256 total;
        uint256 remaining;
        uint64 executableAt;
        bool canceled;
    }

    uint64 public immutable executionDelay;
    bool public planningEnabled;
    uint256 public nextPlanId = 1;
    mapping(address => bool) public supportedAsset;
    mapping(address => mapping(Delivery => bool)) public approvedDestination;
    mapping(address => uint256) public accountedBalance;
    mapping(address => uint256) public reservedBalance;
    mapping(address => mapping(Origin => uint256)) public unallocated;
    mapping(uint256 => Plan) public plans;
    mapping(uint256 => Allocation[]) private _allocations;

    error InvalidAsset();
    error InvalidDestination();
    error InvalidAmount();
    error InvalidPlan();
    error PlanningDisabled();
    error InsufficientUnallocated();
    error BalanceDeficit();
    error InvalidOrigin();
    error NotExecutable();
    error AlreadyClaimed();
    error NativeTransferFailed();
    error UnsupportedTransferBehavior();
    error CancellationClosed();

    event PlanningEnabled(bool enabled);
    event AssetSupported(address indexed token, bool supported);
    event DestinationApproved(address indexed recipient, Delivery delivery, bool approved);
    event NativeReceived(address indexed sender, uint256 amount);
    event FundsRecorded(address indexed token, address indexed source, uint256 amount, bool directDeposit);
    event FundsClassified(address indexed token, Origin origin, uint256 amount, bytes32 indexed referenceId);
    event PlanCreated(uint256 indexed planId, address indexed token, Origin origin, uint256 total, uint64 executableAt, bytes32 referenceId);
    event AllocationCreated(uint256 indexed planId, uint256 indexed index, address indexed recipient, uint256 amount, Delivery delivery);
    event PlanCanceled(uint256 indexed planId);
    event AllocationPaid(uint256 indexed planId, uint256 indexed index, address indexed recipient, uint256 spent, uint256 received);

    constructor(address initialOwner, uint64 delaySeconds) Ownable(initialOwner) {
        require(delaySeconds > 0 && delaySeconds <= 30 days, "invalid review delay");
        executionDelay = delaySeconds;
    }

    // A plain transfer from JackStake stays unclassified until synchronized.
    receive() external payable { emit NativeReceived(msg.sender, msg.value); }

    function setPlanningEnabled(bool enabled) external onlyOwner {
        planningEnabled = enabled;
        emit PlanningEnabled(enabled);
    }

    function setSupportedAsset(address token, bool supported) external onlyOwner {
        if (supported && token != PLS && token.code.length == 0) revert InvalidAsset();
        supportedAsset[token] = supported;
        emit AssetSupported(token, supported);
    }

    function setDestination(address recipient, Delivery delivery, bool approved) external onlyOwner {
        if (recipient == address(0) || recipient == address(this)) revert InvalidDestination();
        if (approved && delivery == Delivery.FarmReward && recipient.code.length == 0) revert InvalidDestination();
        approvedDestination[recipient][delivery] = approved;
        emit DestinationApproved(recipient, delivery, approved);
    }

    /// @notice Actual receipt is recorded; callers cannot assert that deposits are revenue.
    function deposit(address token, uint256 amount) external payable nonReentrant returns (uint256 received) {
        if (!supportedAsset[token]) revert InvalidAsset();
        if (amount == 0) revert InvalidAmount();
        uint256 beforeBalance;
        if (token == PLS) {
            if (msg.value != amount) revert InvalidAmount();
            beforeBalance = address(this).balance - msg.value;
            received = amount;
        } else {
            if (msg.value != 0) revert InvalidAmount();
            beforeBalance = _balance(token);
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
            uint256 afterBalance = _balance(token);
            if (afterBalance <= beforeBalance) revert InvalidAmount();
            received = afterBalance - beforeBalance;
        }
        if (beforeBalance < accountedBalance[token]) revert BalanceDeficit();
        _record(token, received);
        emit FundsRecorded(token, msg.sender, received, true);
    }

    /// @notice Permissionless reconciliation, including direct staking fees and donations.
    /// @dev The sender of an ERC20 direct transfer cannot be inferred from its balance delta.
    function sync(address token) external nonReentrant returns (uint256 received) {
        if (!supportedAsset[token]) revert InvalidAsset();
        uint256 balance = _balance(token);
        if (balance < accountedBalance[token]) revert BalanceDeficit();
        received = balance - accountedBalance[token];
        if (received == 0) return 0;
        _record(token, received);
        emit FundsRecorded(token, address(0), received, false);
    }

    function _record(address token, uint256 amount) private {
        accountedBalance[token] += amount;
        unallocated[token][Origin.Unclassified] += amount;
    }

    /// @notice An accounting attestation for available funds, never a new receipt.
    function classify(address token, uint256 amount, Origin origin, bytes32 referenceId) external onlyOwner {
        if (origin == Origin.Unclassified) revert InvalidOrigin();
        if (amount == 0) revert InvalidAmount();
        if (unallocated[token][Origin.Unclassified] < amount) revert InsufficientUnallocated();
        unallocated[token][Origin.Unclassified] -= amount;
        unallocated[token][origin] += amount;
        emit FundsClassified(token, origin, amount, referenceId);
    }

    /// @notice Snapshot a versioned, exact allocation. No default percentages or arbitrary calls.
    function createPlan(
        address token,
        Origin origin,
        bytes32 referenceId,
        address[] calldata recipients,
        uint256[] calldata amounts,
        Delivery[] calldata deliveries
    ) external onlyOwner nonReentrant returns (uint256 planId) {
        if (!planningEnabled) revert PlanningDisabled();
        if (!supportedAsset[token]) revert InvalidAsset();
        uint256 length = recipients.length;
        if (length == 0 || length > MAX_ALLOCATIONS || length != amounts.length || length != deliveries.length) revert InvalidPlan();
        if (_balance(token) < accountedBalance[token]) revert BalanceDeficit();
        uint256 total;
        planId = nextPlanId++;
        for (uint256 i; i < length; ++i) {
            if (!approvedDestination[recipients[i]][deliveries[i]]) revert InvalidDestination();
            if (deliveries[i] == Delivery.FarmReward && token == PLS) revert InvalidAsset();
            if (amounts[i] == 0) revert InvalidAmount();
            total += amounts[i];
            _allocations[planId].push(Allocation(recipients[i], amounts[i], deliveries[i], false));
            emit AllocationCreated(planId, i, recipients[i], amounts[i], deliveries[i]);
        }
        if (total > unallocated[token][origin]) revert InsufficientUnallocated();
        unallocated[token][origin] -= total;
        reservedBalance[token] += total;
        uint64 executableAt = uint64(block.timestamp + executionDelay);
        plans[planId] = Plan(token, origin, referenceId, total, total, executableAt, false);
        _emitPlanCreated(planId);
    }

    function _emitPlanCreated(uint256 planId) private {
        Plan storage plan = plans[planId];
        emit PlanCreated(planId, plan.token, plan.origin, plan.total, plan.executableAt, plan.referenceId);
    }

    /// @notice During the review delay only, release an incorrect plan back to its origin bucket.
    function cancelPlan(uint256 planId) external onlyOwner nonReentrant {
        Plan storage plan = plans[planId];
        if (plan.total == 0 || plan.canceled) revert InvalidPlan();
        if (block.timestamp >= plan.executableAt) revert CancellationClosed();
        plan.canceled = true;
        reservedBalance[plan.token] -= plan.remaining;
        unallocated[plan.token][plan.origin] += plan.remaining;
        plan.remaining = 0;
        emit PlanCanceled(planId);
    }

    /// @notice Anyone may deliver a single allocation to its fixed destination.
    /// @dev Disabling future plans/assets/destinations does not confiscate existing entitlements.
    function claim(uint256 planId, uint256 index) external nonReentrant returns (uint256 received) {
        Plan storage plan = plans[planId];
        if (plan.total == 0 || plan.canceled || index >= _allocations[planId].length) revert InvalidPlan();
        if (block.timestamp < plan.executableAt) revert NotExecutable();
        Allocation storage allocation = _allocations[planId][index];
        if (allocation.claimed) revert AlreadyClaimed();
        address token = plan.token;
        uint256 beforeBalance = _balance(token);
        if (beforeBalance < accountedBalance[token]) revert BalanceDeficit();
        allocation.claimed = true;
        plan.remaining -= allocation.amount;
        reservedBalance[token] -= allocation.amount;
        accountedBalance[token] -= allocation.amount;

        if (token == PLS) {
            (bool ok,) = allocation.recipient.call{value: allocation.amount}("");
            if (!ok) revert NativeTransferFailed();
            received = allocation.amount;
        } else if (allocation.delivery == Delivery.FarmReward) {
            IERC20(token).forceApprove(allocation.recipient, allocation.amount);
            received = IJackFarmRewardReceiver(allocation.recipient).depositReward(token, allocation.amount);
            IERC20(token).forceApprove(allocation.recipient, 0);
        } else {
            uint256 recipientBefore = IERC20(token).balanceOf(allocation.recipient);
            IERC20(token).safeTransfer(allocation.recipient, allocation.amount);
            uint256 recipientAfter = IERC20(token).balanceOf(allocation.recipient);
            if (recipientAfter < recipientBefore) revert UnsupportedTransferBehavior();
            received = recipientAfter - recipientBefore;
        }
        uint256 afterBalance = _balance(token);
        if (afterBalance > beforeBalance || beforeBalance - afterBalance != allocation.amount) revert UnsupportedTransferBehavior();
        emit AllocationPaid(planId, index, allocation.recipient, allocation.amount, received);
    }

    function allocationCount(uint256 planId) external view returns (uint256) { return _allocations[planId].length; }
    function getAllocation(uint256 planId, uint256 index) external view returns (Allocation memory) { return _allocations[planId][index]; }
    function actualBalance(address token) external view returns (uint256) { return _balance(token); }
    function _balance(address token) private view returns (uint256) {
        return token == PLS ? address(this).balance : IERC20(token).balanceOf(address(this));
    }
}
