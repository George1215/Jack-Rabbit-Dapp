// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IJack {
    // =============================================================
    // ENUMS
    // =============================================================

    enum OverrideDuration {
        H24,
        D7,
        M1,
        M3,
        M6,
        Y1
    }

    // =============================================================
    // ERC20 EVENTS
    // =============================================================

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // =============================================================
    // OWNERSHIP EVENTS
    // =============================================================

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // =============================================================
    // JACK EVENTS
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
    // ERC20 METADATA
    // =============================================================

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint8);

    // =============================================================
    // ERC20 BASICS
    // =============================================================

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function allowance(address owner, address spender) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    // =============================================================
    // OWNERSHIP
    // =============================================================

    function owner() external view returns (address);

    function transferOwnership(address newOwner) external;

    function renounceOwnership() external;

    // =============================================================
    // JACK CONSTANTS
    // =============================================================

    function BP_DIVISOR() external view returns (uint256);

    function SHARE_DIVISOR() external view returns (uint256);

    function MAX_SUPPLY() external view returns (uint256);

    function BURN_STOP_SUPPLY() external view returns (uint256);

    function MINT_INTERVAL() external view returns (uint256);

    // =============================================================
    // TREASURY STATE
    // =============================================================

    function treasury() external view returns (address);

    function treasuryTarget() external view returns (uint256);

    // =============================================================
    // BURN / MINT TRACKING
    // =============================================================

    function totalBurned() external view returns (uint256);

    function lastMintTimestamp() external view returns (uint256);

    function getMintableAmount() external view returns (uint256);

    // =============================================================
    // DYNAMIC FEE MODEL
    // =============================================================

    function maxFeeBP() external view returns (uint256);

    function minFeeBP() external view returns (uint256);

    function startBurnShareBP() external view returns (uint256);

    function endBurnShareBP() external view returns (uint256);

    function getCurrentFeeBP() external view returns (uint256);

    function getCurrentBurnShareBP() external view returns (uint256);

    function getConfiguredBurnShareBP() external view returns (uint256);

    function isAutomaticFeeBurnActive() external view returns (bool);

    function getFeeBurnRoom() external view returns (uint256);

    // =============================================================
    // FEE OVERRIDE STATE
    // =============================================================

    function overrideFeeBP() external view returns (uint256);

    function overrideUntil() external view returns (uint256);

    // =============================================================
    // CONTRACT ACCESS
    // =============================================================

    function allowedContracts(address account) external view returns (bool);

    // =============================================================
    // BURN / MINT
    // =============================================================

    function burn(uint256 amount) external;

    function mint() external;

    function adminMint(uint256 amount) external;

    // =============================================================
    // OWNER / ADMIN FUNCTIONS
    // =============================================================

    function setTreasury(address newTreasury) external;

    function unsetTreasury() external;

    function setAllowedContract(address account, bool allowed) external;

    // Takes whole JACK amount, not 18-decimal raw units.
    // Example: setTreasuryTarget(1000000) = 1,000,000 JACK.
    function setTreasuryTarget(uint256 wholeTokenAmount) external;

    function setFeeOverride(uint256 feeBP, OverrideDuration duration) external;

    function clearExpiredOverride() external;

    // =============================================================
    // TREASURY-ONLY CONFIG
    // =============================================================

    // _treasuryTarget must include decimals here because treasury contracts call this directly.
    function setDynamicFeeConfig(
        uint256 _treasuryTarget,
        uint256 _maxFeeBP,
        uint256 _minFeeBP,
        uint256 _startBurnShareBP,
        uint256 _endBurnShareBP
    ) external;
}
