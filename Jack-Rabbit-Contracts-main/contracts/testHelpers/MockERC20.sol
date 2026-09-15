// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals = 18;

    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
    }

    function mint(address to, uint256 amount) external {
        require(to != address(0), "ZERO_TO");

        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function transfer(address to, uint256 amount) public virtual returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public virtual returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "ALLOWANCE_LOW");

        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }

        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal virtual {
        require(to != address(0), "ZERO_TO");
        require(balanceOf[from] >= amount, "BALANCE_LOW");

        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

contract FeeOnTransferERC20 is MockERC20 {
    uint256 public feeBps;
    address public feeReceiver;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 feeBps_,
        address feeReceiver_
    ) MockERC20(name_, symbol_) {
        require(feeBps_ <= 2_000, "FEE_TOO_HIGH");
        require(feeReceiver_ != address(0), "ZERO_FEE_RECEIVER");

        feeBps = feeBps_;
        feeReceiver = feeReceiver_;
    }

    function _transfer(address from, address to, uint256 amount) internal override {
        require(to != address(0), "ZERO_TO");
        require(balanceOf[from] >= amount, "BALANCE_LOW");

        uint256 fee = (amount * feeBps) / 10_000;
        uint256 received = amount - fee;

        balanceOf[from] -= amount;
        balanceOf[to] += received;

        if (fee > 0) {
            balanceOf[feeReceiver] += fee;
        }
    }
}