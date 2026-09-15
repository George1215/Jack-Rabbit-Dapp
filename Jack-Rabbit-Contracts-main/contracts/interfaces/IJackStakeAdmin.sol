// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IJackTreasury.sol";

interface IJackStakeAdmin {
    // ========= Constants / Core =========

    function PLS() external pure returns (address);

    function MIN_REWARD_FEE_BP() external pure returns (uint256);
    function MAX_REWARD_FEE_BP() external pure returns (uint256);
    function DEFAULT_JACK_REWARD_FEE_BP() external pure returns (uint256);
    function DEFAULT_EXTERNAL_REWARD_FEE_BP() external pure returns (uint256);

    function treasury() external view returns (IJackTreasury);
    function jack() external view returns (address);

    // ========= Pause =========

    function pause() external;
    function unpause() external;
    function paused() external view returns (bool);

    // ========= Treasury =========

    function setTreasury(IJackTreasury _newTreasury) external;

    // ========= Emissions =========

    function setEmissionRatePpm(address token, uint256 newPpm) external;
    function emissionRatePpm(address token) external view returns (uint256);

    // ========= Pools / Reward Tokens =========

    // Correct function name is addPool, not AddPool.
    function addPool(address[] calldata tokens) external;

    function endExternalPool(address token) external;

    function setExternalPoolActive(address token, bool active) external;

    function delistExternalPool(address token) external;

    function removeAsRewardToken(address token) external;

    function addBackAsRewardToken(address token) external;

    function isExternalPool(address token) external view returns (bool);

    function isExternalPoolActive(address token) external view returns (bool);

    function isRewardToken(address token) external view returns (bool);

    function isRewardTokenActive(address token) external view returns (bool);

    function isRemovedToken(address token) external view returns (bool);

    function poolEpoch(address token) external view returns (uint256);

    function getPoolEpoch(address token) external view returns (uint256);

    function getExternalPools() external view returns (address[] memory);

    function getExternalPoolCount() external view returns (uint256);

    function getExternalPoolAt(uint256 index) external view returns (address);

    function getRewardTokens() external view returns (address[] memory);

    function getRewardTokenCount() external view returns (uint256);

    function getRewardTokenAt(uint256 index) external view returns (address);

    // ========= Fee Recipients / Sinks =========

    function jackFeeSink() external view returns (address);

    function setJackFeeSink(address _sink) external;

    // Legacy recipient. In the updated JackStake, this follows externalFeeRewardRecipient.
    function adminFeeRecipient() external view returns (address);

    function setAdminFeeRecipient(address _recipient) external;

    // New JACK reward fee recipient.
    // Receives fee taken from JACK rewards before JACK is split among external pools.
    function jackFeeRewardRecipient() external view returns (address);

    function setJackFeeRewardRecipient(address _recipient) external;

    // New external-token reward fee recipient.
    // Receives fee taken from external rewards before JACK stakers receive them.
    function externalFeeRewardRecipient() external view returns (address);

    function setExternalFeeRewardRecipient(address _recipient) external;

    // ========= Manual Reward Fee Percentages =========

    function jackRewardFeeBp() external view returns (uint256);

    function externalRewardFeeBp() external view returns (uint256);

    function setRewardFeeBps(uint256 newJackRewardFeeBp, uint256 newExternalRewardFeeBp) external;

    function setJackRewardFeeBp(uint256 newFeeBp) external;

    function setExternalRewardFeeBp(uint256 newFeeBp) external;

    function getRewardFeeConfig()
        external
        view
        returns (
            address jackRecipient,
            address externalRecipient,
            uint256 jackFeeBp,
            uint256 externalFeeBp
        );

    // ========= Reward Injection / Sync =========

    function injectExternalStakersReward(uint256 amount) external;

    function injectJackStakersReward(address token, uint256 amount) external payable;

    // Sync direct token/PLS transfers.
    // JACK -> externalJackRewardReserve.
    // Reward token -> JACK-staker reward stream reserve.
    // Unsupported token -> returns 0.
    function syncRewardToken(address token) external returns (uint256 amountSynced);

    function getSyncableRewardAmount(address token) external view returns (uint256);

    // ========= Keeper / Update Functions =========

    function updateExternalPool(address token) external;

    function updateJackRewardToken(address token) external;

    function updateManyExternalPools(address[] calldata tokens) external;

    function updateManyJackRewardTokens(address[] calldata tokens) external;

    // ========= Admin Withdrawal / Reserve Management =========

    function withdrawExternalJackRewardReserve(uint256 amount, address to) external;

    function sendExternalJackRewardReserveToTreasury(uint256 amount) external;

    function withdrawJackStakerRewardReserve(address token, uint256 amount, address to) external;

    // Now withdraws only untracked surplus, not protected user stake or tracked rewards.
    function adminWithdrawRewardReserve(address token, uint256 amount, address to) external;

    // ========= Balance / Reserve Views =========

    function trackedBalance(address token) external view returns (uint256);

    function getTrackedBalance(address token) external view returns (uint256);

    function getUntrackedBalance(address token) external view returns (uint256);

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

    // ========= Ownership =========

    function owner() external view returns (address);

    function transferOwnership(address newOwner) external;

    function renounceOwnership() external;
}