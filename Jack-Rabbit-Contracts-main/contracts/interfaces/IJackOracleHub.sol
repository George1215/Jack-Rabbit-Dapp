// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IJackOracleHub {
    // =============================================================
    // STRUCTS
    // =============================================================

    struct PairConfig {
        bool exists;
        bool enabled;
        address pair;
        address token0;
        address token1;
        uint256 minReserve0;
        uint256 minReserve1;
        uint256 minUpdatePeriod;
        uint256 maxTwapStaleness;
        uint256 maxTwapDeviationBps;
        uint256 weightBps;
    }

    struct PairOracle {
        uint256 price0CumulativeLast;
        uint256 price1CumulativeLast;
        uint32 blockTimestampLast;
        uint256 price0AverageX112;
        uint256 price1AverageX112;
        uint256 lastSuccessfulUpdate;
    }

    struct PairSnapshot {
        uint256 price0Cumulative;
        uint256 price1Cumulative;
        uint32 blockTimestamp;
        uint112 reserve0;
        uint112 reserve1;
    }

    struct PairHealth {
        bool exists;
        bool enabled;
        bool ready;
        bool stale;
        bool reservesOk;
        bool canUpdateNow;
        uint256 reserve0;
        uint256 reserve1;
        uint256 minReserve0;
        uint256 minReserve1;
        uint256 lastSuccessfulUpdate;
        uint256 secondsSinceLastUpdate;
        uint256 secondsUntilNextUpdate;
        uint256 price0AverageX112;
        uint256 price1AverageX112;
        uint256 weightBps;
    }

    struct RouteQuote {
        bool routeOk;
        bool healthy;
        uint256 amountIn;
        uint256 expectedOut;
        uint256 idealOut;
        uint256 slippageBps;
        uint256 maxSafeAmountIn;
        uint256 routeIndex;
    }

    // =============================================================
    // EVENTS
    // =============================================================

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address account);
    event Unpaused(address account);

    event PairAdded(
        address indexed pair,
        address indexed token0,
        address indexed token1,
        uint256 minReserve0,
        uint256 minReserve1
    );

    event PairUpdated(
        address indexed pair,
        uint256 price0AverageX112,
        uint256 price1AverageX112,
        uint256 updateTime
    );

    event PairConfigUpdated(
        address indexed pair,
        bool enabled,
        uint256 minReserve0,
        uint256 minReserve1,
        uint256 minUpdatePeriod,
        uint256 maxTwapStaleness,
        uint256 maxTwapDeviationBps,
        uint256 weightBps
    );

    event RouteAdded(
        address indexed tokenIn,
        uint256 indexed routeIndex,
        address[] path,
        uint256 maxSlippageBps
    );

    event RouteUpdated(
        address indexed tokenIn,
        uint256 indexed routeIndex,
        bool enabled,
        uint256 maxSlippageBps
    );

    event GlobalSwapConfigUpdated(uint256 maxSwapSlippageBps, uint256 swapFeeBps);

    // =============================================================
    // CONSTANT / CORE GETTERS
    // =============================================================

    function BPS_DENOMINATOR() external view returns (uint256);
    function Q112() external view returns (uint256);

    function JACK() external view returns (address);
    function pDAI() external view returns (address);
    function owner() external view returns (address);
    function paused() external view returns (bool);

    function defaultMaxSwapSlippageBps() external view returns (uint256);
    function defaultSwapFeeBps() external view returns (uint256);

    // =============================================================
    // PAIR REGISTRY GETTERS
    // =============================================================

    function getTrackedPairs() external view returns (address[] memory);

    function trackedPairs(uint256 index) external view returns (address);

    function pairForTokens(address tokenA, address tokenB) external view returns (address);

    function pairConfig(address pair)
        external
        view
        returns (
            bool exists,
            bool enabled,
            address pairAddress,
            address token0,
            address token1,
            uint256 minReserve0,
            uint256 minReserve1,
            uint256 minUpdatePeriod,
            uint256 maxTwapStaleness,
            uint256 maxTwapDeviationBps,
            uint256 weightBps
        );

    function pairOracle(address pair)
        external
        view
        returns (
            uint256 price0CumulativeLast,
            uint256 price1CumulativeLast,
            uint32 blockTimestampLast,
            uint256 price0AverageX112,
            uint256 price1AverageX112,
            uint256 lastSuccessfulUpdate
        );

    // =============================================================
    // ROUTE GETTERS
    // =============================================================

    function routeCount(address tokenIn) external view returns (uint256);

    function getRouteToJack(address tokenIn, uint256 routeIndex)
        external
        view
        returns (
            bool exists,
            bool enabled,
            address[] memory path,
            uint256 maxSlippageBps
        );

    // =============================================================
    // PAIR MANAGEMENT
    // =============================================================

    function addTrackedPair(
        address pair,
        uint256 minReserve0,
        uint256 minReserve1,
        uint256 minUpdatePeriod,
        uint256 maxTwapStaleness,
        uint256 maxTwapDeviationBps,
        uint256 weightBps
    ) external;

    function setPairConfig(
        address pair,
        bool enabled,
        uint256 minReserve0,
        uint256 minReserve1,
        uint256 minUpdatePeriod,
        uint256 maxTwapStaleness,
        uint256 maxTwapDeviationBps,
        uint256 weightBps
    ) external;

    // =============================================================
    // ROUTE MANAGEMENT
    // =============================================================

    function addRouteToJack(
        address tokenIn,
        address[] calldata path,
        uint256 maxSlippageBps
    ) external;

    function setRouteConfig(
        address tokenIn,
        uint256 routeIndex,
        bool enabled,
        uint256 maxSlippageBps
    ) external;

    function setGlobalSwapConfig(
        uint256 newDefaultMaxSwapSlippageBps,
        uint256 newDefaultSwapFeeBps
    ) external;

    // =============================================================
    // UPDATE FUNCTIONS
    // =============================================================

    function updatePair(address pair) external returns (bool updated);

    function updatePairIfNeeded(address pair) external returns (bool updated);

    function forceUpdatePair(address pair) external returns (bool updated);

    function updateMany(address[] calldata pairs, uint256 maxPairs)
        external
        returns (uint256 updatedCount);

    function updateIfNeeded() external returns (bool updated);

    // =============================================================
    // BARROW-COMPATIBLE FUNCTIONS
    // =============================================================

    function quotePdaiToJack(uint256 pdaiAmount) external view returns (uint256 jackAmount);

    function isReady() external view returns (bool);

    function isStale() external view returns (bool);

    function liquidityOk() external view returns (bool);

    // =============================================================
    // QUOTE / ROUTE FUNCTIONS
    // =============================================================

    function quoteTokenToJack(address tokenIn, uint256 amountIn)
        external
        view
        returns (uint256 jackAmount);

    function bestRouteToJack(address tokenIn, uint256 amountIn)
        external
        view
        returns (
            uint256 bestRouteIndex,
            uint256 bestAmountOut,
            uint256 bestSafeAmountIn,
            uint256 bestSlippageBps
        );

    function quoteRoute(address tokenIn, uint256 routeIndex, uint256 amountIn)
        external
        view
        returns (RouteQuote memory q);

    function getValidatedTwapValue(address[] calldata path, uint256 amountIn) external view returns (uint256 value);

    function getExpectedOut(address[] calldata path, uint256 amountIn)
        external
        view
        returns (uint256 amountOut);

    function getExpectedSlippageBps(address[] calldata path, uint256 amountIn)
        external
        view
        returns (uint256 slippageBps);

    function getMaxSafeSwapIn(address[] calldata path, uint256 desiredAmountIn)
        external
        view
        returns (uint256 safeAmountIn);

    function isSwapHealthy(address[] calldata path, uint256 amountIn)
        external
        view
        returns (bool healthy);

    // =============================================================
    // PAIR HEALTH
    // =============================================================

    function getPairHealth(address pair) external view returns (PairHealth memory h);

    function pairReady(address pair) external view returns (bool);

    function pairStale(address pair) external view returns (bool);

    function pairLiquidityOk(address pair) external view returns (bool);

    function canUpdate(address pair) external view returns (bool);

    // =============================================================
    // OWNER CONTROLS
    // =============================================================

    function pause() external;

    function unpause() external;

    function transferOwnership(address newOwner) external;

    function renounceOwnership() external;
}