// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IJack.sol";
import "./interfaces/IJackTreasury.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract JackStake is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ========= Constants =========
    uint256 public constant BP_DIVISOR = 1000;
    uint256 public constant ACC_PRECISION = 1e24;
    uint256 public constant PPM_DIVISOR = 1_000_000;
    uint256 public constant MAX_EMISSION_PPM = 1_000_000;
    uint256 public constant DEFAULT_EMISSION_PPM = 140;
    uint256 public constant DAY = 1 days;

    uint256 public constant JACK_STAKE_TOTAL_FEE_BP = 50;
    uint256 public constant JACK_STAKE_TREASURY_FEE_BP = 25;
    uint256 public constant JACK_STAKE_SINK_FEE_BP = 25;

    uint256 public constant MIN_REWARD_FEE_BP = 100; // 10%
    uint256 public constant MAX_REWARD_FEE_BP = 900; // 90%

    uint256 public constant DEFAULT_JACK_REWARD_FEE_BP = 200; // 20%
    uint256 public constant DEFAULT_EXTERNAL_REWARD_FEE_BP = 100; // 10%

    address public constant PLS = address(0);

    // ========= Core Contracts =========
    IJackTreasury public treasury;
    IJack public jack;

    // ========= Global JACK reserve for external stakers =========
    uint256 public externalJackRewardReserve;
    uint256 public lastExternalRewardUpdate;

    // ========= Fee Recipients =========

    // Receives fee taken from JACK rewards before JACK is split among external pools.
    address public jackFeeRewardRecipient;

    // Receives fee taken from external-token rewards before JACK stakers receive them.
    address public externalFeeRewardRecipient;

    // Legacy alias for old UI compatibility.
    // This always follows externalFeeRewardRecipient.
    address public adminFeeRecipient;

    // Where the 2.5% JACK staking sink fee goes.
    address public jackFeeSink;

    // ========= Reward Fee Percentages =========

    // Fee taken from JACK rewards before external stakers receive JACK.
    // Default: 20%.
    uint256 public jackRewardFeeBp = DEFAULT_JACK_REWARD_FEE_BP;

    // Fee taken from external-token rewards before JACK stakers receive external rewards.
    // Default: 10%.
    uint256 public externalRewardFeeBp = DEFAULT_EXTERNAL_REWARD_FEE_BP;

    // ========= Internal Balance Tracking =========

    // Tracks funds that are already accounted for as:
    // user stake, reward reserve, emitted/unclaimed rewards, stored pending rewards, etc.
    //
    // syncRewardToken() only syncs:
    // actual balance - trackedBalance[token]
    mapping(address => uint256) public trackedBalance;

    // ========= Pool Structs =========
    struct ExternalPool {
        IERC20 stakeToken;
    }

    struct JackPool {
        uint256 totalStaked;
        mapping(address => uint256) userStake;
    }

    struct ExtUser {
        uint256 amount;
        uint256 rewardDebt;
    }

    struct ExtPoolState {
        uint256 totalStaked;
        uint256 accJackPerShare;
        mapping(address => ExtUser) user;
    }

    mapping(address => mapping(uint256 => ExtPoolState)) private _extPool;

    struct RewardStream {
        uint256 accRewardPerShare;
        uint256 lastUpdate;
        uint256 reserve;
    }

    mapping(address => RewardStream) private _rewardStream;
    mapping(address => mapping(address => uint256)) public jackRewardDebt;

    mapping(address => mapping(address => uint256)) public storedPendingJack;
    mapping(address => mapping(address => uint256)) public storedPendingExternalReward;

    JackPool public jackPool;

    address[] public externalPoolList;
    mapping(address => ExternalPool) private _externalPools;
    mapping(address => bool) public isExternalPool;
    mapping(address => bool) public isExternalPoolActive;

    address[] public rewardTokens;
    mapping(address => bool) public isRewardToken;
    mapping(address => bool) public isRewardTokenActive;
    mapping(address => bool) public isRemovedToken;

    mapping(address => uint256) public emissionRatePpm;
    mapping(address => uint256) public poolEpoch;

    // ========= Events =========
    event ExternalDeposit(address indexed user, address indexed token, uint256 amount);
    event ExternalWithdraw(address indexed user, address indexed token, uint256 amount);
    event ExternalClaim(address indexed user, address indexed token, uint256 amount);

    event JackDeposit(address indexed user, uint256 amount);
    event JackWithdraw(address indexed user, uint256 amount);

    event JackRewardInjected(address indexed injector, address indexed token, uint256 amount);
    event JackRewardClaimed(address indexed user, address indexed token, uint256 amount);

    event PendingJackStored(address indexed user, address indexed poolToken, uint256 amount);
    event PendingExternalRewardStored(address indexed user, address indexed rewardToken, uint256 amount);

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event AdminFeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event JackFeeRewardRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event ExternalFeeRewardRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event RewardFeeBpsUpdated(
        uint256 oldJackRewardFeeBp,
        uint256 newJackRewardFeeBp,
        uint256 oldExternalRewardFeeBp,
        uint256 newExternalRewardFeeBp
    );

    event RewardFeeSent(address indexed token, address indexed recipient, uint256 amount, bool indexed isJackRewardFee);

    event RewardTokenRemoved(address indexed token);
    event RewardTokenStatusUpdated(address indexed token, bool isActive);

    event JackFeeSinkUpdated(address indexed oldSink, address indexed newSink);

    event ExternalPoolAdded(address indexed token, uint256 epoch);
    event ExternalPoolStatusUpdated(address indexed token, bool isActive);
    event ExternalPoolDelisted(address indexed token, uint256 sweptToTreasury, uint256 newEpoch);

    event EmissionRateUpdated(address indexed token, uint256 oldPpm, uint256 newPpm);
    event ExternalRewardsUpdated(uint256 emitted, uint256 fee, uint256 netEmitted, uint256 activePools, uint256 remainingReserve);
    event JackRewardTokenUpdated(address indexed rewardToken, uint256 emitted, uint256 fee, uint256 remainingReserve);

    event ExternalJackRewardReserveWithdrawn(address indexed to, uint256 amount);
    event JackStakerRewardReserveWithdrawn(address indexed token, address indexed to, uint256 amount);

    event RewardTokenSynced(address indexed token, uint256 amountSynced);

    constructor(
        IJack _jack,
        IJackTreasury _treasury,
        address _jackMiningFeeSink,
        address _jackFeeRewardRecipient,
        address _externalFeeRewardRecipient
    ) Ownable(msg.sender) {
        require(address(_jack) != address(0), "jack=0");
        require(address(_treasury) != address(0), "treasury=0");
        require(_jackMiningFeeSink != address(0), "mining sink=0");
        require(_jackFeeRewardRecipient != address(0), "jack fee recipient=0");
        require(_externalFeeRewardRecipient != address(0), "external fee recipient=0");

        jack = _jack;
        treasury = _treasury;
        jackFeeSink = _jackMiningFeeSink;

        jackFeeRewardRecipient = _jackFeeRewardRecipient;
        externalFeeRewardRecipient = _externalFeeRewardRecipient;
        adminFeeRecipient = _externalFeeRewardRecipient;

        emissionRatePpm[address(jack)] = DEFAULT_EMISSION_PPM;
    }

    // Direct/native PLS can enter the contract.
    // It is NOT counted as rewards until syncRewardToken(PLS) is called.
    receive() external payable {}

    // ========= Internal Transfer Helpers =========

    function _safeSendPLS(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "PLS transfer failed");
    }

    function _rawSendToken(address token, address to, uint256 amount) internal {
        if (amount == 0) return;

        if (token == PLS) {
            _safeSendPLS(to, amount);
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    function _sendTrackedToken(address token, address to, uint256 amount) internal {
        if (amount == 0) return;

        _decreaseTracked(token, amount);
        _rawSendToken(token, to, amount);
    }

    function _increaseTracked(address token, uint256 amount) internal {
        if (amount == 0) return;
        trackedBalance[token] += amount;
    }

    function _decreaseTracked(address token, uint256 amount) internal {
        if (amount == 0) return;
        require(trackedBalance[token] >= amount, "tracked low");
        trackedBalance[token] -= amount;
    }

    function _actualBalance(address token) internal view returns (uint256) {
        if (token == PLS) {
            return address(this).balance;
        }

        return IERC20(token).balanceOf(address(this));
    }

    function getSyncableRewardAmount(address token) public view returns (uint256) {
        if (!_isSyncSupportedToken(token)) {
            return 0;
        }

        uint256 actual = _actualBalance(token);
        uint256 tracked = trackedBalance[token];

        return actual > tracked ? actual - tracked : 0;
    }

    function _isSyncSupportedToken(address token) internal view returns (bool) {
        if (token == address(jack)) {
            return true;
        }

        return isRewardToken[token];
    }

    function _pullJackNet(address from, uint256 amount) internal returns (uint256 netReceived) {
        uint256 beforeBal = IERC20(address(jack)).balanceOf(address(this));
        IERC20(address(jack)).safeTransferFrom(from, address(this), amount);
        uint256 afterBal = IERC20(address(jack)).balanceOf(address(this));

        netReceived = afterBal - beforeBal;
        if (netReceived > 0) {
            _increaseTracked(address(jack), netReceived);
        }
    }

    function _pullTokenNet(address token, address from, uint256 amount) internal returns (uint256 netReceived) {
        uint256 beforeBal = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(from, address(this), amount);
        uint256 afterBal = IERC20(token).balanceOf(address(this));

        netReceived = afterBal - beforeBal;
        if (netReceived > 0) {
            _increaseTracked(token, netReceived);
        }
    }

    function _depositTrackedToTreasury(address token, uint256 amount) internal {
        if (amount == 0) return;

        _decreaseTracked(token, amount);

        if (token == PLS) {
            treasury.receiveFunds{value: amount}(PLS, amount);
        } else {
            IERC20 erc = IERC20(token);
            erc.forceApprove(address(treasury), amount);
            treasury.receiveFunds(token, amount);
        }
    }

    // ========= Admin Pause =========

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ========= Treasury / Fee Config =========

    function setTreasury(IJackTreasury _newTreasury) external onlyOwner {
        require(address(_newTreasury) != address(0), "Invalid treasury");

        address oldTreasury = address(treasury);
        treasury = _newTreasury;

        if (jackFeeSink == oldTreasury) {
            emit JackFeeSinkUpdated(jackFeeSink, address(_newTreasury));
            jackFeeSink = address(_newTreasury);
        }

        emit TreasuryUpdated(oldTreasury, address(_newTreasury));
    }

    function setJackFeeSink(address _sink) external onlyOwner {
        require(_sink != address(0), "sink=0");
        emit JackFeeSinkUpdated(jackFeeSink, _sink);
        jackFeeSink = _sink;
    }

    function setJackFeeRewardRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "recipient=0");
        emit JackFeeRewardRecipientUpdated(jackFeeRewardRecipient, _recipient);
        jackFeeRewardRecipient = _recipient;
    }

    function setExternalFeeRewardRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "recipient=0");

        emit ExternalFeeRewardRecipientUpdated(externalFeeRewardRecipient, _recipient);
        emit AdminFeeRecipientUpdated(adminFeeRecipient, _recipient);

        externalFeeRewardRecipient = _recipient;
        adminFeeRecipient = _recipient;
    }

    // Legacy setter. It now updates externalFeeRewardRecipient.
    function setAdminFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Invalid recipient");

        emit ExternalFeeRewardRecipientUpdated(externalFeeRewardRecipient, _recipient);
        emit AdminFeeRecipientUpdated(adminFeeRecipient, _recipient);

        externalFeeRewardRecipient = _recipient;
        adminFeeRecipient = _recipient;
    }

    function setRewardFeeBps(uint256 newJackRewardFeeBp, uint256 newExternalRewardFeeBp) external onlyOwner nonReentrant {
        _requireValidRewardFee(newJackRewardFeeBp);
        _requireValidRewardFee(newExternalRewardFeeBp);

        _updateAllExternalPools();
        lastExternalRewardUpdate = block.timestamp;
        _settleJackRewardFees();

        emit RewardFeeBpsUpdated(
            jackRewardFeeBp,
            newJackRewardFeeBp,
            externalRewardFeeBp,
            newExternalRewardFeeBp
        );

        jackRewardFeeBp = newJackRewardFeeBp;
        externalRewardFeeBp = newExternalRewardFeeBp;
    }

    function setJackRewardFeeBp(uint256 newFeeBp) external onlyOwner nonReentrant {
        _requireValidRewardFee(newFeeBp);

        _updateAllExternalPools();
        lastExternalRewardUpdate = block.timestamp;

        emit RewardFeeBpsUpdated(
            jackRewardFeeBp,
            newFeeBp,
            externalRewardFeeBp,
            externalRewardFeeBp
        );

        jackRewardFeeBp = newFeeBp;
    }

    function setExternalRewardFeeBp(uint256 newFeeBp) external onlyOwner nonReentrant {
        _requireValidRewardFee(newFeeBp);

        _settleJackRewardFees();

        emit RewardFeeBpsUpdated(
            jackRewardFeeBp,
            jackRewardFeeBp,
            externalRewardFeeBp,
            newFeeBp
        );

        externalRewardFeeBp = newFeeBp;
    }

    function _requireValidRewardFee(uint256 feeBp) internal pure {
        require(feeBp >= MIN_REWARD_FEE_BP, "fee < 10%");
        require(feeBp <= MAX_REWARD_FEE_BP, "fee > 90%");
    }

    // Settle every stream at the old rate before changing the global fee.
    function _settleJackRewardFees() internal {
        for (uint256 i = 0; i < rewardTokens.length; ++i) {
            _updateJackRewardToken(rewardTokens[i]);
            // Even a zero-rounded emission must not carry old-rate time forward.
            _rewardStream[rewardTokens[i]].lastUpdate = block.timestamp;
        }
    }

    // ========= Emission Config =========

    function setEmissionRatePpm(address token, uint256 newPpm) external onlyOwner nonReentrant {
        require(newPpm <= MAX_EMISSION_PPM, "ppm > 100%");
        require(token == address(jack) || token == PLS || isRewardToken[token], "token not allowed");

        if (token == address(jack)) {
            _updateAllExternalPools();
        } else if (isRewardToken[token]) {
            _updateJackRewardToken(token);
        }

        uint256 old = emissionRatePpm[token];
        emissionRatePpm[token] = newPpm;
        emit EmissionRateUpdated(token, old, newPpm);
    }

    // ========= External Pool Management =========

    function addPool(address[] calldata tokens) external onlyOwner nonReentrant {
        _updateAllExternalPools();

        for (uint256 i = 0; i < tokens.length; i++) {
            address t = tokens[i];
            require(t != address(jack), "use stakeJackToken");
            require(!isExternalPool[t], "Pool exists");

            if (poolEpoch[t] == 0) poolEpoch[t] = 1;

            externalPoolList.push(t);
            ExternalPool storage p = _externalPools[t];

            if (t != PLS) {
                require(t != address(0), "token=0");
                p.stakeToken = IERC20(t);
            }

            isExternalPool[t] = true;
            isExternalPoolActive[t] = true;

            if (!isRewardToken[t]) {
                rewardTokens.push(t);
                isRewardToken[t] = true;
            }

            isRewardTokenActive[t] = true;
            isRemovedToken[t] = false;

            if (emissionRatePpm[t] == 0) {
                emissionRatePpm[t] = DEFAULT_EMISSION_PPM;
                emit EmissionRateUpdated(t, 0, DEFAULT_EMISSION_PPM);
            }

            emit ExternalPoolAdded(t, poolEpoch[t]);
            emit ExternalPoolStatusUpdated(t, true);
            emit RewardTokenStatusUpdated(t, true);
        }
    }

    function endExternalPool(address token) external onlyOwner nonReentrant {
        require(isExternalPool[token], "Not a pool");
        _updateAllExternalPools();
        isExternalPoolActive[token] = false;
        emit ExternalPoolStatusUpdated(token, false);
    }

    function setExternalPoolActive(address token, bool active) external onlyOwner nonReentrant {
        require(isExternalPool[token], "Not a pool");
        _updateAllExternalPools();
        isExternalPoolActive[token] = active;
        emit ExternalPoolStatusUpdated(token, active);
    }

    function delistExternalPool(address token) external onlyOwner nonReentrant {
        require(isExternalPool[token], "Not a pool");
        require(!isExternalPoolActive[token], "Pool must be inactive first");

        _updateAllExternalPools();

        uint256 e = poolEpoch[token];
        if (e == 0) {
            poolEpoch[token] = 1;
            e = 1;
        }

        ExtPoolState storage ps = _extPool[token][e];
        require(ps.totalStaked == 0, "Users still staked");

        uint256 n = externalPoolList.length;
        for (uint256 i = 0; i < n; i++) {
            if (externalPoolList[i] == token) {
                if (i != n - 1) externalPoolList[i] = externalPoolList[n - 1];
                externalPoolList.pop();
                break;
            }
        }

        isExternalPool[token] = false;
        isExternalPoolActive[token] = false;
        poolEpoch[token] = e + 1;

        emit ExternalPoolDelisted(token, 0, poolEpoch[token]);
    }

    // ========= Reward Token Management =========

    function removeAsRewardToken(address token) external onlyOwner nonReentrant {
        require(isRewardToken[token], "Token not listed");

        _updateJackRewardToken(token);

        isRewardTokenActive[token] = false;
        isRemovedToken[token] = true;

        emit RewardTokenStatusUpdated(token, false);
        emit RewardTokenRemoved(token);
    }

    function addBackAsRewardToken(address token) external onlyOwner {
        require(isRewardToken[token], "Token not listed");

        isRewardTokenActive[token] = true;
        isRemovedToken[token] = false;
        _rewardStream[token].lastUpdate = block.timestamp;

        if (emissionRatePpm[token] == 0) {
            emissionRatePpm[token] = DEFAULT_EMISSION_PPM;
            emit EmissionRateUpdated(token, 0, DEFAULT_EMISSION_PPM);
        }

        emit RewardTokenStatusUpdated(token, true);
    }

    // ========= External Staking: stake external token -> earn JACK =========

    function stakeExternalToken(address token, uint256 amount)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        require(isExternalPool[token], "Pool not found");
        require(isExternalPoolActive[token], "Pool not active");
        require(amount > 0, "Invalid amount");

        _updateAllExternalPools();

        uint256 received;

        if (token == PLS) {
            require(msg.value >= amount, "Insufficient PLS sent");
            received = amount;
            _increaseTracked(PLS, received);
        } else {
            received = _pullTokenNet(token, msg.sender, amount);
            require(received > 0, "No tokens received");
        }

        uint256 fee = (received * 5) / 100;
        uint256 treasuryAmt = fee / 2;
        uint256 poolReward = fee - treasuryAmt;
        uint256 net = received - fee;

        if (poolReward > 0) {
            _updateJackRewardToken(token);
            _rewardStream[token].reserve += poolReward;
        }

        if (treasuryAmt > 0) {
            _depositTrackedToTreasury(token, treasuryAmt);
        }

        if (token == PLS) {
            uint256 excess = msg.value - amount;
            if (excess > 0) _safeSendPLS(msg.sender, excess);
        }

        uint256 e = poolEpoch[token];
        if (e == 0) {
            poolEpoch[token] = 1;
            e = 1;
        }

        ExtPoolState storage ps = _extPool[token][e];
        ExtUser storage u = ps.user[msg.sender];

        if (u.amount > 0) {
            uint256 pending = ((u.amount * ps.accJackPerShare) / ACC_PRECISION) - u.rewardDebt;
            if (pending > 0) {
                _sendTrackedToken(address(jack), msg.sender, pending);
                emit ExternalClaim(msg.sender, token, pending);
            }
        }

        u.amount += net;
        ps.totalStaked += net;
        u.rewardDebt = (u.amount * ps.accJackPerShare) / ACC_PRECISION;

        emit ExternalDeposit(msg.sender, token, net);
    }

    function unstakeExternalToken(address token, uint256 amount)
        external
        nonReentrant
    {
        require(isExternalPool[token] || poolEpoch[token] != 0, "Pool not found");
        require(amount > 0, "Invalid amount");

        _updateAllExternalPools();

        uint256 e = poolEpoch[token];
        require(e != 0, "Pool epoch missing");

        ExtPoolState storage ps = _extPool[token][e];
        ExtUser storage u = ps.user[msg.sender];
        require(u.amount >= amount, "Insufficient stake");

        uint256 accrued = (u.amount * ps.accJackPerShare) / ACC_PRECISION;
        uint256 pending = accrued - u.rewardDebt;

        if (pending > 0) {
            if (paused()) {
                storedPendingJack[token][msg.sender] += pending;
                emit PendingJackStored(msg.sender, token, pending);
            } else {
                _sendTrackedToken(address(jack), msg.sender, pending);
                emit ExternalClaim(msg.sender, token, pending);
            }
        }

        u.amount -= amount;
        ps.totalStaked -= amount;
        u.rewardDebt = (u.amount * ps.accJackPerShare) / ACC_PRECISION;

        _sendTrackedToken(token, msg.sender, amount);

        emit ExternalWithdraw(msg.sender, token, amount);
    }

    function claimJackAsReward(address token)
        external
        nonReentrant
        whenNotPaused
    {
        require(poolEpoch[token] != 0, "Pool unknown");

        _updateAllExternalPools();

        uint256 e = poolEpoch[token];
        ExtPoolState storage ps = _extPool[token][e];
        ExtUser storage u = ps.user[msg.sender];

        uint256 pending = storedPendingJack[token][msg.sender];
        if (pending > 0) {
            storedPendingJack[token][msg.sender] = 0;
        }

        if (u.amount > 0) {
            uint256 accrued = (u.amount * ps.accJackPerShare) / ACC_PRECISION;
            uint256 currentPending = accrued - u.rewardDebt;
            pending += currentPending;
            u.rewardDebt = accrued;
        }

        require(pending > 0, "No rewards");

        _sendTrackedToken(address(jack), msg.sender, pending);
        emit ExternalClaim(msg.sender, token, pending);
    }

    // ========= JACK Staking: stake JACK -> earn external tokens =========

    function stakeJackToken(uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        require(amount > 0, "amount=0");

        uint256 received = _pullJackNet(msg.sender, amount);
        require(received > 0, "No JACK received");

        uint256 fee = (received * JACK_STAKE_TOTAL_FEE_BP) / BP_DIVISOR;
        uint256 sinkAmt = (received * JACK_STAKE_SINK_FEE_BP) / BP_DIVISOR;
        uint256 treasuryAmt = (received * JACK_STAKE_TREASURY_FEE_BP) / BP_DIVISOR;

        if (sinkAmt + treasuryAmt > fee) {
            treasuryAmt = fee - sinkAmt;
        }

        uint256 net = received - fee;

        if (sinkAmt > 0) {
            require(jackFeeSink != address(0), "sink unset");

            if (jackFeeSink == address(treasury)) {
                _depositTrackedToTreasury(address(jack), sinkAmt);
            } else {
                _sendTrackedToken(address(jack), jackFeeSink, sinkAmt);
            }
        }

        if (treasuryAmt > 0) {
            _depositTrackedToTreasury(address(jack), treasuryAmt);
        }

        uint256 oldStake = jackPool.userStake[msg.sender];
        uint256 newStake = oldStake + net;

        _settleJackStakerRewards(msg.sender, oldStake, newStake, true);

        jackPool.userStake[msg.sender] = newStake;
        jackPool.totalStaked += net;

        emit JackDeposit(msg.sender, net);
    }

    function unstakeJackToken(uint256 amount)
        external
        nonReentrant
    {
        require(amount > 0, "amount=0");

        uint256 oldStake = jackPool.userStake[msg.sender];
        require(oldStake >= amount, "insuff");
        uint256 newStake = oldStake - amount;

        _settleJackStakerRewards(msg.sender, oldStake, newStake, !paused());

        jackPool.userStake[msg.sender] = newStake;
        jackPool.totalStaked -= amount;

        _sendTrackedToken(address(jack), msg.sender, amount);
        emit JackWithdraw(msg.sender, amount);
    }

    function _settleJackStakerRewards(
        address user,
        uint256 oldStake,
        uint256 newStake,
        bool payNow
    ) internal {
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address rt = rewardTokens[i];
            if (!isRewardToken[rt]) continue;

            _updateJackRewardToken(rt);

            RewardStream storage s = _rewardStream[rt];
            uint256 pending = storedPendingExternalReward[user][rt];

            if (oldStake > 0) {
                uint256 accrued = (oldStake * s.accRewardPerShare) / ACC_PRECISION;
                uint256 currentPending = accrued - jackRewardDebt[user][rt];
                pending += currentPending;
            }

            if (pending > 0) {
                if (payNow) {
                    storedPendingExternalReward[user][rt] = 0;
                    _sendTrackedToken(rt, user, pending);
                    emit JackRewardClaimed(user, rt, pending);
                } else {
                    storedPendingExternalReward[user][rt] = pending;
                    emit PendingExternalRewardStored(user, rt, pending);
                }
            }

            jackRewardDebt[user][rt] = (newStake * s.accRewardPerShare) / ACC_PRECISION;
        }
    }

    // ========= Reward Injections =========

    function injectJackStakersReward(address token, uint256 amount)
        external
        payable
        nonReentrant
    {
        require(isRewardToken[token], "invalid reward token");
        require(amount > 0, "Invalid amount");

        _updateJackRewardToken(token);

        uint256 received;

        if (token == PLS) {
            require(msg.value == amount, "Incorrect PLS sent");
            received = amount;
            _increaseTracked(PLS, received);
        } else {
            received = _pullTokenNet(token, msg.sender, amount);
            require(received > 0, "No tokens received");
        }

        _rewardStream[token].reserve += received;

        emit JackRewardInjected(msg.sender, token, received);
    }

    function injectExternalStakersReward(uint256 amount)
        external
        nonReentrant
    {
        require(amount > 0, "Zero amount");

        _updateAllExternalPools();

        uint256 received = _pullJackNet(msg.sender, amount);
        require(received > 0, "No JACK received");

        externalJackRewardReserve += received;

        emit JackRewardInjected(msg.sender, address(jack), received);
    }

    function syncRewardToken(address token)
        external
        nonReentrant
        returns (uint256 amountSynced)
    {
        if (!_isSyncSupportedToken(token)) {
            return 0;
        }

        amountSynced = getSyncableRewardAmount(token);
        if (amountSynced == 0) {
            return 0;
        }

        _increaseTracked(token, amountSynced);

        if (token == address(jack)) {
            _updateAllExternalPools();
            externalJackRewardReserve += amountSynced;
        } else {
            _updateJackRewardToken(token);
            _rewardStream[token].reserve += amountSynced;
        }

        emit RewardTokenSynced(token, amountSynced);
        return amountSynced;
    }

    function claimExternalTokenAsReward(address rewardToken)
        external
        nonReentrant
        whenNotPaused
    {
        require(isRewardToken[rewardToken], "invalid reward token");

        _updateJackRewardToken(rewardToken);

        uint256 stakeAmt = jackPool.userStake[msg.sender];
        uint256 pending = storedPendingExternalReward[msg.sender][rewardToken];

        if (pending > 0) {
            storedPendingExternalReward[msg.sender][rewardToken] = 0;
        }

        if (stakeAmt > 0) {
            RewardStream storage s = _rewardStream[rewardToken];
            uint256 accrued = (stakeAmt * s.accRewardPerShare) / ACC_PRECISION;
            uint256 currentPending = accrued - jackRewardDebt[msg.sender][rewardToken];
            pending += currentPending;
            jackRewardDebt[msg.sender][rewardToken] = accrued;
        }

        require(pending > 0, "No rewards");

        _sendTrackedToken(rewardToken, msg.sender, pending);
        emit JackRewardClaimed(msg.sender, rewardToken, pending);
    }

    // ========= On-chain update / keeper functions =========

    function updateExternalPool(address token) external nonReentrant {
        require(isExternalPool[token] || poolEpoch[token] != 0, "not pool");
        _updateAllExternalPools();
    }

    function updateJackRewardToken(address token) external nonReentrant {
        require(isRewardToken[token], "not reward token");
        _updateJackRewardToken(token);
    }

    function updateManyExternalPools(address[] calldata tokens) external nonReentrant {
        for (uint256 i = 0; i < tokens.length; i++) {
            require(isExternalPool[tokens[i]] || poolEpoch[tokens[i]] != 0, "not pool");
        }

        _updateAllExternalPools();
    }

    function updateManyJackRewardTokens(address[] calldata tokens) external nonReentrant {
        for (uint256 i = 0; i < tokens.length; i++) {
            if (isRewardToken[tokens[i]]) {
                _updateJackRewardToken(tokens[i]);
            }
        }
    }

    // ========= Safer Reserve Withdrawals =========

    function withdrawExternalJackRewardReserve(uint256 amount, address to)
        external
        onlyOwner
        nonReentrant
    {
        require(to != address(0), "to=0");

        _updateAllExternalPools();

        require(externalJackRewardReserve >= amount, "amount > reserve");

        externalJackRewardReserve -= amount;
        _sendTrackedToken(address(jack), to, amount);

        emit ExternalJackRewardReserveWithdrawn(to, amount);
    }

    function sendExternalJackRewardReserveToTreasury(uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        _updateAllExternalPools();

        require(externalJackRewardReserve >= amount, "amount > reserve");

        externalJackRewardReserve -= amount;
        _depositTrackedToTreasury(address(jack), amount);

        emit ExternalJackRewardReserveWithdrawn(address(treasury), amount);
    }

    function withdrawJackStakerRewardReserve(address token, uint256 amount, address to)
        external
        onlyOwner
        nonReentrant
    {
        require(to != address(0), "to=0");
        require(isRewardToken[token], "not reward token");

        _updateJackRewardToken(token);

        RewardStream storage s = _rewardStream[token];
        require(s.reserve >= amount, "amount > reserve");

        s.reserve -= amount;
        _sendTrackedToken(token, to, amount);

        emit JackStakerRewardReserveWithdrawn(token, to, amount);
    }

    // Withdraw only untracked/unsupported surplus.
    // This no longer withdraws protected user stake or protected reward reserves.
    function adminWithdrawRewardReserve(address token, uint256 amount, address to)
        external
        onlyOwner
        nonReentrant
    {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "amount=0");

        uint256 actual = _actualBalance(token);
        uint256 tracked = trackedBalance[token];
        uint256 untracked = actual > tracked ? actual - tracked : 0;

        require(amount <= untracked, "amount > untracked");

        _rawSendToken(token, to, amount);
    }

    // ========= Reward Accounting =========

    function _isEligibleExternalPool(address token) internal view returns (bool) {
        if (!isExternalPool[token] || !isExternalPoolActive[token]) return false;

        uint256 e = poolEpoch[token];
        if (e == 0) return false;

        return _extPool[token][e].totalStaked > 0;
    }

    function _countEligibleExternalPools() internal view returns (uint256 active) {
        for (uint256 i = 0; i < externalPoolList.length; i++) {
            if (_isEligibleExternalPool(externalPoolList[i])) active++;
        }
    }

    function _updateAllExternalPools() internal {
        if (lastExternalRewardUpdate == 0) {
            lastExternalRewardUpdate = block.timestamp;
            return;
        }

        if (block.timestamp <= lastExternalRewardUpdate) return;

        if (externalJackRewardReserve == 0) {
            lastExternalRewardUpdate = block.timestamp;
            return;
        }

        uint256 active = _countEligibleExternalPools();
        if (active == 0) {
            lastExternalRewardUpdate = block.timestamp;
            return;
        }

        uint256 ppm = emissionRatePpm[address(jack)];
        if (ppm == 0) {
            lastExternalRewardUpdate = block.timestamp;
            return;
        }

        uint256 dt = block.timestamp - lastExternalRewardUpdate;
        uint256 emitted = (externalJackRewardReserve * ppm * dt) / (PPM_DIVISOR * DAY);

        if (emitted == 0) return;

        if (emitted > externalJackRewardReserve) {
            emitted = externalJackRewardReserve;
        }

        uint256 fee = (emitted * jackRewardFeeBp) / BP_DIVISOR;
        uint256 netEmitted = emitted - fee;

        externalJackRewardReserve -= emitted;

        if (fee > 0) {
            _sendTrackedToken(address(jack), jackFeeRewardRecipient, fee);
            emit RewardFeeSent(address(jack), jackFeeRewardRecipient, fee, true);
        }

        uint256 perPool = netEmitted / active;
        uint256 remainder = netEmitted - (perPool * active);

        for (uint256 i = 0; i < externalPoolList.length; i++) {
            address t = externalPoolList[i];
            if (!_isEligibleExternalPool(t)) continue;

            uint256 addAmt = perPool;

            if (remainder > 0) {
                addAmt += 1;
                remainder -= 1;
            }

            if (addAmt > 0) {
                uint256 e = poolEpoch[t];
                ExtPoolState storage ps = _extPool[t][e];
                ps.accJackPerShare += (addAmt * ACC_PRECISION) / ps.totalStaked;
            }
        }

        lastExternalRewardUpdate = block.timestamp;

        emit ExternalRewardsUpdated(emitted, fee, netEmitted, active, externalJackRewardReserve);
    }

    function _updateJackRewardToken(address rewardToken) internal {
        RewardStream storage s = _rewardStream[rewardToken];

        if (s.lastUpdate == 0) {
            s.lastUpdate = block.timestamp;
            return;
        }

        if (block.timestamp <= s.lastUpdate) return;

        if (!isRewardTokenActive[rewardToken]) {
            s.lastUpdate = block.timestamp;
            return;
        }

        if (jackPool.totalStaked == 0) {
            s.lastUpdate = block.timestamp;
            return;
        }

        if (s.reserve == 0) {
            s.lastUpdate = block.timestamp;
            return;
        }

        uint256 ppm = emissionRatePpm[rewardToken];
        if (ppm == 0) {
            s.lastUpdate = block.timestamp;
            return;
        }

        uint256 dt = block.timestamp - s.lastUpdate;
        uint256 emitted = (s.reserve * ppm * dt) / (PPM_DIVISOR * DAY);

        if (emitted == 0) return;

        if (emitted > s.reserve) {
            emitted = s.reserve;
        }

        uint256 fee = (emitted * externalRewardFeeBp) / BP_DIVISOR;
        uint256 net = emitted - fee;

        s.reserve -= emitted;

        if (net > 0) {
            s.accRewardPerShare += (net * ACC_PRECISION) / jackPool.totalStaked;
        }

        s.lastUpdate = block.timestamp;

        if (fee > 0) {
            _sendTrackedToken(rewardToken, externalFeeRewardRecipient, fee);
            emit RewardFeeSent(rewardToken, externalFeeRewardRecipient, fee, false);
        }

        emit JackRewardTokenUpdated(rewardToken, emitted, fee, s.reserve);
    }

    // ========= View Helpers =========

    function _previewExternalJackPoolAdd(address token) internal view returns (uint256 poolAdd) {
    if (lastExternalRewardUpdate == 0) return 0;
    if (block.timestamp <= lastExternalRewardUpdate) return 0;
    if (externalJackRewardReserve == 0) return 0;
    if (emissionRatePpm[address(jack)] == 0) return 0;
    if (!_isEligibleExternalPool(token)) return 0;

    uint256 active = _countEligibleExternalPools();
    if (active == 0) return 0;

    uint256 dt = block.timestamp - lastExternalRewardUpdate;

    uint256 emitted =
        (externalJackRewardReserve * emissionRatePpm[address(jack)] * dt) /
        (PPM_DIVISOR * DAY);

    if (emitted > externalJackRewardReserve) {
        emitted = externalJackRewardReserve;
    }

    if (emitted == 0) return 0;

    uint256 fee = (emitted * jackRewardFeeBp) / BP_DIVISOR;
    uint256 netEmitted = emitted - fee;

    uint256 perPool = netEmitted / active;
    uint256 remainder = netEmitted - (perPool * active);

    poolAdd = perPool;

    for (uint256 i = 0; i < externalPoolList.length; i++) {
        address poolToken = externalPoolList[i];

        if (!_isEligibleExternalPool(poolToken)) {
            continue;
        }

        if (poolToken == token) {
            if (remainder > 0) {
                poolAdd += 1;
            }

            return poolAdd;
        }

        if (remainder > 0) {
            remainder -= 1;
        }
    }

    return 0;
}

function pendingJack(address token, address user) external view returns (uint256) {
    uint256 e = poolEpoch[token];
    uint256 pending = storedPendingJack[token][user];

    if (e == 0) {
        return pending;
    }

    ExtPoolState storage p = _extPool[token][e];
    ExtUser storage u = p.user[user];

    if (u.amount == 0) {
        return pending;
    }

    uint256 acc = p.accJackPerShare;

    uint256 poolAdd = _previewExternalJackPoolAdd(token);

    if (poolAdd > 0) {
        acc += (poolAdd * ACC_PRECISION) / p.totalStaked;
    }

    uint256 accrued = (u.amount * acc) / ACC_PRECISION;

    if (accrued > u.rewardDebt) {
        pending += accrued - u.rewardDebt;
    }

    return pending;
}

    function pendingExternalReward(address rewardToken, address user) external view returns (uint256) {
        uint256 stakeAmt = jackPool.userStake[user];
        uint256 pending = storedPendingExternalReward[user][rewardToken];

        if (stakeAmt == 0) return pending;

        RewardStream storage s = _rewardStream[rewardToken];
        uint256 acc = s.accRewardPerShare;

        if (
            isRewardTokenActive[rewardToken] &&
            s.lastUpdate != 0 &&
            block.timestamp > s.lastUpdate &&
            jackPool.totalStaked > 0 &&
            s.reserve > 0
        ) {
            uint256 ppm = emissionRatePpm[rewardToken];

            if (ppm > 0) {
                uint256 dt = block.timestamp - s.lastUpdate;
                uint256 emitted = (s.reserve * ppm * dt) / (PPM_DIVISOR * DAY);

                if (emitted > s.reserve) {
                    emitted = s.reserve;
                }

                if (emitted > 0) {
                    uint256 fee = (emitted * externalRewardFeeBp) / BP_DIVISOR;
                    uint256 net = emitted - fee;

                    if (net > 0) {
                        acc += (net * ACC_PRECISION) / jackPool.totalStaked;
                    }
                }
            }
        }

        uint256 accrued = (stakeAmt * acc) / ACC_PRECISION;
        uint256 debt = jackRewardDebt[user][rewardToken];

        if (accrued > debt) {
            pending += accrued - debt;
        }

        return pending;
    }

    function userStakeJack(address user) public view returns (uint256) {
        return jackPool.userStake[user];
    }

    function totalStakedJack() public view returns (uint256) {
        return jackPool.totalStaked;
    }

    function totalStakedExternal(address token) external view returns (uint256) {
        uint256 e = poolEpoch[token];
        if (e == 0) return 0;
        return _extPool[token][e].totalStaked;
    }

    function userStakeExternal(address token, address user) external view returns (uint256) {
        uint256 e = poolEpoch[token];
        if (e == 0) return 0;
        return _extPool[token][e].user[user].amount;
    }

    function getExternalPools() external view returns (address[] memory) {
        return externalPoolList;
    }

    function getPoolEpoch(address token) external view returns (uint256) {
        return poolEpoch[token];
    }

    function getJackRewardStreamInfo(address token)
        external
        view
        returns (uint256 accRewardPerShare, uint256 lastUpdate, uint256 reserve)
    {
        RewardStream storage s = _rewardStream[token];
        return (s.accRewardPerShare, s.lastUpdate, s.reserve);
    }

    function getExternalPoolInfo(address token)
        external
        view
        returns (
            uint256 totalStaked,
            uint256 accJackPerShare,
            uint256 lastUpdate,
            uint256 jackReserve,
            uint256 epoch
        )
    {
        uint256 e = poolEpoch[token];
        if (e == 0) return (0, 0, lastExternalRewardUpdate, 0, 0);

        ExtPoolState storage p = _extPool[token][e];

        return (p.totalStaked, p.accJackPerShare, lastExternalRewardUpdate, 0, e);
    }

    function getRewardStreamReserve(address token) external view returns (uint256) {
        return _rewardStream[token].reserve;
    }

    function getExternalPoolJackReserve(address token) external pure returns (uint256) {
        token;
        return 0;
    }

    function getExternalJackRewardReserve() external view returns (uint256) {
        return externalJackRewardReserve;
    }

    function getUnassignedJackRewardPool() external view returns (uint256) {
        return externalJackRewardReserve;
    }

    function getUserJackStake(address user) external view returns (uint256) {
        return jackPool.userStake[user];
    }

    function getRewardTokens() external view returns (address[] memory) {
        return rewardTokens;
    }

    function getRewardTokenCount() external view returns (uint256) {
        return rewardTokens.length;
    }

    function getExternalPoolCount() external view returns (uint256) {
        return externalPoolList.length;
    }

    function getExternalPoolAt(uint256 index) external view returns (address) {
        require(index < externalPoolList.length, "index out of range");
        return externalPoolList[index];
    }

    function getRewardTokenAt(uint256 index) external view returns (address) {
        require(index < rewardTokens.length, "index out of range");
        return rewardTokens[index];
    }

    function getAllJackStakerRewardReserves()
        external
        view
        returns (address[] memory tokens, uint256[] memory reserves)
    {
        tokens = rewardTokens;
        reserves = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            reserves[i] = _rewardStream[tokens[i]].reserve;
        }
    }

    function getExternalRewardsOverview()
        external
        view
        returns (
            uint256 reserve,
            uint256 lastUpdate,
            uint256 activePools,
            uint256 ppm
        )
    {
        return (
            externalJackRewardReserve,
            lastExternalRewardUpdate,
            _countEligibleExternalPools(),
            emissionRatePpm[address(jack)]
        );
    }

    function getJackStakerRewardOverview(address token)
        external
        view
        returns (
            uint256 reserve,
            uint256 lastUpdate,
            uint256 ppm,
            bool active
        )
    {
        RewardStream storage s = _rewardStream[token];
        return (s.reserve, s.lastUpdate, emissionRatePpm[token], isRewardTokenActive[token]);
    }

    function getRewardFeeConfig()
        external
        view
        returns (
            address jackRecipient,
            address externalRecipient,
            uint256 jackFeeBp,
            uint256 externalFeeBp
        )
    {
        return (
            jackFeeRewardRecipient,
            externalFeeRewardRecipient,
            jackRewardFeeBp,
            externalRewardFeeBp
        );
    }

    function getTrackedBalance(address token) external view returns (uint256) {
        return trackedBalance[token];
    }

    function getUntrackedBalance(address token) external view returns (uint256) {
        uint256 actual = _actualBalance(token);
        uint256 tracked = trackedBalance[token];

        return actual > tracked ? actual - tracked : 0;
    }
}
