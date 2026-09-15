// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IJackTreasury.sol";

contract JackToken is ERC20, Ownable {
    // =============================================================
    // JACK CONFIG
    // =============================================================

    uint256 public constant BP_DIVISOR = 1_000_000_000; // 100% using PPB precision
    uint256 public constant SHARE_DIVISOR = 10_000;     // 100% for fee split calculations

    uint256 public immutable MAX_SUPPLY;
    uint256 public immutable BURN_STOP_SUPPLY;

    uint256 public constant MINT_INTERVAL = 1 days;

    // =============================================================
    // TREASURY
    // =============================================================

    address public treasury;

    // =============================================================
    // BURN / MINT TRACKING
    // =============================================================

    uint256 public totalBurned;
    uint256 public lastMintTimestamp;

    // =============================================================
    // DYNAMIC FEE MODEL
    // =============================================================

    uint256 public treasuryTarget;
    uint256 public maxFeeBP;
    uint256 public minFeeBP;

    uint256 public startBurnShareBP;
    uint256 public endBurnShareBP;

    // =============================================================
    // TEMPORARY FEE OVERRIDE
    // =============================================================

    uint256 public overrideFeeBP;
    uint256 public overrideUntil;

    // =============================================================
    // CONTRACT ACCESS
    // =============================================================

    mapping(address => bool) public allowedContracts;

    enum OverrideDuration {
        H24,
        D7,
        M1,
        M3,
        M6,
        Y1
    }

    // =============================================================
    // EVENTS
    // =============================================================

    event AllowedContractUpdated(address indexed account, bool allowed);
    event Burn(address indexed from, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    event TreasuryTargetUpdated(
        uint256 oldTreasuryTarget,
        uint256 newTreasuryTarget
    );

    event DynamicFeeConfigUpdated(
        uint256 treasuryTarget,
        uint256 maxFeeBP,
        uint256 minFeeBP,
        uint256 startBurnShareBP,
        uint256 endBurnShareBP
    );

    event FeeOverrideActivated(uint256 feeBP, uint256 until);
    event FeeOverrideExpired();

    // =============================================================
    // MODIFIERS
    // =============================================================

    modifier onlyTreasuryOrAllowed() {
        require(
            msg.sender == treasury || allowedContracts[msg.sender],
            "Not treasury/allowed"
        );
        _;
    }

    modifier onlyTreasury() {
        require(msg.sender == treasury, "Not treasury");
        _;
    }

    // =============================================================
    // CONSTRUCTOR
    // =============================================================

    constructor()
        ERC20("Jack Rabbit", "JACK")
        Ownable(msg.sender)
    {
        uint256 unit = 10 ** decimals();

        MAX_SUPPLY = 1_000_000_000 * unit;

        // JACK automatic fee burns stop at 5% of max supply.
        // 5% of 1B JACK = 50M JACK.
        BURN_STOP_SUPPLY = 50_000_000 * unit;

        _mint(msg.sender, MAX_SUPPLY);

        treasuryTarget = 50_000_000 * unit;

        maxFeeBP = 1_000_000; // 0.1%
        minFeeBP = 5_000;     // 0.0005%

        // Early stage: all collected fees go to treasury first.
        // As treasury grows, burn share increases up to 50%.
        startBurnShareBP = 0;    // 0% of collected fee
        endBurnShareBP = 5000;   // 50% of collected fee
    }

    // =============================================================
    // ERC20 OVERRIDES
    // =============================================================

    function transfer(address to, uint256 amount) public override returns (bool) {
        address sender = _msgSender();

        (, uint256 netAmount) = _takeFee(sender, amount);

        super._transfer(sender, to, netAmount);

        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        address spender = _msgSender();

        _spendAllowance(from, spender, amount);

        (, uint256 netAmount) = _takeFee(from, amount);

        super._transfer(from, to, netAmount);

        return true;
    }

    // =============================================================
    // FEE LOGIC
    // =============================================================

    function _takeFee(address from, uint256 amount)
        internal
        returns (uint256 feeAmount, uint256 netAmount)
    {
        _clearExpiredOverrideIfNeeded();

        // Launch mode:
        // If treasury is not set, JACK behaves like a normal zero-fee ERC20.
        if (treasury == address(0)) {
            return (0, amount);
        }

        uint256 feeBP_ = _getCurrentFeeBP();

        feeAmount = (amount * feeBP_) / BP_DIVISOR;

        unchecked {
            netAmount = amount - feeAmount;
        }

        if (feeAmount == 0) {
            return (0, netAmount);
        }

        uint256 configuredBurnShareBP_ = _getConfiguredBurnShareBP();
        uint256 burnPart = (feeAmount * configuredBurnShareBP_) / SHARE_DIVISOR;

        // Automatic fee burns must not push supply below 50M JACK.
        // If the burn floor is reached, the full fee goes to treasury.
        burnPart = _capAutomaticFeeBurn(burnPart);

        uint256 treasuryPart;

        unchecked {
            treasuryPart = feeAmount - burnPart;
        }

        if (burnPart > 0) {
            super._burn(from, burnPart);
            totalBurned += burnPart;
            emit Burn(from, burnPart);
        }

        if (treasuryPart > 0) {
            super._transfer(from, treasury, treasuryPart);

            // Keep transfers safe even if treasury accounting has a bug.
            // Treasury's own outgoing transfers are not counted as new fee income.
            if (from != treasury) {
                try IJackTreasury(treasury).pushFee(treasuryPart) {} catch {}
            }
        }

        return (feeAmount, netAmount);
    }

    function _capAutomaticFeeBurn(uint256 proposedBurnAmount)
        internal
        view
        returns (uint256)
    {
        if (proposedBurnAmount == 0) {
            return 0;
        }

        uint256 currentSupply = totalSupply();

        if (currentSupply <= BURN_STOP_SUPPLY) {
            return 0;
        }

        uint256 burnRoom = currentSupply - BURN_STOP_SUPPLY;

        if (proposedBurnAmount > burnRoom) {
            return burnRoom;
        }

        return proposedBurnAmount;
    }

    function _clearExpiredOverrideIfNeeded() internal {
        if (overrideUntil != 0 && block.timestamp >= overrideUntil) {
            overrideFeeBP = 0;
            overrideUntil = 0;
            emit FeeOverrideExpired();
        }
    }

    // =============================================================
    // FEE CALCULATIONS
    // =============================================================

    function _getCurrentFeeBP() internal view returns (uint256) {
        if (treasury == address(0)) {
            return 0;
        }

        if (overrideUntil != 0 && block.timestamp < overrideUntil) {
            return overrideFeeBP;
        }

        if (treasuryTarget == 0) {
            return minFeeBP;
        }

        uint256 bal = balanceOf(treasury);

        if (bal >= treasuryTarget) {
            return minFeeBP;
        }

        if (maxFeeBP <= minFeeBP) {
            return minFeeBP;
        }

        uint256 progress = (bal * BP_DIVISOR) / treasuryTarget;
        uint256 decay = ((maxFeeBP - minFeeBP) * progress) / BP_DIVISOR;

        return maxFeeBP - decay;
    }

    function _getConfiguredBurnShareBP() internal view returns (uint256) {
        if (treasury == address(0)) {
            return 0;
        }

        if (treasuryTarget == 0) {
            return endBurnShareBP;
        }

        uint256 bal = balanceOf(treasury);

        if (bal >= treasuryTarget) {
            return endBurnShareBP;
        }

        if (endBurnShareBP <= startBurnShareBP) {
            return endBurnShareBP;
        }

        uint256 progress = (bal * SHARE_DIVISOR) / treasuryTarget;
        uint256 add = ((endBurnShareBP - startBurnShareBP) * progress) / SHARE_DIVISOR;

        return startBurnShareBP + add;
    }

    function _getEffectiveBurnShareBP() internal view returns (uint256) {
        if (treasury == address(0)) {
            return 0;
        }

        if (totalSupply() <= BURN_STOP_SUPPLY) {
            return 0;
        }

        return _getConfiguredBurnShareBP();
    }

    // =============================================================
    // PUBLIC VIEWS
    // =============================================================

    function getCurrentFeeBP() external view returns (uint256) {
        return _getCurrentFeeBP();
    }

    function getCurrentBurnShareBP() external view returns (uint256) {
        return _getEffectiveBurnShareBP();
    }

    function getConfiguredBurnShareBP() external view returns (uint256) {
        return _getConfiguredBurnShareBP();
    }

    function isTreasurySet() external view returns (bool) {
        return treasury != address(0);
    }

    function getTreasuryBalance() external view returns (uint256) {
        if (treasury == address(0)) {
            return 0;
        }

        return balanceOf(treasury);
    }

    function isFeeActive() external view returns (bool) {
        return treasury != address(0) && _getCurrentFeeBP() > 0;
    }

    function isAutomaticFeeBurnActive() external view returns (bool) {
        return treasury != address(0) && totalSupply() > BURN_STOP_SUPPLY;
    }

    function getFeeBurnRoom() external view returns (uint256) {
        uint256 currentSupply = totalSupply();

        if (currentSupply <= BURN_STOP_SUPPLY) {
            return 0;
        }

        return currentSupply - BURN_STOP_SUPPLY;
    }

    function getNextMintTimestamp() external view returns (uint256) {
        return lastMintTimestamp + MINT_INTERVAL;
    }

    function isMintReady() external view returns (bool) {
        return block.timestamp >= lastMintTimestamp + MINT_INTERVAL;
    }

    function getFeeConfig()
        external
        view
        returns (
            uint256 currentTreasuryTarget,
            uint256 currentMaxFeeBP,
            uint256 currentMinFeeBP,
            uint256 currentStartBurnShareBP,
            uint256 currentEndBurnShareBP,
            uint256 currentFeeBP,
            uint256 configuredBurnShareBP,
            uint256 effectiveBurnShareBP
        )
    {
        return (
            treasuryTarget,
            maxFeeBP,
            minFeeBP,
            startBurnShareBP,
            endBurnShareBP,
            _getCurrentFeeBP(),
            _getConfiguredBurnShareBP(),
            _getEffectiveBurnShareBP()
        );
    }

    function getMintStatus()
        external
        view
        returns (
            uint256 currentTotalBurned,
            uint256 currentLastMintTimestamp,
            uint256 nextMintTimestamp,
            uint256 mintableAmount,
            bool mintReady
        )
    {
        uint256 nextMint = lastMintTimestamp + MINT_INTERVAL;

        return (
            totalBurned,
            lastMintTimestamp,
            nextMint,
            getMintableAmount(),
            block.timestamp >= nextMint
        );
    }

    function previewFee(uint256 amount)
        external
        view
        returns (
            uint256 feeAmount,
            uint256 burnAmount,
            uint256 treasuryAmount,
            uint256 netAmount
        )
    {
        if (treasury == address(0)) {
            return (0, 0, 0, amount);
        }

        uint256 feeBP_ = _getCurrentFeeBP();

        feeAmount = (amount * feeBP_) / BP_DIVISOR;

        unchecked {
            netAmount = amount - feeAmount;
        }

        if (feeAmount == 0) {
            return (0, 0, 0, netAmount);
        }

        uint256 configuredBurnShareBP_ = _getConfiguredBurnShareBP();

        burnAmount = (feeAmount * configuredBurnShareBP_) / SHARE_DIVISOR;
        burnAmount = _capAutomaticFeeBurn(burnAmount);

        unchecked {
            treasuryAmount = feeAmount - burnAmount;
        }

        return (feeAmount, burnAmount, treasuryAmount, netAmount);
    }

    // =============================================================
    // FEE OVERRIDE CONTROL
    // =============================================================

    function setFeeOverride(uint256 feeBP, OverrideDuration duration) external onlyOwner {
        require(feeBP >= 1 && feeBP <= maxFeeBP, "Invalid fee");

        uint256 seconds_;

        if (duration == OverrideDuration.H24) {
            seconds_ = 1 days;
        } else if (duration == OverrideDuration.D7) {
            seconds_ = 7 days;
        } else if (duration == OverrideDuration.M1) {
            seconds_ = 30 days;
        } else if (duration == OverrideDuration.M3) {
            seconds_ = 90 days;
        } else if (duration == OverrideDuration.M6) {
            seconds_ = 180 days;
        } else {
            seconds_ = 365 days;
        }

        overrideFeeBP = feeBP;
        overrideUntil = block.timestamp + seconds_;

        emit FeeOverrideActivated(feeBP, overrideUntil);
    }

    function clearExpiredOverride() external {
        _clearExpiredOverrideIfNeeded();
    }

    // =============================================================
    // BURN / MINT
    // =============================================================

    function burn(uint256 amount) external {
        super._burn(_msgSender(), amount);
        totalBurned += amount;
        emit Burn(_msgSender(), amount);
    }

    function mint() external onlyTreasuryOrAllowed {
        uint256 mintAmount = getMintableAmount();

        require(mintAmount > 0, "Nothing to mint");

        _mint(msg.sender, mintAmount);

        totalBurned -= mintAmount;
        lastMintTimestamp = block.timestamp;
    }

    function getMintableAmount() public view returns (uint256) {
        if (block.timestamp < lastMintTimestamp + MINT_INTERVAL) {
            return 0;
        }

        uint256 mintAmount = (totalBurned * 5) / 100;

        if (mintAmount == 0) {
            return 0;
        }

        uint256 current = totalSupply();

        if (current >= MAX_SUPPLY) {
            return 0;
        }

        uint256 remaining = MAX_SUPPLY - current;

        if (mintAmount > remaining) {
            return remaining;
        }

        return mintAmount;
    }

    // =============================================================
    // OWNER / ADMIN
    // =============================================================

    function adminMint(uint256 amount) external onlyOwner {
        require(amount > 0, "Zero amount");
        require(amount <= totalBurned, "Exceeds burn credit");

        uint256 current = totalSupply();

        require(current < MAX_SUPPLY, "Max supply reached");

        uint256 remaining = MAX_SUPPLY - current;

        require(amount <= remaining, "Exceeds max supply");

        _mint(owner(), amount);

        totalBurned -= amount;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        require(newTreasury.code.length > 0, "Treasury must be contract");

        if (treasury != address(0)) {
            allowedContracts[treasury] = false;
            emit AllowedContractUpdated(treasury, false);
        }

        emit TreasuryUpdated(treasury, newTreasury);

        treasury = newTreasury;

        allowedContracts[newTreasury] = true;
        emit AllowedContractUpdated(newTreasury, true);
    }

    function unsetTreasury() external onlyOwner {
        require(treasury != address(0), "Treasury not set");

        allowedContracts[treasury] = false;
        emit AllowedContractUpdated(treasury, false);

        emit TreasuryUpdated(treasury, address(0));

        treasury = address(0);
    }

    function setAllowedContract(address account, bool allowed) external onlyOwner {
        require(account != address(0), "Zero address");

        if (allowed) {
            require(account.code.length > 0, "Not contract");
        }

        allowedContracts[account] = allowed;

        emit AllowedContractUpdated(account, allowed);
    }

    function removeAllowedContract(address account) external onlyOwner {
        require(account != address(0), "Zero address");

        allowedContracts[account] = false;

        emit AllowedContractUpdated(account, false);
    }

    function setTreasuryTarget(uint256 wholeTokenAmount) external onlyOwner {
        require(wholeTokenAmount > 0, "target=0");

        uint256 unit = 10 ** decimals();

        require(wholeTokenAmount <= MAX_SUPPLY / unit, "target too high");

        _setTreasuryTarget(wholeTokenAmount * unit);
    }

    function _setTreasuryTarget(uint256 newTreasuryTarget) internal {
        require(newTreasuryTarget > 0, "target=0");
        require(newTreasuryTarget <= MAX_SUPPLY, "target too high");

        uint256 oldTreasuryTarget = treasuryTarget;

        treasuryTarget = newTreasuryTarget;

        emit TreasuryTargetUpdated(oldTreasuryTarget, newTreasuryTarget);
    }

    // Treasury uses this later when the full ecosystem is live.
    // _treasuryTarget must include decimals here because this function is for contract-level calls.
    function setDynamicFeeConfig(
        uint256 _treasuryTarget,
        uint256 _maxFeeBP,
        uint256 _minFeeBP,
        uint256 _startBurnShareBP,
        uint256 _endBurnShareBP
    ) external onlyTreasury {
        require(_treasuryTarget > 0, "target=0");
        require(_treasuryTarget <= MAX_SUPPLY, "target too high");
        require(_maxFeeBP >= _minFeeBP, "max<min");
        require(_maxFeeBP <= 1_000_000, "fee too high");
        require(_endBurnShareBP <= SHARE_DIVISOR, "share too high");
        require(_startBurnShareBP <= _endBurnShareBP, "start>end");

        uint256 oldTreasuryTarget = treasuryTarget;

        treasuryTarget = _treasuryTarget;
        maxFeeBP = _maxFeeBP;
        minFeeBP = _minFeeBP;
        startBurnShareBP = _startBurnShareBP;
        endBurnShareBP = _endBurnShareBP;

        if (oldTreasuryTarget != _treasuryTarget) {
            emit TreasuryTargetUpdated(oldTreasuryTarget, _treasuryTarget);
        }

        emit DynamicFeeConfigUpdated(
            treasuryTarget,
            maxFeeBP,
            minFeeBP,
            startBurnShareBP,
            endBurnShareBP
        );
    }
}