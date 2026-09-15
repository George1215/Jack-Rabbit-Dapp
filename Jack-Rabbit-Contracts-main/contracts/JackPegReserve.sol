// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IPegRevenueReceiver { function sync(address token) external returns (uint256); }

/// @notice Isolated protocol capital. No trading, minting, user claims or Runner spending authority.
contract JackPegReserve is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public immutable revenueDistributor;
    uint64 public immutable returnDelay;
    bool public constant tradingEnabled = false;
    mapping(address => bool) public supportedAsset;
    mapping(address => uint256) public accountedBalance;
    mapping(address => uint256) public reservedBalance;
    struct ReturnPlan { address token; uint256 amount; uint256 executableAt; bool completed; }
    ReturnPlan[] public returnPlans;
    event AssetConfigured(address indexed token, bool enabled);
    event CapitalRecognized(address indexed token, uint256 amount);
    event ReturnQueued(uint256 indexed id, address indexed token, uint256 amount, uint256 executableAt);
    event ReturnCancelled(uint256 indexed id);
    event CapitalReturned(uint256 indexed id, uint256 received);
    event NativeReceived(address indexed sender, uint256 amount);

    constructor(address owner_, address distributor_, uint64 delay_) Ownable(owner_) {
        require(distributor_.code.length > 0 && delay_ > 0 && delay_ <= 30 days, "Invalid configuration");
        revenueDistributor = distributor_;
        returnDelay = delay_;
    }
    receive() external payable { emit NativeReceived(msg.sender, msg.value); }
    function setSupportedAsset(address token, bool enabled) external onlyOwner {
        require(token == address(0) || token.code.length > 0, "Invalid asset");
        supportedAsset[token] = enabled;
        emit AssetConfigured(token, enabled);
    }
    function balance(address token) public view returns (uint256) {
        return token == address(0) ? address(this).balance : IERC20(token).balanceOf(address(this));
    }
    function sync(address token) external nonReentrant returns (uint256 amount) {
        require(supportedAsset[token], "Unsupported asset");
        uint256 actual = balance(token);
        require(actual >= accountedBalance[token], "Capital deficit");
        amount = actual - accountedBalance[token];
        accountedBalance[token] = actual;
        if (amount > 0) emit CapitalRecognized(token, amount);
    }
    function queueReturn(address token, uint256 amount) external onlyOwner nonReentrant returns (uint256 id) {
        require(amount > 0 && balance(token) >= accountedBalance[token], "Invalid capital");
        require(amount <= accountedBalance[token] - reservedBalance[token], "Insufficient capital");
        reservedBalance[token] += amount;
        id = returnPlans.length;
        returnPlans.push(ReturnPlan(token, amount, block.timestamp + returnDelay, false));
        emit ReturnQueued(id, token, amount, block.timestamp + returnDelay);
    }
    function cancelReturn(uint256 id) external onlyOwner nonReentrant {
        ReturnPlan storage plan = returnPlans[id];
        require(!plan.completed && block.timestamp < plan.executableAt, "Not cancellable");
        plan.completed = true;
        reservedBalance[plan.token] -= plan.amount;
        emit ReturnCancelled(id);
    }
    function executeReturn(uint256 id) external nonReentrant {
        ReturnPlan storage plan = returnPlans[id];
        require(!plan.completed && block.timestamp >= plan.executableAt, "Not executable");
        uint256 beforeBalance = balance(plan.token);
        require(beforeBalance >= accountedBalance[plan.token], "Capital deficit");
        plan.completed = true;
        reservedBalance[plan.token] -= plan.amount;
        accountedBalance[plan.token] -= plan.amount;
        uint256 received;
        if (plan.token == address(0)) {
            (bool ok,) = revenueDistributor.call{value: plan.amount}("");
            require(ok, "Return failed");
            received = plan.amount;
        } else {
            IERC20 token = IERC20(plan.token);
            uint256 beforeRecipient = token.balanceOf(revenueDistributor);
            token.safeTransfer(revenueDistributor, plan.amount);
            received = token.balanceOf(revenueDistributor) - beforeRecipient;
        }
        require(beforeBalance - balance(plan.token) == plan.amount, "Unexpected debit");
        IPegRevenueReceiver(revenueDistributor).sync(plan.token);
        emit CapitalReturned(id, received);
    }
}
