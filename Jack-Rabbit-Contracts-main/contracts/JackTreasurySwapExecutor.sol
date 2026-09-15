// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IJack.sol";
import "./interfaces/IWPLS.sol";
import "./interfaces/IPulseXRouter02.sol";
import "./interfaces/IJackOracleHub.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract JackTreasurySwapExecutor {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error NotOwner();
    error NotTreasury();
    error BadPath();
    error ZeroAmount();
    error RefundFailed();

    uint256 private constant MAX_BPS = 10_000;
    uint256 private constant DEFAULT_MIN_OUT_BPS = 9_900;
    uint256 private constant FEE_DIVISOR = 1_000_000_000;

    address public owner;
    address public treasury;

    IJack public immutable jackToken;
    IERC20 public immutable JACK;

    IPulseXRouter02 public router;
    IWPLS public wpls;
    IJackOracleHub public oracleHub;

    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event RouterUpdated(address indexed oldRouter, address indexed newRouter);
    event WplsUpdated(address indexed oldWpls, address indexed newWpls);
    event OracleHubUpdated(address indexed oldOracleHub, address indexed newOracleHub);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyTreasury() {
        if (msg.sender != treasury) revert NotTreasury();
        _;
    }

    constructor(
        address _jack,
        address _router,
        address _wpls,
        address _oracleHub,
        address _treasury,
        address _owner
    ) {
        if (
            _jack == address(0) ||
            _router == address(0) ||
            _wpls == address(0) ||
            _oracleHub == address(0) ||
            _treasury == address(0) ||
            _owner == address(0)
        ) revert ZeroAddress();

        jackToken = IJack(_jack);
        JACK = IERC20(_jack);

        router = IPulseXRouter02(_router);
        wpls = IWPLS(_wpls);
        oracleHub = IJackOracleHub(_oracleHub);
        treasury = _treasury;
        owner = _owner;

        emit OwnershipTransferred(address(0), _owner);
        emit TreasuryUpdated(address(0), _treasury);
        emit RouterUpdated(address(0), _router);
        emit WplsUpdated(address(0), _wpls);
        emit OracleHubUpdated(address(0), _oracleHub);
    }

    receive() external payable {}

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();

        address old = owner;
        owner = newOwner;

        emit OwnershipTransferred(old, newOwner);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();

        address old = treasury;
        treasury = newTreasury;

        emit TreasuryUpdated(old, newTreasury);
    }

    function setRouter(address newRouter) external onlyOwner {
        if (newRouter == address(0)) revert ZeroAddress();

        address old = address(router);
        router = IPulseXRouter02(newRouter);

        emit RouterUpdated(old, newRouter);
    }

    function setWPLS(address newWpls) external onlyOwner {
        if (newWpls == address(0)) revert ZeroAddress();

        address old = address(wpls);
        wpls = IWPLS(newWpls);

        emit WplsUpdated(old, newWpls);
    }

    function setOracleHub(address newOracleHub) external onlyOwner {
        if (newOracleHub == address(0)) revert ZeroAddress();

        address old = address(oracleHub);
        oracleHub = IJackOracleHub(newOracleHub);

        emit OracleHubUpdated(old, newOracleHub);
    }

    function executeERC20SwapToJack(
        address tokenIn,
        address[] calldata path,
        uint256 desiredAmountIn,
        address treasuryReceiver
    )
        external
        onlyTreasury
        returns (uint256 amountUsed, uint256 jackReceivedNet)
    {
        if (tokenIn == address(0)) revert BadPath();
        if (desiredAmountIn == 0) revert ZeroAmount();
        if (treasuryReceiver != treasury) revert NotTreasury();

        _requirePath(tokenIn, path);

        amountUsed = _safeAmount(path, desiredAmountIn);
        if (amountUsed == 0) return (0, 0);

        IERC20 token = IERC20(tokenIn);

        token.safeTransferFrom(msg.sender, address(this), amountUsed);

        token.forceApprove(address(router), 0);
        token.forceApprove(address(router), amountUsed);

        uint256 jackBefore = JACK.balanceOf(treasuryReceiver);
        uint256 minOut = _minOut(path, amountUsed);

        try router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountUsed,
            minOut,
            path,
            treasuryReceiver,
            block.timestamp
        ) {
            token.forceApprove(address(router), 0);

            uint256 jackAfter = JACK.balanceOf(treasuryReceiver);
            jackReceivedNet = jackAfter > jackBefore ? jackAfter - jackBefore : 0;

            return (amountUsed, jackReceivedNet);
        } catch {
            token.forceApprove(address(router), 0);

            uint256 remaining = token.balanceOf(address(this));
            if (remaining > 0) {
                token.safeTransfer(treasury, remaining);
            }

            return (0, 0);
        }
    }

    function executeNativeSwapToJack(
        address[] calldata path,
        address treasuryReceiver
    )
        external
        payable
        onlyTreasury
        returns (uint256 amountUsed, uint256 jackReceivedNet)
    {
        if (msg.value == 0) revert ZeroAmount();
        if (treasuryReceiver != treasury) revert NotTreasury();

        _requirePath(address(wpls), path);

        amountUsed = _safeAmount(path, msg.value);

        if (amountUsed == 0) {
            _refundNative(msg.value);
            return (0, 0);
        }

        if (amountUsed < msg.value) {
            _refundNative(msg.value - amountUsed);
        }

        wpls.deposit{value: amountUsed}();

        IERC20(address(wpls)).forceApprove(address(router), 0);
        IERC20(address(wpls)).forceApprove(address(router), amountUsed);

        uint256 jackBefore = JACK.balanceOf(treasuryReceiver);
        uint256 minOut = _minOut(path, amountUsed);

        try router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountUsed,
            minOut,
            path,
            treasuryReceiver,
            block.timestamp
        ) {
            IERC20(address(wpls)).forceApprove(address(router), 0);

            uint256 jackAfter = JACK.balanceOf(treasuryReceiver);
            jackReceivedNet = jackAfter > jackBefore ? jackAfter - jackBefore : 0;

            return (amountUsed, jackReceivedNet);
        } catch {
            IERC20(address(wpls)).forceApprove(address(router), 0);

            uint256 wrappedBalance = IERC20(address(wpls)).balanceOf(address(this));

            if (wrappedBalance > 0) {
                try wpls.withdraw(wrappedBalance) {
                    _refundNative(wrappedBalance);
                } catch {
                    IERC20(address(wpls)).safeTransfer(treasury, wrappedBalance);
                }
            }

            return (0, 0);
        }
    }

    function previewSafeAmount(
        address[] calldata path,
        uint256 desiredAmountIn
    ) external view returns (uint256 safeAmount) {
        return _safeAmount(path, desiredAmountIn);
    }

    function previewMinOut(
        address[] calldata path,
        uint256 amountIn
    ) external view returns (uint256 minOut) {
        return _minOut(path, amountIn);
    }

    function _safeAmount(
        address[] calldata path,
        uint256 desiredAmountIn
    ) internal view returns (uint256 safeAmount) {
        if (desiredAmountIn == 0) return 0;

        try oracleHub.getMaxSafeSwapIn(path, desiredAmountIn) returns (uint256 safeIn) {
            if (safeIn > desiredAmountIn) return desiredAmountIn;
            return safeIn;
        } catch {
            return 0;
        }
    }

    function _minOut(
        address[] calldata path,
        uint256 amountIn
    ) internal view returns (uint256) {
        if (amountIn == 0) return 1;

        try oracleHub.getExpectedOut(path, amountIn) returns (uint256 expectedOut) {
            if (expectedOut > 0) {
                return (expectedOut * DEFAULT_MIN_OUT_BPS) / MAX_BPS;
            }
        } catch {}

        try router.getAmountsOut(amountIn, path) returns (uint256[] memory amountsOut) {
            if (amountsOut.length > 0) {
                uint256 quoted = amountsOut[amountsOut.length - 1];
                return _minJackOutAfterFeeAndSlippage(quoted);
            }
        } catch {}

        return 1;
    }

    function _minJackOutAfterFeeAndSlippage(
        uint256 quoted
    ) internal view returns (uint256) {
        uint256 maxFeePPB = jackToken.maxFeeBP();
        uint256 quotedNet = (quoted * (FEE_DIVISOR - maxFeePPB)) / FEE_DIVISOR;

        return (quotedNet * DEFAULT_MIN_OUT_BPS) / MAX_BPS;
    }

    function _requirePath(address tokenIn, address[] calldata path) internal view {
        if (path.length < 2) revert BadPath();
        if (path[0] != tokenIn) revert BadPath();
        if (path[path.length - 1] != address(JACK)) revert BadPath();

        for (uint256 i = 0; i < path.length; i++) {
            if (path[i] == address(0)) revert BadPath();
            if (i > 0 && path[i] == path[i - 1]) revert BadPath();
        }
    }

    function _refundNative(uint256 amount) internal {
        if (amount == 0) return;

        (bool ok, ) = payable(treasury).call{value: amount}("");
        if (!ok) revert RefundFailed();
    }

    function rescueToken(address token, uint256 amount, address to) external onlyOwner {
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransfer(to, amount);
    }

    function rescueNative(uint256 amount, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert RefundFailed();
    }
}