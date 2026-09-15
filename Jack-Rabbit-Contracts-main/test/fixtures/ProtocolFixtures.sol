// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TestToken is ERC20 {
    uint256 public feeBps;
    bool public extraSenderFee;

    constructor() ERC20("Test asset", "TEST") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function confiscate(address from, uint256 amount) external { _burn(from, amount); }
    function setFee(uint256 bps, bool extra) external { feeBps = bps; extraSenderFee = extra; }

    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0) && to != address(0) && feeBps != 0) {
            uint256 fee = amount * feeBps / 10_000;
            super._update(from, address(0), fee);
            super._update(from, to, extraSenderFee ? amount : amount - fee);
        } else {
            super._update(from, to, amount);
        }
    }
}

contract TestTreasury {
    uint256 public totalJackIncomeFiveYears;
    uint256 public treasuryPdaiReserves;
    address public pdai;
    mapping(address => uint256) public received;

    function setPdai(address token) external { pdai = token; }
    function getJackIncomeForDay(uint256) external pure returns (uint256) { return 0; }
    function getCurrentDay() external view returns (uint256) { return block.timestamp / 1 days; }
    function pushFee(uint256) external {}
    function depositPdaiReserve(uint256 amount) external {
        require(IERC20(pdai).transferFrom(msg.sender, address(this), amount));
        treasuryPdaiReserves += amount;
    }
    function depositLpToken(address token, uint256 amount) external {
        require(IERC20(token).transferFrom(msg.sender, address(this), amount));
        received[token] += amount;
    }
    function depositJackReserve(uint256) external pure { revert("not used"); }
    function receiveFunds(address token, uint256 amount) external payable {
        if (token == address(0)) require(msg.value == amount);
        else {
            require(msg.value == 0);
            require(IERC20(token).transferFrom(msg.sender, address(this), amount));
        }
        received[token] += amount;
        if (token == pdai) treasuryPdaiReserves += amount;
    }
}

contract TestOracle {
    function quotePdaiToJack(uint256 amount) external pure returns (uint256) { return amount; }
    function isReady() external pure returns (bool) { return true; }
    function isStale() external pure returns (bool) { return false; }
    function liquidityOk() external pure returns (bool) { return true; }
    function updateIfNeeded() external pure returns (bool) { return false; }
}

contract RejectNative {
    receive() external payable { revert("reject native"); }
}

contract ReenterNative {
    address public target;
    bytes public payload;
    bool public attempted;
    bool public succeeded;
    function configure(address target_, bytes calldata payload_) external {
        target = target_;
        payload = payload_;
    }
    receive() external payable {
        if (!attempted) {
            attempted = true;
            (succeeded,) = target.call(payload);
        }
    }
}

contract NoPullFarm {
    function depositReward(address, uint256 amount) external pure returns (uint256) {
        return amount; // Lies about receiving funds; used only in adversarial tests.
    }
}

contract MaintenancePair {
    address public immutable token0;
    address public immutable token1;
    uint32 public immutable timestamp;
    uint256 public constant price0CumulativeLast = 0;
    uint256 public constant price1CumulativeLast = 0;
    constructor(address a, address b) { token0 = a; token1 = b; timestamp = uint32(block.timestamp); }
    function getReserves() external view returns (uint112, uint112, uint32) {
        return (1_000_000 ether, 1_000_000 ether, timestamp);
    }
}

/// @dev AMM fixture that accrues old reserve prices before a reserve change.
contract MutableMaintenancePair {
    address public immutable token0;
    address public immutable token1;
    uint112 private reserve0 = 1_000_000 ether;
    uint112 private reserve1 = 1_000_000 ether;
    uint32 private timestamp;
    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;
    constructor(address a, address b) { token0 = a; token1 = b; timestamp = uint32(block.timestamp); }
    function getReserves() external view returns (uint112, uint112, uint32) { return (reserve0, reserve1, timestamp); }
    function setReserves(uint112 a, uint112 b) external {
        require(a > 0 && b > 0);
        uint32 elapsed;
        unchecked { elapsed = uint32(block.timestamp) - timestamp; }
        price0CumulativeLast += ((uint256(reserve1) << 112) / reserve0) * elapsed;
        price1CumulativeLast += ((uint256(reserve0) << 112) / reserve1) * elapsed;
        reserve0 = a; reserve1 = b; timestamp = uint32(block.timestamp);
    }
}
