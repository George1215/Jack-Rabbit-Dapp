// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IJackOracleHub} from "./interfaces/IJackOracleHub.sol";

/// @notice Permissionless oracle maintenance paid only from donated operating PLS.
/// @dev This contract has no trading or peg reserve access. No operator bond is required.
contract JackRunner is Ownable2Step, ReentrancyGuard {
    IJackOracleHub public immutable oracle;
    bool public enabled;
    uint256 public dailyRewardCap;
    uint256 public totalRewardCredits;
    mapping(address => uint256) public rewardCredits;
    mapping(uint256 => uint256) public dailySpent;
    struct Job { bool enabled; uint256 reward; uint256 interval; uint256 lastExecution; }
    mapping(address => Job) public jobs;
    event OperatingBudgetFunded(address indexed sender, uint256 amount);
    event SettingsChanged(bool enabled, uint256 dailyCap);
    event JobConfigured(address indexed pair, bool enabled, uint256 reward, uint256 interval);
    event OracleMaintained(address indexed pair, address indexed operator, uint256 reward);
    event RewardClaimed(address indexed operator, address indexed recipient, uint256 amount);

    constructor(address owner_, address oracle_) Ownable(owner_) {
        require(oracle_.code.length > 0, "Invalid oracle");
        oracle = IJackOracleHub(oracle_);
    }
    receive() external payable { emit OperatingBudgetFunded(msg.sender, msg.value); }
    function availableBudget() public view returns (uint256) { return address(this).balance - totalRewardCredits; }
    function configure(bool enabled_, uint256 dailyCap_) external onlyOwner {
        enabled = enabled_;
        dailyRewardCap = dailyCap_;
        emit SettingsChanged(enabled_, dailyCap_);
    }
    function configureJob(address pair, bool enabled_, uint256 reward, uint256 interval) external onlyOwner {
        require(interval > 0, "Zero interval");
        IJackOracleHub.PairHealth memory health = oracle.getPairHealth(pair);
        require(health.exists, "Unknown pair");
        Job storage job = jobs[pair];
        job.enabled = enabled_;
        job.reward = reward;
        job.interval = interval;
        // Configuration must never reset the pair's cooldown or the daily spend.
        emit JobConfigured(pair, enabled_, reward, interval);
    }
    /// @param minimumReward Use zero to explicitly permit unpaid work if the budget/cap is exhausted.
    function maintainOracle(address pair, uint256 minimumReward, uint256 deadline) external nonReentrant {
        Job storage job = jobs[pair];
        require(enabled && job.enabled && block.timestamp <= deadline, "Unavailable");
        IJackOracleHub.PairHealth memory beforeHealth = oracle.getPairHealth(pair);
        require(beforeHealth.exists && beforeHealth.enabled && beforeHealth.reservesOk && beforeHealth.canUpdateNow, "Not due");
        uint256 last = job.lastExecution > beforeHealth.lastSuccessfulUpdate ? job.lastExecution : beforeHealth.lastSuccessfulUpdate;
        require(block.timestamp >= last + job.interval, "Cooldown");
        uint256 day = block.timestamp / 1 days;
        uint256 spent = dailySpent[day];
        uint256 reward = job.reward;
        if (reward > availableBudget() || spent > dailyRewardCap || reward > dailyRewardCap - spent) reward = 0;
        require(reward >= minimumReward, "Reward unavailable");
        require(oracle.updatePairIfNeeded(pair), "No progress");
        IJackOracleHub.PairHealth memory afterHealth = oracle.getPairHealth(pair);
        require(afterHealth.ready && !afterHealth.stale && afterHealth.reservesOk && afterHealth.enabled &&
            afterHealth.lastSuccessfulUpdate > beforeHealth.lastSuccessfulUpdate &&
            afterHealth.lastSuccessfulUpdate == block.timestamp, "Invalid update");
        job.lastExecution = block.timestamp;
        dailySpent[day] = spent + reward;
        totalRewardCredits += reward;
        rewardCredits[msg.sender] += reward;
        emit OracleMaintained(pair, msg.sender, reward);
    }
    function claimReward(address payable recipient) external nonReentrant {
        require(recipient != address(0) && recipient != address(this), "Invalid recipient");
        uint256 amount = rewardCredits[msg.sender];
        require(amount > 0, "No reward");
        rewardCredits[msg.sender] = 0;
        totalRewardCredits -= amount;
        (bool ok,) = recipient.call{value: amount}("");
        require(ok, "Payment failed");
        emit RewardClaimed(msg.sender, recipient, amount);
    }
}
