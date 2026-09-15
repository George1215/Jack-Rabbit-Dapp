// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IJackStake {
    // ========= Constants / Core Addresses =========

    function PLS() external pure returns (address);

    function BP_DIVISOR() external pure returns (uint256);
    function ACC_PRECISION() external pure returns (uint256);
    function PPM_DIVISOR() external pure returns (uint256);
    function MAX_EMISSION_PPM() external pure returns (uint256);
    function DEFAULT_EMISSION_PPM() external pure returns (uint256);
    function DAY() external pure returns (uint256);

    function JACK_STAKE_TOTAL_FEE_BP() external pure returns (uint256);
    function JACK_STAKE_TREASURY_FEE_BP() external pure returns (uint256);
    function JACK_STAKE_SINK_FEE_BP() external pure returns (uint256);

    function MIN_REWARD_FEE_BP() external pure returns (uint256);
    function MAX_REWARD_FEE_BP() external pure returns (uint256);
    function DEFAULT_JACK_REWARD_FEE_BP() external pure returns (uint256);
    function DEFAULT_EXTERNAL_REWARD_FEE_BP() external pure returns (uint256);

    function jack() external view returns (address);
    function treasury() external view returns (address);

    // ========= Reward Fee Config Views =========

    function jackFeeRewardRecipient() external view returns (address);
    function externalFeeRewardRecipient() external view returns (address);
    function adminFeeRecipient() external view returns (address);
    function jackFeeSink() external view returns (address);

    function jackRewardFeeBp() external view returns (uint256);
    function externalRewardFeeBp() external view returns (uint256);

    function getRewardFeeConfig()
        external
        view
        returns (
            address jackRecipient,
            address externalRecipient,
            uint256 jackFeeBp,
            uint256 externalFeeBp
        );

    // ========= Balance / Sync Tracking =========

    function trackedBalance(address token) external view returns (uint256);

    function getTrackedBalance(address token) external view returns (uint256);

    function getUntrackedBalance(address token) external view returns (uint256);

    function getSyncableRewardAmount(address token) external view returns (uint256);

    // Public sync function.
    // JACK -> externalJackRewardReserve.
    // Reward token -> JACK-staker reward stream reserve.
    // Unsupported token -> returns 0.
    function syncRewardToken(address token) external returns (uint256 amountSynced);

    // ========= External Staking: stake external token -> earn JACK =========

    function stakeExternalToken(address token, uint256 amount) external payable;

    function unstakeExternalToken(address token, uint256 amount) external;

    function claimJackAsReward(address token) external;

    // ========= JACK Staking: stake JACK -> earn external rewards =========

    function stakeJackToken(uint256 amount) external;

    function unstakeJackToken(uint256 amount) external;

    function claimExternalTokenAsReward(address rewardToken) external;

    // ========= Public Reward Injection =========

    function injectJackStakersReward(address token, uint256 amount) external payable;

    function injectExternalStakersReward(uint256 amount) external;

    // ========= Pause View =========

    function paused() external view returns (bool);

    // ========= Emission Views =========

    function emissionRatePpm(address token) external view returns (uint256);

    // ========= External Pool Views =========

    function isExternalPool(address token) external view returns (bool);

    function isExternalPoolActive(address token) external view returns (bool);

    function getExternalPools() external view returns (address[] memory);

    function getExternalPoolCount() external view returns (uint256);

    function getExternalPoolAt(uint256 index) external view returns (address);

    function poolEpoch(address token) external view returns (uint256);

    function getPoolEpoch(address token) external view returns (uint256);

    // ========= Reward Token Views =========

    function isRewardToken(address token) external view returns (bool);

    function isRewardTokenActive(address token) external view returns (bool);

    function isRemovedToken(address token) external view returns (bool);

    function getRewardTokens() external view returns (address[] memory);

    function getRewardTokenCount() external view returns (uint256);

    function getRewardTokenAt(uint256 index) external view returns (address);

    // ========= Public Keeper / Update Functions =========

    function updateExternalPool(address token) external;

    function updateJackRewardToken(address token) external;

    function updateManyExternalPools(address[] calldata tokens) external;

    function updateManyJackRewardTokens(address[] calldata tokens) external;

    // ========= Reward Accounting / Reserve Views =========

    function externalJackRewardReserve() external view returns (uint256);

    function lastExternalRewardUpdate() external view returns (uint256);

    function getExternalJackRewardReserve() external view returns (uint256);

    function getUnassignedJackRewardPool() external view returns (uint256);

    function getRewardStreamReserve(address token) external view returns (uint256);

    function getExternalPoolJackReserve(address token) external pure returns (uint256);

    function getAllJackStakerRewardReserves()
        external
        view
        returns (address[] memory tokens, uint256[] memory reserves);

    function getExternalRewardsOverview()
        external
        view
        returns (
            uint256 reserve,
            uint256 lastUpdate,
            uint256 activePools,
            uint256 ppm
        );

    function getJackStakerRewardOverview(address token)
        external
        view
        returns (
            uint256 reserve,
            uint256 lastUpdate,
            uint256 ppm,
            bool active
        );

    function getJackRewardStreamInfo(address token)
        external
        view
        returns (
            uint256 accRewardPerShare,
            uint256 lastUpdate,
            uint256 reserve
        );

    function getExternalPoolInfo(address token)
        external
        view
        returns (
            uint256 totalStaked,
            uint256 accJackPerShare,
            uint256 lastUpdate,
            uint256 jackReserve,
            uint256 epoch
        );

    // ========= Pending Reward Views =========

    function pendingJack(address token, address user) external view returns (uint256);

    function pendingExternalReward(address rewardToken, address user) external view returns (uint256);

    // ========= Basic Stake Views =========

    function totalStakedExternal(address token) external view returns (uint256);

    function userStakeExternal(address token, address user) external view returns (uint256);

    function totalStakedJack() external view returns (uint256);

    function userStakeJack(address user) external view returns (uint256);

    function getUserJackStake(address user) external view returns (uint256);

    // ========= Stored Pending Reward Views =========

    function storedPendingJack(address poolToken, address user) external view returns (uint256);

    function storedPendingExternalReward(address user, address rewardToken) external view returns (uint256);

    function jackRewardDebt(address user, address rewardToken) external view returns (uint256);

    // ========= Ownership View Only =========

    function owner() external view returns (address);
}