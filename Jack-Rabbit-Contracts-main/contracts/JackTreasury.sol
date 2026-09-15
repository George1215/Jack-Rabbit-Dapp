// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IJack.sol";
import "./interfaces/IJackTreasurySwapExecutor.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract JackTreasury {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error ZeroAmount();
    error NotJackToken();
    error NotAuthorized();
    error NotIncomeSource();
    error JackHandledSeparately();
    error AlreadyAdded();
    error NotListed();
    error PendingBalanceExists();
    error PlsPathMustBeEmpty();
    error TokenZero();
    error TokenNotAllowed();
    error JackNoPath();
    error InvalidPath();
    error AlreadyHoldingToken();
    error NotHoldingToken();
    error AlreadyLp();
    error UnknownLp();
    error PlsMismatch();
    error DoNotSendPLS();
    error NoTokensReceived();
    error NoJackReceived();
    error NoPdaiReceived();
    error PdaiNotSet();
    error UnsupportedPegToken();
    error BadFee();
    error NetUnderDelivery();
    error PlsSendFailed();

    address private _owner;
    bool private _paused;

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;

    uint256 private constant ROLLING_DAYS = 1825;
    uint256 private constant FEE_DIVISOR = 1_000_000_000;

    address[] public externalTokens;
    mapping(address => bool) public isExternalToken;
    mapping(address => address[]) public swapPath;
    mapping(address => uint256) public pendingSwapBalances;

    address[] public holdingTokens;
    mapping(address => bool) public isHoldingToken;

    address[] public lpTokens;
    mapping(address => bool) public isLpToken;

    uint256[ROLLING_DAYS] private dailyJackIncome;
    uint256[ROLLING_DAYS] private dailyJackIncomeDayTag;
    uint256 public totalJackIncomeFiveYears;

    uint256[ROLLING_DAYS] private dailyJackPushedFees;
    uint256[ROLLING_DAYS] private dailyJackPushedFeesDayTag;
    uint256 public totalJackPushedFeesFiveYears;

    uint256[ROLLING_DAYS] private dailyPdaiIncome;
    uint256[ROLLING_DAYS] private dailyPdaiIncomeDayTag;
    uint256 public totalPdaiIncomeFiveYears;

    uint256[ROLLING_DAYS] private dailyPdaiReserveDeposits;
    uint256[ROLLING_DAYS] private dailyPdaiReserveDepositDayTag;
    uint256 public totalPdaiReserveDepositsFiveYears;

    uint256[ROLLING_DAYS] private dailyJackPegReturns;
    uint256[ROLLING_DAYS] private dailyJackPegReturnDayTag;
    uint256 public totalJackPegReturnsFiveYears;

    uint256[ROLLING_DAYS] private dailyPdaiPegReturns;
    uint256[ROLLING_DAYS] private dailyPdaiPegReturnDayTag;
    uint256 public totalPdaiPegReturnsFiveYears;

    mapping(address => bool) public authorizedProtocols;

    address public pdai;
    uint256 public treasuryPdaiReserves;
    uint256 public totalPdaiReservesIn;
    uint256 public totalPdaiReservesOut;

    IJack private immutable jackToken;
    IERC20 public immutable JACK;

    IJackTreasurySwapExecutor public swapExecutor;

    uint256 public loanOutstanding;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SwapExecutorUpdated(address indexed oldExecutor, address indexed newExecutor);

    event ReceiveTokenAdded(address indexed token, address[] path);
    event ReceiveTokenRemoved(address indexed token);
    event PendingSwapStored(address indexed token, uint256 amountAdded, uint256 totalPending);
    event PendingSwapProcessed(address indexed token, uint256 requestedAmount, uint256 usedAmount, uint256 remainingPending);

    event SwapPathSet(address indexed token, address[] path);
    event TokenSwapped(address indexed token, uint256 amountIn, uint256 jackReceivedNet);

    event PdaiSet(address indexed pdai);
    event PdaiIncomeReceived(address indexed from, uint256 amountReceived);
    event PdaiReserveDeposited(address indexed from, uint256 amountReceived);
    event PdaiReserveSent(address indexed protocol, address indexed to, uint256 amount);

    event PegReturnReceived(address indexed protocol, address indexed token, uint256 amountReceived);
    event PushedFeeReclassifiedAsPegReturn(uint256 pushedRemoved, uint256 incomeRemoved);

    event LoanRepaid(uint256 burned, uint256 remainingLoan);

    event JackIncomeRecorded(uint256 jackNetRecorded);
    event PushedFeeRecorded(uint256 jackTreasuryPart);
    event PdaiIncomeRecorded(uint256 pdaiAmount);
    event PdaiReserveDepositRecorded(uint256 pdaiAmount);
    event JackPegReturnRecorded(uint256 jackAmount);
    event PdaiPegReturnRecorded(uint256 pdaiAmount);

    event HoldingTokenAdded(address indexed token);
    event HoldingTokenRemoved(address indexed token);
    event HoldingTokenDeposited(address indexed from, address indexed token, uint256 amountReceived);
    event HoldingSentToProtocol(address indexed protocol, address indexed token, address indexed to, uint256 amount);

    event LpTokenAdded(address indexed lpToken);
    event LpTokenRemoved(address indexed lpToken);
    event LpTokenDeposited(address indexed from, address indexed lpToken, uint256 amountReceived);
    event JackReserveDeposited(address indexed from, uint256 amountReceived);
    event LpSentToProtocol(address indexed protocol, address indexed lpToken, address indexed to, uint256 amount);

    event JackRequestSkipped(address indexed protocol, address indexed to, uint256 netRequested, uint256 grossNeeded, uint256 availableGross);
    event JackRequestPartial(address indexed protocol, address indexed to, uint256 netRequested, uint256 netDelivered, uint256 grossSent);
    event LpRequestSkipped(address indexed protocol, address indexed lpToken, address indexed to, uint256 amountRequested);

    event ProtocolAuthorized(address indexed protocol);
    event ProtocolRevoked(address indexed protocol);

    modifier onlyOwner() {
        if (msg.sender != _owner) revert NotAuthorized();
        _;
    }

    modifier whenNotPaused() {
        if (_paused) revert NotAuthorized();
        _;
    }

    modifier nonReentrant() {
        if (_status == _ENTERED) revert NotAuthorized();
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    constructor(
        address _jackToken,
        address _swapExecutor,
        address[] memory _externalTokens
    ) {
        if (_jackToken == address(0)) revert ZeroAddress();
        if (_externalTokens.length == 0) revert ZeroAmount();

        _owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);

        jackToken = IJack(_jackToken);
        JACK = IERC20(_jackToken);

        if (_swapExecutor != address(0)) {
            swapExecutor = IJackTreasurySwapExecutor(_swapExecutor);
            emit SwapExecutorUpdated(address(0), _swapExecutor);
        }

        for (uint256 i = 0; i < _externalTokens.length; i++) {
            address token = _externalTokens[i];

            if (token == _jackToken) revert JackHandledSeparately();

            if (!isExternalToken[token]) {
                externalTokens.push(token);
                isExternalToken[token] = true;
            }
        }
    }

    receive() external payable {}

    function owner() public view returns (address) {
        return _owner;
    }

    function paused() public view returns (bool) {
        return _paused;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();

        address oldOwner = _owner;
        _owner = newOwner;

        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function setSwapExecutor(address newExecutor) external onlyOwner {
        address old = address(swapExecutor);
        swapExecutor = IJackTreasurySwapExecutor(newExecutor);
        emit SwapExecutorUpdated(old, newExecutor);
    }

    function pause() external onlyOwner {
        _paused = true;
    }

    function unpause() external onlyOwner {
        _paused = false;
    }

    function getCurrentDay() external view returns (uint256) {
        return _dayNow();
    }

    function _dayNow() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }

    function _idx(uint256 day_) internal pure returns (uint256) {
        return day_ % ROLLING_DAYS;
    }

    function _recordRolling(
        uint256[ROLLING_DAYS] storage dailyValues,
        uint256[ROLLING_DAYS] storage dayTags,
        uint256 currentTotal,
        uint256 amount
    ) internal returns (uint256 newTotal) {
        if (amount == 0) return currentTotal;

        uint256 day_ = _dayNow();
        uint256 idx = _idx(day_);

        if (dayTags[idx] != day_) {
            uint256 oldSlot = dailyValues[idx];

            if (oldSlot > 0) {
                currentTotal = currentTotal > oldSlot ? currentTotal - oldSlot : 0;
            }

            dailyValues[idx] = 0;
            dayTags[idx] = day_;
        }

        dailyValues[idx] += amount;
        return currentTotal + amount;
    }

    function _rollingValueForDay(
        uint256[ROLLING_DAYS] storage dailyValues,
        uint256[ROLLING_DAYS] storage dayTags,
        uint256 day_
    ) internal view returns (uint256) {
        uint256 idx = _idx(day_);
        if (dayTags[idx] != day_) return 0;
        return dailyValues[idx];
    }

    function _removeTodayRolling(
        uint256[ROLLING_DAYS] storage dailyValues,
        uint256[ROLLING_DAYS] storage dayTags,
        uint256 currentTotal,
        uint256 amount
    ) internal returns (uint256 removed, uint256 newTotal) {
        if (amount == 0) return (0, currentTotal);

        uint256 day_ = _dayNow();
        uint256 idx = _idx(day_);

        if (dayTags[idx] != day_) return (0, currentTotal);

        uint256 existing = dailyValues[idx];
        if (existing == 0) return (0, currentTotal);

        removed = amount > existing ? existing : amount;
        dailyValues[idx] = existing - removed;
        newTotal = currentTotal > removed ? currentTotal - removed : 0;
    }

    function getJackIncomeForDay(uint256 day_) public view returns (uint256) {
        return _rollingValueForDay(dailyJackIncome, dailyJackIncomeDayTag, day_);
    }

    function getJackPushedFeesForDay(uint256 day_) public view returns (uint256) {
        return _rollingValueForDay(dailyJackPushedFees, dailyJackPushedFeesDayTag, day_);
    }

    function getPdaiIncomeForDay(uint256 day_) public view returns (uint256) {
        return _rollingValueForDay(dailyPdaiIncome, dailyPdaiIncomeDayTag, day_);
    }

    function getPdaiReserveDepositsForDay(uint256 day_) public view returns (uint256) {
        return _rollingValueForDay(dailyPdaiReserveDeposits, dailyPdaiReserveDepositDayTag, day_);
    }

    function getJackPegReturnsForDay(uint256 day_) public view returns (uint256) {
        return _rollingValueForDay(dailyJackPegReturns, dailyJackPegReturnDayTag, day_);
    }

    function getPdaiPegReturnsForDay(uint256 day_) public view returns (uint256) {
        return _rollingValueForDay(dailyPdaiPegReturns, dailyPdaiPegReturnDayTag, day_);
    }

    function _todayJackPushedFees() internal view returns (uint256) {
        return getJackPushedFeesForDay(_dayNow());
    }

    function _recordJackIncome(uint256 amount) internal {
        totalJackIncomeFiveYears = _recordRolling(dailyJackIncome, dailyJackIncomeDayTag, totalJackIncomeFiveYears, amount);
        emit JackIncomeRecorded(amount);
    }

    function _recordJackPushedFee(uint256 amount) internal {
        totalJackPushedFeesFiveYears = _recordRolling(dailyJackPushedFees, dailyJackPushedFeesDayTag, totalJackPushedFeesFiveYears, amount);
        emit PushedFeeRecorded(amount);
    }

    function _recordPdaiIncome(uint256 amount) internal {
        totalPdaiIncomeFiveYears = _recordRolling(dailyPdaiIncome, dailyPdaiIncomeDayTag, totalPdaiIncomeFiveYears, amount);
        emit PdaiIncomeRecorded(amount);
    }

    function _recordPdaiReserveDeposit(uint256 amount) internal {
        totalPdaiReserveDepositsFiveYears = _recordRolling(
            dailyPdaiReserveDeposits,
            dailyPdaiReserveDepositDayTag,
            totalPdaiReserveDepositsFiveYears,
            amount
        );
        emit PdaiReserveDepositRecorded(amount);
    }

    function _recordJackPegReturn(uint256 amount) internal {
        totalJackPegReturnsFiveYears = _recordRolling(dailyJackPegReturns, dailyJackPegReturnDayTag, totalJackPegReturnsFiveYears, amount);
        emit JackPegReturnRecorded(amount);
    }

    function _recordPdaiPegReturn(uint256 amount) internal {
        totalPdaiPegReturnsFiveYears = _recordRolling(dailyPdaiPegReturns, dailyPdaiPegReturnDayTag, totalPdaiPegReturnsFiveYears, amount);
        emit PdaiPegReturnRecorded(amount);
    }

    function _excludePushedFeeFromPegReturn(uint256 pushedDelta) internal {
        if (pushedDelta == 0) return;

        (uint256 pushedRemoved, uint256 newPushedTotal) =
            _removeTodayRolling(dailyJackPushedFees, dailyJackPushedFeesDayTag, totalJackPushedFeesFiveYears, pushedDelta);

        totalJackPushedFeesFiveYears = newPushedTotal;

        if (pushedRemoved > 0) {
            (uint256 incomeRemoved, uint256 newIncomeTotal) =
                _removeTodayRolling(dailyJackIncome, dailyJackIncomeDayTag, totalJackIncomeFiveYears, pushedRemoved);

            totalJackIncomeFiveYears = newIncomeTotal;
            emit PushedFeeReclassifiedAsPegReturn(pushedRemoved, incomeRemoved);
        } else {
            emit PushedFeeReclassifiedAsPegReturn(pushedRemoved, 0);
        }
    }

    function addTokenToReceiveList(address token, address[] calldata path) external onlyOwner {
        if (token == address(JACK)) revert JackHandledSeparately();
        if (isExternalToken[token]) revert AlreadyAdded();

        if (token == address(0)) {
            if (path.length != 0) revert PlsPathMustBeEmpty();
        } else if (path.length > 0) {
            _validateJackSwapPath(token, path);
            swapPath[token] = path;
        }

        externalTokens.push(token);
        isExternalToken[token] = true;

        emit ReceiveTokenAdded(token, path);
    }

    function removeTokenFromReceiveList(address token) external onlyOwner {
        if (!isExternalToken[token]) revert NotListed();
        if (pendingSwapBalances[token] != 0) revert PendingBalanceExists();

        isExternalToken[token] = false;

        for (uint256 i = 0; i < externalTokens.length; i++) {
            if (externalTokens[i] == token) {
                externalTokens[i] = externalTokens[externalTokens.length - 1];
                externalTokens.pop();
                break;
            }
        }

        if (token != address(0)) delete swapPath[token];

        emit ReceiveTokenRemoved(token);
    }

    function setSwapPath(address token, address[] calldata path) external onlyOwner {
        if (token == address(0)) revert TokenZero();
        if (!isExternalToken[token]) revert TokenNotAllowed();
        if (token == address(JACK)) revert JackNoPath();

        _validateJackSwapPath(token, path);
        swapPath[token] = path;

        emit SwapPathSet(token, path);
    }

    function setNativeSwapPath(address[] calldata path) external onlyOwner {
        if (!isExternalToken[address(0)]) revert TokenNotAllowed();
        if (address(swapExecutor) == address(0)) revert ZeroAddress();

        address wrappedNative = swapExecutor.wpls();

        if (path.length < 2) revert InvalidPath();
        if (path[0] != wrappedNative) revert InvalidPath();
        if (path[path.length - 1] != address(JACK)) revert InvalidPath();

        for (uint256 i = 0; i < path.length; i++) {
            if (path[i] == address(0)) revert InvalidPath();
            if (i > 0 && path[i] == path[i - 1]) revert InvalidPath();
        }

        swapPath[address(0)] = path;
        emit SwapPathSet(address(0), path);
    }

    function _validateJackSwapPath(address token, address[] calldata path) internal view {
        if (path.length < 2) revert InvalidPath();
        if (path[0] != token) revert InvalidPath();
        if (path[path.length - 1] != address(JACK)) revert InvalidPath();

        for (uint256 i = 0; i < path.length; i++) {
            if (path[i] == address(0)) revert InvalidPath();
            if (i > 0 && path[i] == path[i - 1]) revert InvalidPath();
        }
    }

    function getExternalTokens() external view returns (address[] memory) {
        return externalTokens;
    }

    function addHoldingToken(address token) external onlyOwner {
        if (token == address(JACK)) revert JackHandledSeparately();
        if (isHoldingToken[token]) revert AlreadyHoldingToken();

        holdingTokens.push(token);
        isHoldingToken[token] = true;

        emit HoldingTokenAdded(token);
    }

    function removeHoldingToken(address token) external onlyOwner {
        if (!isHoldingToken[token]) revert NotHoldingToken();

        isHoldingToken[token] = false;

        for (uint256 i = 0; i < holdingTokens.length; i++) {
            if (holdingTokens[i] == token) {
                holdingTokens[i] = holdingTokens[holdingTokens.length - 1];
                holdingTokens.pop();
                break;
            }
        }

        emit HoldingTokenRemoved(token);
    }

    function depositHoldingToken(address token, uint256 amount) external payable whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (!isHoldingToken[token]) revert NotHoldingToken();

        _receiveHoldingTokenFrom(msg.sender, token, amount);
    }

    function _receiveHoldingTokenFrom(address from, address token, uint256 amount) internal returns (uint256 received) {
        if (token == address(0)) {
            if (msg.value != amount) revert PlsMismatch();
            received = amount;
        } else {
            if (msg.value != 0) revert DoNotSendPLS();

            IERC20 t = IERC20(token);
            uint256 beforeBalance = t.balanceOf(address(this));
            t.safeTransferFrom(from, address(this), amount);
            received = t.balanceOf(address(this)) - beforeBalance;

            if (received == 0) revert NoTokensReceived();
        }

        emit HoldingTokenDeposited(from, token, received);
    }

    function getHoldingTokens() external view returns (address[] memory) {
        return holdingTokens;
    }

    function _actualBalance(address token) internal view returns (uint256) {
        if (token == address(0)) return address(this).balance;
        return IERC20(token).balanceOf(address(this));
    }

    function _protectedReserveForToken(address token) internal view returns (uint256) {
        if (pdai != address(0) && token == pdai) return treasuryPdaiReserves;
        return 0;
    }

    function _usableHoldingBalance(address token) internal view returns (uint256) {
        uint256 actualBalance = _actualBalance(token);
        uint256 locked = pendingSwapBalances[token] + _protectedReserveForToken(token);

        if (actualBalance <= locked) return 0;
        return actualBalance - locked;
    }

    function pushFee(uint256 amount) external {
        if (msg.sender != address(jackToken)) revert NotJackToken();
        if (amount == 0) revert ZeroAmount();

        _recordJackPushedFee(amount);
        _recordJackIncome(amount);
    }

    function _repayLoanIfAny(uint256 jackInNet) internal returns (uint256 remainingNet) {
        if (loanOutstanding == 0 || jackInNet == 0) return jackInNet;

        uint256 burnAmount = jackInNet <= loanOutstanding ? jackInNet : loanOutstanding;

        jackToken.burn(burnAmount);
        loanOutstanding -= burnAmount;

        emit LoanRepaid(burnAmount, loanOutstanding);

        unchecked {
            return jackInNet - burnAmount;
        }
    }

    function _grossUpForNet(uint256 netDesired) internal view returns (uint256 gross) {
        uint256 feePPB = jackToken.getCurrentFeeBP();
        if (feePPB >= FEE_DIVISOR) revert BadFee();

        uint256 denom = FEE_DIVISOR - feePPB;
        gross = (netDesired * FEE_DIVISOR + denom - 1) / denom;
    }

    function requestJack(uint256 netAmount, address to) external nonReentrant {
        if (!authorizedProtocols[msg.sender]) revert NotAuthorized();
        _requestJack(msg.sender, netAmount, to);
    }

    function _requestJack(address protocol, uint256 netAmount, address to) internal {
        if (netAmount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        uint256 grossToSend = _grossUpForNet(netAmount);
        uint256 balance = JACK.balanceOf(address(this));

        if (balance == 0) {
            bool canMint = false;

            try jackToken.treasury() returns (address activeTreasury) {
                if (activeTreasury == address(this)) canMint = true;
            } catch {}

            if (canMint) {
                uint256 beforeBalance = balance;

                try jackToken.mint() {
                    uint256 afterBalance = JACK.balanceOf(address(this));
                    uint256 minted = afterBalance > beforeBalance ? afterBalance - beforeBalance : 0;

                    if (minted > 0) loanOutstanding += minted;
                    balance = afterBalance;
                } catch {
                    balance = JACK.balanceOf(address(this));
                }
            }
        }

        if (balance == 0) {
            emit JackRequestSkipped(protocol, to, netAmount, grossToSend, 0);
            return;
        }

        _sendAvailableJack(protocol, netAmount, grossToSend, balance, to);
    }

    function _sendAvailableJack(
        address protocol,
        uint256 netAmount,
        uint256 grossToSend,
        uint256 balance,
        address to
    ) internal {
        if (balance >= grossToSend) {
            uint256 toBefore = JACK.balanceOf(to);
            JACK.safeTransfer(to, grossToSend);
            uint256 receivedNet = JACK.balanceOf(to) - toBefore;

            if (receivedNet < netAmount) revert NetUnderDelivery();
            return;
        }

        uint256 toBeforePartial = JACK.balanceOf(to);
        JACK.safeTransfer(to, balance);
        uint256 receivedNetPartial = JACK.balanceOf(to) - toBeforePartial;

        emit JackRequestPartial(protocol, to, netAmount, receivedNetPartial, balance);
    }

    function setPdai(address _pdai) external onlyOwner {
        if (_pdai == address(0)) revert ZeroAddress();
        pdai = _pdai;
        emit PdaiSet(_pdai);
    }

    function depositPdaiReserve(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (pdai == address(0)) revert PdaiNotSet();

        _receivePdaiReserveFrom(msg.sender, amount, false);
    }

    function receivePdaiIncome(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (pdai == address(0)) revert PdaiNotSet();

        if (!(authorizedProtocols[msg.sender] || msg.sender == _owner)) revert NotIncomeSource();

        _receivePdaiReserveFrom(msg.sender, amount, true);
    }

    function _receivePdaiReserveFrom(address from, uint256 amount, bool asIncome) internal returns (uint256 received) {
        IERC20 pdaiToken = IERC20(pdai);

        uint256 beforeBalance = pdaiToken.balanceOf(address(this));
        pdaiToken.safeTransferFrom(from, address(this), amount);
        received = pdaiToken.balanceOf(address(this)) - beforeBalance;

        if (received == 0) revert NoPdaiReceived();

        treasuryPdaiReserves += received;
        totalPdaiReservesIn += received;

        if (asIncome) {
            _recordPdaiIncome(received);
            emit PdaiIncomeReceived(from, received);
        } else {
            _recordPdaiReserveDeposit(received);
            emit PdaiReserveDeposited(from, received);
        }
    }

    function requestPdaiReserve(uint256 amount, address to) external nonReentrant {
        if (!authorizedProtocols[msg.sender]) revert NotAuthorized();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (pdai == address(0)) revert PdaiNotSet();

        uint256 balance = IERC20(pdai).balanceOf(address(this));

        if (balance == 0 || treasuryPdaiReserves == 0) return;

        uint256 available = balance < treasuryPdaiReserves ? balance : treasuryPdaiReserves;
        uint256 sendAmount = available < amount ? available : amount;

        IERC20(pdai).safeTransfer(to, sendAmount);

        treasuryPdaiReserves -= sendAmount;
        totalPdaiReservesOut += sendAmount;

        emit PdaiReserveSent(msg.sender, to, sendAmount);
    }

    function receivePegReturn(address token, uint256 amount) external whenNotPaused nonReentrant {
        if (!authorizedProtocols[msg.sender]) revert NotAuthorized();
        if (amount == 0) revert ZeroAmount();
        if (!(token == address(JACK) || token == pdai)) revert UnsupportedPegToken();

        if (token == address(JACK)) _receiveJackPegReturn(amount);
        else _receivePdaiPegReturn(amount);
    }

    function _receiveJackPegReturn(uint256 amount) internal {
        uint256 jackBefore = JACK.balanceOf(address(this));
        uint256 pushedBefore = _todayJackPushedFees();

        JACK.safeTransferFrom(msg.sender, address(this), amount);

        uint256 jackReceivedNet = JACK.balanceOf(address(this)) - jackBefore;
        if (jackReceivedNet == 0) revert NoJackReceived();

        uint256 pushedDelta = _todayJackPushedFees() - pushedBefore;
        if (pushedDelta > 0) _excludePushedFeeFromPegReturn(pushedDelta);

        _recordJackPegReturn(jackReceivedNet);
        emit PegReturnReceived(msg.sender, address(JACK), jackReceivedNet);
    }

    function _receivePdaiPegReturn(uint256 amount) internal {
        if (pdai == address(0)) revert PdaiNotSet();

        uint256 received = _receivePdaiReserveFrom(msg.sender, amount, false);

        _recordPdaiPegReturn(received);
        emit PegReturnReceived(msg.sender, pdai, received);
    }

    function depositJackReserve(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();

        uint256 jackBefore = JACK.balanceOf(address(this));
        uint256 pushedBefore = _todayJackPushedFees();

        JACK.safeTransferFrom(msg.sender, address(this), amount);

        uint256 jackReceivedNet = JACK.balanceOf(address(this)) - jackBefore;
        if (jackReceivedNet == 0) revert NoJackReceived();

        _finalizeJackReserveDeposit(jackReceivedNet, pushedBefore);

        emit JackReserveDeposited(msg.sender, jackReceivedNet);
    }

    function receiveFunds(address token, uint256 amount) external payable whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();

        uint256 jackBefore = JACK.balanceOf(address(this));

        if (token == address(0)) {
            _receiveNativeFunds(amount, jackBefore);
            return;
        }

        if (msg.value != 0) revert DoNotSendPLS();

        if (token == address(JACK)) {
            _receiveJack(amount, jackBefore);
            return;
        }

        if (pdai != address(0) && token == pdai) {
            _receivePdaiReserveFrom(msg.sender, amount, true);
            return;
        }

        IERC20 tokenContract = IERC20(token);
        uint256 beforeBalance = tokenContract.balanceOf(address(this));

        tokenContract.safeTransferFrom(msg.sender, address(this), amount);

        uint256 received = tokenContract.balanceOf(address(this)) - beforeBalance;
        if (received == 0) revert NoTokensReceived();

        if (!isExternalToken[token]) {
            isExternalToken[token] = true;
            externalTokens.push(token);
            emit ReceiveTokenAdded(token, swapPath[token]);
        }

        _storePending(token, received, pendingSwapBalances[token] + received);
        _processPendingERC20(token, pendingSwapBalances[token], jackBefore);
    }

    function processPendingSwap(address token, uint256 maxAmount) external whenNotPaused nonReentrant returns (uint256 usedAmount) {
        uint256 pending = pendingSwapBalances[token];

        if (pending == 0) return 0;

        uint256 amountToTry = maxAmount == 0 || maxAmount > pending ? pending : maxAmount;
        uint256 jackBefore = JACK.balanceOf(address(this));

        if (token == address(0)) usedAmount = _processPendingNative(amountToTry, jackBefore);
        else usedAmount = _processPendingERC20(token, amountToTry, jackBefore);
    }

    function _receiveNativeFunds(uint256 amount, uint256 jackBefore) internal {
        if (msg.value != amount) revert PlsMismatch();

        if (!isExternalToken[address(0)]) {
            isExternalToken[address(0)] = true;
            externalTokens.push(address(0));
            emit ReceiveTokenAdded(address(0), new address[](0));
        }

        _storePending(address(0), amount, pendingSwapBalances[address(0)] + amount);
        _processPendingNative(pendingSwapBalances[address(0)], jackBefore);
    }

    function _processPendingNative(uint256 amountDesired, uint256 jackBefore) internal returns (uint256 usedAmount) {
        if (amountDesired == 0) return 0;
        if (address(swapExecutor) == address(0)) return 0;

        uint256 pending = pendingSwapBalances[address(0)];
        if (pending == 0) return 0;

        uint256 desired = amountDesired > pending ? pending : amountDesired;
        address[] memory path = swapPath[address(0)];

        if (!_pathLooksValid(address(0), path)) return 0;

        uint256 pushedBefore = _todayJackPushedFees();
        uint256 jackReceivedNet;

        try swapExecutor.executeNativeSwapToJack{value: desired}(path, address(this)) returns (uint256 amountUsed, uint256 jackNet) {
            usedAmount = amountUsed;
            jackReceivedNet = jackNet;
        } catch {
            return 0;
        }

        if (usedAmount == 0) return 0;
        if (usedAmount > pending) usedAmount = pending;

        pendingSwapBalances[address(0)] = pending - usedAmount;

        emit TokenSwapped(address(0), usedAmount, jackReceivedNet);
        emit PendingSwapProcessed(address(0), amountDesired, usedAmount, pendingSwapBalances[address(0)]);

        uint256 realJackReceived = JACK.balanceOf(address(this)) - jackBefore;
        _finalizeJackIncome(realJackReceived, pushedBefore);
    }

    function _receiveJack(uint256 amount, uint256 jackBefore) internal {
        uint256 pushedBefore = _todayJackPushedFees();

        JACK.safeTransferFrom(msg.sender, address(this), amount);

        uint256 jackReceivedNet = JACK.balanceOf(address(this)) - jackBefore;
        if (jackReceivedNet == 0) revert NoJackReceived();

        _finalizeJackIncome(jackReceivedNet, pushedBefore);
    }

    function _processPendingERC20(address token, uint256 amountDesired, uint256 jackBefore) internal returns (uint256 usedAmount) {
        if (amountDesired == 0) return 0;
        if (address(swapExecutor) == address(0)) return 0;

        uint256 pending = pendingSwapBalances[token];
        if (pending == 0) return 0;

        uint256 desired = amountDesired > pending ? pending : amountDesired;
        address[] memory path = swapPath[token];

        if (!_pathLooksValid(token, path)) return 0;

        uint256 balance = IERC20(token).balanceOf(address(this));
        if (desired > balance) desired = balance;
        if (desired == 0) return 0;

        IERC20(token).forceApprove(address(swapExecutor), 0);
        IERC20(token).forceApprove(address(swapExecutor), desired);

        uint256 pushedBefore = _todayJackPushedFees();
        uint256 jackReceivedNet;

        try swapExecutor.executeERC20SwapToJack(token, path, desired, address(this)) returns (uint256 amountUsed, uint256 jackNet) {
            usedAmount = amountUsed;
            jackReceivedNet = jackNet;
        } catch {
            IERC20(token).forceApprove(address(swapExecutor), 0);
            return 0;
        }

        IERC20(token).forceApprove(address(swapExecutor), 0);

        if (usedAmount == 0) return 0;
        if (usedAmount > pending) usedAmount = pending;

        pendingSwapBalances[token] = pending - usedAmount;

        emit TokenSwapped(token, usedAmount, jackReceivedNet);
        emit PendingSwapProcessed(token, amountDesired, usedAmount, pendingSwapBalances[token]);

        uint256 realJackReceived = JACK.balanceOf(address(this)) - jackBefore;
        _finalizeJackIncome(realJackReceived, pushedBefore);
    }

    function _pathLooksValid(address token, address[] memory path) internal view returns (bool) {
        if (path.length < 2) return false;

        if (token == address(0)) {
            if (path[0] == address(0)) return false;
        } else {
            if (path[0] != token) return false;
        }

        if (path[path.length - 1] != address(JACK)) return false;

        for (uint256 i = 0; i < path.length; i++) {
            if (path[i] == address(0)) return false;
            if (i > 0 && path[i] == path[i - 1]) return false;
        }

        return true;
    }

    function _storePending(address token, uint256 amountAdded, uint256 totalPending) internal {
        pendingSwapBalances[token] = totalPending;
        emit PendingSwapStored(token, amountAdded, totalPending);
    }

    function _finalizeJackIncome(uint256 jackReceivedNet, uint256 pushedBefore) internal {
        uint256 remaining = _repayLoanIfAny(jackReceivedNet);

        uint256 pushedAfter = _todayJackPushedFees();
        uint256 pushedDelta = pushedAfter > pushedBefore ? pushedAfter - pushedBefore : 0;

        uint256 netToRecord = remaining;

        if (pushedDelta > 0) {
            netToRecord = netToRecord > pushedDelta ? netToRecord - pushedDelta : 0;
        }

        _recordJackIncome(netToRecord);
    }

    function _finalizeJackReserveDeposit(uint256 jackReceivedNet, uint256 pushedBefore) internal {
        uint256 pushedAfter = _todayJackPushedFees();
        uint256 pushedDelta = pushedAfter > pushedBefore ? pushedAfter - pushedBefore : 0;

        uint256 netToRecord = jackReceivedNet;

        if (pushedDelta > 0) {
            netToRecord = netToRecord > pushedDelta ? netToRecord - pushedDelta : 0;
        }

        _recordJackIncome(netToRecord);
    }

    function requestHoldingToken(address token, uint256 amount, address to) external nonReentrant {
        if (!authorizedProtocols[msg.sender]) revert NotAuthorized();
        _sendHoldingToken(msg.sender, token, amount, to);
    }

    function _sendHoldingToken(address protocol, address token, uint256 amount, address to) internal {
        if (!isHoldingToken[token]) revert NotHoldingToken();
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        uint256 available = _usableHoldingBalance(token);

        if (available == 0) return;

        uint256 sendAmount = available < amount ? available : amount;

        if (token == address(0)) {
            (bool ok, ) = payable(to).call{value: sendAmount}("");
            if (!ok) revert PlsSendFailed();
        } else {
            IERC20(token).safeTransfer(to, sendAmount);
        }

        emit HoldingSentToProtocol(protocol, token, to, sendAmount);
    }

    function authorizeProtocol(address protocol) external onlyOwner {
        if (protocol == address(0)) revert ZeroAddress();

        authorizedProtocols[protocol] = true;

        emit ProtocolAuthorized(protocol);
    }

    function revokeProtocol(address protocol) external onlyOwner {
        if (protocol == address(0)) revert ZeroAddress();

        authorizedProtocols[protocol] = false;

        emit ProtocolRevoked(protocol);
    }

    function addLpToken(address lpToken) external onlyOwner {
        if (lpToken == address(0)) revert ZeroAddress();
        if (isLpToken[lpToken]) revert AlreadyLp();

        lpTokens.push(lpToken);
        isLpToken[lpToken] = true;

        emit LpTokenAdded(lpToken);
    }

    function removeLpToken(address lpToken) external onlyOwner {
        if (!isLpToken[lpToken]) revert UnknownLp();

        isLpToken[lpToken] = false;

        for (uint256 i = 0; i < lpTokens.length; i++) {
            if (lpTokens[i] == lpToken) {
                lpTokens[i] = lpTokens[lpTokens.length - 1];
                lpTokens.pop();
                break;
            }
        }

        emit LpTokenRemoved(lpToken);
    }

    function getLpTokens() external view returns (address[] memory) {
        return lpTokens;
    }

    function depositLpToken(address lpToken, uint256 amount) external whenNotPaused nonReentrant {
        if (!isLpToken[lpToken]) revert UnknownLp();
        if (amount == 0) revert ZeroAmount();

        IERC20 lp = IERC20(lpToken);
        uint256 beforeBalance = lp.balanceOf(address(this));

        lp.safeTransferFrom(msg.sender, address(this), amount);

        uint256 amountReceived = lp.balanceOf(address(this)) - beforeBalance;
        if (amountReceived == 0) revert NoTokensReceived();

        emit LpTokenDeposited(msg.sender, lpToken, amountReceived);
    }

    function requestLp(address lpToken, uint256 amount, address to) external nonReentrant {
        if (!authorizedProtocols[msg.sender]) revert NotAuthorized();
        _sendLp(msg.sender, lpToken, amount, to);
    }

    function withdrawLp(address lpToken, uint256 amount, address to) external onlyOwner nonReentrant {
        _sendLp(msg.sender, lpToken, amount, to);
    }

    function _sendLp(address protocol, address lpToken, uint256 amount, address to) internal {
        if (!isLpToken[lpToken]) revert UnknownLp();
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        uint256 balance = IERC20(lpToken).balanceOf(address(this));

        if (balance == 0) {
            emit LpRequestSkipped(protocol, lpToken, to, amount);
            return;
        }

        uint256 sendAmount = balance < amount ? balance : amount;

        IERC20(lpToken).safeTransfer(to, sendAmount);

        emit LpSentToProtocol(protocol, lpToken, to, sendAmount);
    }
}