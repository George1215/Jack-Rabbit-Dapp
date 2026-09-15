// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts@4.9.5/access/Ownable.sol";
import "@openzeppelin/contracts@4.9.5/security/Pausable.sol";
import "@openzeppelin/contracts@4.9.5/utils/math/Math.sol";

import "./interfaces/IUniswapV2LikePair.sol";

/*
    JackOracleHub.sol

    Shared oracle / safety hub for JACK ecosystem.

    Main purpose:
    - Track only approved JACK ecosystem LPs.
    - Support TWAP, spot, liquidity health, deviation checks.
    - Quote pDAI -> JACK for Barrow.
    - Help Treasury / Mining / Peg Engine decide safe swap amounts.
    - Avoid blind large swaps.
    - Let swap contracts only swap healthy amounts.

    Important:
    - This contract does NOT execute swaps.
    - Treasury / Mining / Peg Engine still use their own routers if needed.
    - This oracle only tells them:
        * whether a route is healthy
        * expected output
        * expected slippage
        * maximum safe amount to swap now
*/

contract JackOracleHub is Ownable, Pausable {
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant Q112 = 2 ** 112;

    address public immutable JACK;
    address public immutable pDAI;

    uint256 public defaultMaxSwapSlippageBps = 100; // 1%
    uint256 public defaultSwapFeeBps = 30; // 0.30% AMM assumption

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

    struct Route {
        bool exists;
        bool enabled;
        address[] path;
        uint256 maxSlippageBps;
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

    address[] public trackedPairs;
    mapping(address => PairConfig) public pairConfig;
    mapping(address => PairOracle) public pairOracle;

    mapping(address => mapping(address => address)) public pairForTokens;

    mapping(address => Route[]) private routesToJack;

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

    constructor(
        address _jack,
        address _pdai,
        address initialOwner
    ) {
        require(_jack != address(0), "JACK zero");
        require(_pdai != address(0), "pDAI zero");
        require(initialOwner != address(0), "owner zero");

        JACK = _jack;
        pDAI = _pdai;

        _transferOwnership(initialOwner);
    }

    // ------------------------------------------------------------
    // Pair management
    // ------------------------------------------------------------

    function addTrackedPair(
        address pair,
        uint256 minReserve0,
        uint256 minReserve1,
        uint256 minUpdatePeriod,
        uint256 maxTwapStaleness,
        uint256 maxTwapDeviationBps,
        uint256 weightBps
    ) external onlyOwner {
        require(pair != address(0), "pair zero");
        require(!pairConfig[pair].exists, "pair exists");
        require(minUpdatePeriod > 0, "period zero");
        require(maxTwapStaleness >= minUpdatePeriod, "bad staleness");
        require(maxTwapDeviationBps <= BPS_DENOMINATOR, "bad deviation");
        require(weightBps <= BPS_DENOMINATOR, "bad weight");

        address token0 = IUniswapV2LikePair(pair).token0();
        address token1 = IUniswapV2LikePair(pair).token1();

        require(token0 != address(0) && token1 != address(0), "bad tokens");

        // Only JACK LPs are accepted.
        require(token0 == JACK || token1 == JACK, "not JACK LP");

        PairSnapshot memory s = _currentCumulativePrices(pair);

        require(uint256(s.reserve0) >= minReserve0, "reserve0 low");
        require(uint256(s.reserve1) >= minReserve1, "reserve1 low");

        pairConfig[pair] = PairConfig({
            exists: true,
            enabled: true,
            pair: pair,
            token0: token0,
            token1: token1,
            minReserve0: minReserve0,
            minReserve1: minReserve1,
            minUpdatePeriod: minUpdatePeriod,
            maxTwapStaleness: maxTwapStaleness,
            maxTwapDeviationBps: maxTwapDeviationBps,
            weightBps: weightBps
        });

        pairOracle[pair] = PairOracle({
            price0CumulativeLast: s.price0Cumulative,
            price1CumulativeLast: s.price1Cumulative,
            blockTimestampLast: s.blockTimestamp,
            price0AverageX112: 0,
            price1AverageX112: 0,
            lastSuccessfulUpdate: 0
        });

        pairForTokens[token0][token1] = pair;
        pairForTokens[token1][token0] = pair;

        trackedPairs.push(pair);

        emit PairAdded(pair, token0, token1, minReserve0, minReserve1);
    }

    function setPairConfig(
        address pair,
        bool enabled,
        uint256 minReserve0,
        uint256 minReserve1,
        uint256 minUpdatePeriod,
        uint256 maxTwapStaleness,
        uint256 maxTwapDeviationBps,
        uint256 weightBps
    ) external onlyOwner {
        PairConfig storage cfg = pairConfig[pair];

        require(cfg.exists, "unknown pair");
        require(minUpdatePeriod > 0, "period zero");
        require(maxTwapStaleness >= minUpdatePeriod, "bad staleness");
        require(maxTwapDeviationBps <= BPS_DENOMINATOR, "bad deviation");
        require(weightBps <= BPS_DENOMINATOR, "bad weight");

        cfg.enabled = enabled;
        cfg.minReserve0 = minReserve0;
        cfg.minReserve1 = minReserve1;
        cfg.minUpdatePeriod = minUpdatePeriod;
        cfg.maxTwapStaleness = maxTwapStaleness;
        cfg.maxTwapDeviationBps = maxTwapDeviationBps;
        cfg.weightBps = weightBps;

        emit PairConfigUpdated(
            pair,
            enabled,
            minReserve0,
            minReserve1,
            minUpdatePeriod,
            maxTwapStaleness,
            maxTwapDeviationBps,
            weightBps
        );
    }

    function getTrackedPairs() external view returns (address[] memory) {
        return trackedPairs;
    }

    // ------------------------------------------------------------
    // Route management
    // ------------------------------------------------------------

    function addRouteToJack(
        address tokenIn,
        address[] calldata path,
        uint256 maxSlippageBps
    ) external onlyOwner {
        require(tokenIn != address(0), "token zero");
        require(path.length >= 2, "path short");
        require(path[0] == tokenIn, "bad path start");
        require(path[path.length - 1] == JACK, "bad path end");
        require(maxSlippageBps <= BPS_DENOMINATOR, "bad slippage");

        _requireApprovedPath(path);

        Route storage r = routesToJack[tokenIn].push();

        r.exists = true;
        r.enabled = true;
        r.maxSlippageBps = maxSlippageBps == 0 ? defaultMaxSwapSlippageBps : maxSlippageBps;

        for (uint256 i = 0; i < path.length; i++) {
            r.path.push(path[i]);
        }

        emit RouteAdded(tokenIn, routesToJack[tokenIn].length - 1, path, r.maxSlippageBps);
    }

    function setRouteConfig(
        address tokenIn,
        uint256 routeIndex,
        bool enabled,
        uint256 maxSlippageBps
    ) external onlyOwner {
        require(routeIndex < routesToJack[tokenIn].length, "bad route");

        Route storage r = routesToJack[tokenIn][routeIndex];

        require(r.exists, "route missing");
        require(maxSlippageBps <= BPS_DENOMINATOR, "bad slippage");

        r.enabled = enabled;
        r.maxSlippageBps = maxSlippageBps == 0 ? defaultMaxSwapSlippageBps : maxSlippageBps;

        emit RouteUpdated(tokenIn, routeIndex, enabled, r.maxSlippageBps);
    }

    function routeCount(address tokenIn) external view returns (uint256) {
        return routesToJack[tokenIn].length;
    }

    function getRouteToJack(address tokenIn, uint256 routeIndex)
        external
        view
        returns (
            bool exists,
            bool enabled,
            address[] memory path,
            uint256 maxSlippageBps
        )
    {
        require(routeIndex < routesToJack[tokenIn].length, "bad route");

        Route storage r = routesToJack[tokenIn][routeIndex];

        return (r.exists, r.enabled, r.path, r.maxSlippageBps);
    }

    function setGlobalSwapConfig(
        uint256 newDefaultMaxSwapSlippageBps,
        uint256 newDefaultSwapFeeBps
    ) external onlyOwner {
        require(newDefaultMaxSwapSlippageBps <= BPS_DENOMINATOR, "bad slippage");
        require(newDefaultSwapFeeBps <= 500, "fee too high");

        defaultMaxSwapSlippageBps = newDefaultMaxSwapSlippageBps;
        defaultSwapFeeBps = newDefaultSwapFeeBps;

        emit GlobalSwapConfigUpdated(newDefaultMaxSwapSlippageBps, newDefaultSwapFeeBps);
    }

    // ------------------------------------------------------------
    // Updates
    // ------------------------------------------------------------

    function updatePair(address pair) external whenNotPaused returns (bool updated) {
        _updatePair(pair, false, true);
        return true;
    }

    function updatePairIfNeeded(address pair) public whenNotPaused returns (bool updated) {
        if (!canUpdate(pair)) {
            return false;
        }

        _updatePair(pair, false, false);
        return true;
    }

    function forceUpdatePair(address pair) external onlyOwner returns (bool updated) {
        _updatePair(pair, true, false);
        return true;
    }

    function updateMany(address[] calldata pairs, uint256 maxPairs)
        external
        whenNotPaused
        returns (uint256 updatedCount)
    {
        uint256 len = pairs.length;

        if (maxPairs > 0 && maxPairs < len) {
            len = maxPairs;
        }

        for (uint256 i = 0; i < len; i++) {
            if (canUpdate(pairs[i])) {
                _updatePair(pairs[i], false, false);
                updatedCount++;
            }
        }
    }

    function updateIfNeeded() external whenNotPaused returns (bool updated) {
        // Backward-compatible simple update:
        // update the direct pDAI/JACK pair if configured.
        address pair = pairForTokens[pDAI][JACK];

        if (pair == address(0)) {
            return false;
        }

        return updatePairIfNeeded(pair);
    }

    function _updatePair(
        address pair,
        bool bypassDeviation,
        bool requirePeriod
    ) internal {
        PairConfig storage cfg = pairConfig[pair];
        PairOracle storage obs = pairOracle[pair];

        require(cfg.exists, "unknown pair");
        require(cfg.enabled, "pair disabled");

        PairSnapshot memory s = _currentCumulativePrices(pair);

        require(uint256(s.reserve0) >= cfg.minReserve0, "reserve0 low");
        require(uint256(s.reserve1) >= cfg.minReserve1, "reserve1 low");

        uint32 timeElapsed;

        unchecked {
            timeElapsed = s.blockTimestamp - obs.blockTimestampLast;
        }

        if (requirePeriod) {
            require(timeElapsed >= cfg.minUpdatePeriod, "period not passed");
        } else {
            require(timeElapsed > 0, "same timestamp");
        }

        uint256 newPrice0AverageX112;
        uint256 newPrice1AverageX112;

        unchecked {
            newPrice0AverageX112 =
                (s.price0Cumulative - obs.price0CumulativeLast) /
                uint256(timeElapsed);

            newPrice1AverageX112 =
                (s.price1Cumulative - obs.price1CumulativeLast) /
                uint256(timeElapsed);
        }

        require(newPrice0AverageX112 > 0 && newPrice1AverageX112 > 0, "bad average");

        if (
            obs.lastSuccessfulUpdate > 0 &&
            !bypassDeviation &&
            cfg.maxTwapDeviationBps > 0
        ) {
            _requireDeviationOk(obs.price0AverageX112, newPrice0AverageX112, cfg.maxTwapDeviationBps);
            _requireDeviationOk(obs.price1AverageX112, newPrice1AverageX112, cfg.maxTwapDeviationBps);
        }

        obs.price0CumulativeLast = s.price0Cumulative;
        obs.price1CumulativeLast = s.price1Cumulative;
        obs.blockTimestampLast = s.blockTimestamp;
        obs.price0AverageX112 = newPrice0AverageX112;
        obs.price1AverageX112 = newPrice1AverageX112;
        obs.lastSuccessfulUpdate = block.timestamp;

        emit PairUpdated(pair, newPrice0AverageX112, newPrice1AverageX112, block.timestamp);
    }

    // ------------------------------------------------------------
    // Barrow-compatible views
    // ------------------------------------------------------------

    function quotePdaiToJack(uint256 pdaiAmount)
        external
        view
        whenNotPaused
        returns (uint256 jackAmount)
    {
        return quoteTokenToJack(pDAI, pdaiAmount);
    }

    function isReady() public view returns (bool) {
        address pair = pairForTokens[pDAI][JACK];

        if (pair == address(0)) {
            return false;
        }

        return pairReady(pair);
    }

    function isStale() public view returns (bool) {
        address pair = pairForTokens[pDAI][JACK];

        if (pair == address(0)) {
            return true;
        }

        return pairStale(pair);
    }

    function liquidityOk() public view returns (bool) {
        address pair = pairForTokens[pDAI][JACK];

        if (pair == address(0)) {
            return false;
        }

        return pairLiquidityOk(pair);
    }

    // ------------------------------------------------------------
    // Quotes
    // ------------------------------------------------------------

    function quoteTokenToJack(address tokenIn, uint256 amountIn)
        public
        view
        whenNotPaused
        returns (uint256 jackAmount)
    {
        require(tokenIn != address(0), "token zero");
        require(amountIn > 0, "amount zero");

        if (tokenIn == JACK) {
            return amountIn;
        }

        (uint256 routeIndex, uint256 bestOut, , ) = bestRouteToJack(tokenIn, amountIn);

        require(bestOut > 0, "no route");

        routeIndex;

        return bestOut;
    }

    function bestRouteToJack(address tokenIn, uint256 amountIn)
        public
        view
        returns (
            uint256 bestRouteIndex,
            uint256 bestAmountOut,
            uint256 bestSafeAmountIn,
            uint256 bestSlippageBps
        )
    {
        require(tokenIn != address(0), "token zero");
        require(amountIn > 0, "amount zero");

        Route[] storage list = routesToJack[tokenIn];

        require(list.length > 0, "no routes");

        bestRouteIndex = type(uint256).max;

        for (uint256 i = 0; i < list.length; i++) {
            Route storage r = list[i];

            if (!r.exists || !r.enabled) {
                continue;
            }

            RouteQuote memory q = quoteRoute(tokenIn, i, amountIn);

            if (!q.healthy) {
                continue;
            }

            if (q.expectedOut > bestAmountOut) {
                bestAmountOut = q.expectedOut;
                bestSafeAmountIn = q.maxSafeAmountIn;
                bestSlippageBps = q.slippageBps;
                bestRouteIndex = i;
            }
        }

        require(bestRouteIndex != type(uint256).max, "no healthy route");
    }

    function quoteRoute(
        address tokenIn,
        uint256 routeIndex,
        uint256 amountIn
    ) public view returns (RouteQuote memory q) {
        require(routeIndex < routesToJack[tokenIn].length, "bad route");
        require(amountIn > 0, "amount zero");

        Route storage r = routesToJack[tokenIn][routeIndex];

        q.amountIn = amountIn;
        q.routeIndex = routeIndex;

        if (!r.exists || !r.enabled) {
            return q;
        }

        if (!_pathBasicOk(r.path)) {
            return q;
        }

        q.routeOk = true;

        (bool pathHealthy, uint256 out, uint256 idealOut, uint256 slip) =
            _quotePathWithHealth(r.path, amountIn);

        q.expectedOut = out;
        q.idealOut = idealOut;
        q.slippageBps = slip;

        q.maxSafeAmountIn = _maxSafeAmountForPath(r.path, amountIn, r.maxSlippageBps);

        q.healthy = pathHealthy && q.maxSafeAmountIn > 0 && slip <= r.maxSlippageBps;
    }

    function getExpectedOut(address[] calldata path, uint256 amountIn)
        external
        view
        returns (uint256 amountOut)
    {
        // Generic amount quotes support Mining's JACK-to-payment valuation as
        // well as payment-to-JACK. Registered conversion routes remain JACK-ending.
        require(_amountQuotePathOk(path), "bad path");
        require(amountIn > 0, "amount zero");

        amountOut = _amountOutForPath(path, amountIn);
    }

    /// @notice Linear TWAP valuation for protocol accounting, not a swap output promise.
    /// @dev Every hop must have a fresh observation and spot price within its configured band.
    function getValidatedTwapValue(address[] calldata path, uint256 amountIn)
        external view whenNotPaused returns (uint256 value)
    {
        require(_amountQuotePathOk(path) && amountIn > 0, "bad valuation input");
        value = amountIn;
        for (uint256 i = 0; i < path.length - 1; i++) {
            address pair = pairForTokens[path[i]][path[i + 1]];
            PairConfig storage cfg = pairConfig[pair];
            require(cfg.exists && cfg.enabled && pairReady(pair), "valuation not ready");
            require(!pairStale(pair) && pairLiquidityOk(pair), "unhealthy valuation");
            require(cfg.minUpdatePeriod > 0 && cfg.maxTwapStaleness > 0 &&
                cfg.maxTwapDeviationBps > 0, "valuation guards disabled");
            (uint112 r0, uint112 r1,) = IUniswapV2LikePair(pair).getReserves();
            bool forward = cfg.token0 == path[i];
            uint256 spot = forward ? Math.mulDiv(r1, Q112, r0) : Math.mulDiv(r0, Q112, r1);
            uint256 average = forward ? pairOracle[pair].price0AverageX112 : pairOracle[pair].price1AverageX112;
            uint256 difference = spot > average ? spot - average : average - spot;
            require(difference <= Math.mulDiv(average, cfg.maxTwapDeviationBps, BPS_DENOMINATOR),
                "spot/TWAP deviation");
            value = Math.mulDiv(value, average, Q112);
        }
        require(value > 0, "zero valuation");
    }

    function getExpectedSlippageBps(address[] calldata path, uint256 amountIn)
        external
        view
        returns (uint256 slippageBps)
    {
        require(_pathBasicOkCalldata(path), "bad path");
        require(amountIn > 0, "amount zero");

        uint256 out = _amountOutForPath(path, amountIn);
        uint256 ideal = _idealOutForPath(path, amountIn);

        if (ideal == 0 || out >= ideal) {
            return 0;
        }

        slippageBps = ((ideal - out) * BPS_DENOMINATOR) / ideal;
    }

    function getMaxSafeSwapIn(address[] calldata path, uint256 desiredAmountIn)
        external
        view
        returns (uint256 safeAmountIn)
    {
        require(_pathBasicOkCalldata(path), "bad path");

        safeAmountIn = _maxSafeAmountForPathCalldata(
            path,
            desiredAmountIn,
            defaultMaxSwapSlippageBps
        );
    }

    function isSwapHealthy(address[] calldata path, uint256 amountIn)
        external
        view
        returns (bool healthy)
    {
        if (!_pathBasicOkCalldata(path) || amountIn == 0) {
            return false;
        }

        (bool pathHealthy, , , uint256 slip) = _quotePathWithHealthCalldata(path, amountIn);

        return pathHealthy && slip <= defaultMaxSwapSlippageBps;
    }

    // ------------------------------------------------------------
    // Pair health
    // ------------------------------------------------------------

    function getPairHealth(address pair) external view returns (PairHealth memory h) {
        PairConfig storage cfg = pairConfig[pair];
        PairOracle storage obs = pairOracle[pair];

        h.exists = cfg.exists;
        h.enabled = cfg.enabled;

        if (!cfg.exists) {
            return h;
        }

        (uint112 r0, uint112 r1, ) = IUniswapV2LikePair(pair).getReserves();

        h.reserve0 = uint256(r0);
        h.reserve1 = uint256(r1);
        h.minReserve0 = cfg.minReserve0;
        h.minReserve1 = cfg.minReserve1;
        h.reservesOk = pairLiquidityOk(pair);
        h.ready = pairReady(pair);
        h.stale = pairStale(pair);
        h.canUpdateNow = canUpdate(pair);

        h.lastSuccessfulUpdate = obs.lastSuccessfulUpdate;
        h.secondsSinceLastUpdate = _secondsSinceLastUpdate(pair);
        h.secondsUntilNextUpdate = _secondsUntilUpdate(pair);
        h.price0AverageX112 = obs.price0AverageX112;
        h.price1AverageX112 = obs.price1AverageX112;
        h.weightBps = cfg.weightBps;
    }

    function pairReady(address pair) public view returns (bool) {
        PairConfig storage cfg = pairConfig[pair];
        PairOracle storage obs = pairOracle[pair];

        return (
            cfg.exists &&
            cfg.enabled &&
            obs.lastSuccessfulUpdate > 0 &&
            obs.price0AverageX112 > 0 &&
            obs.price1AverageX112 > 0
        );
    }

    function pairStale(address pair) public view returns (bool) {
        PairConfig storage cfg = pairConfig[pair];
        PairOracle storage obs = pairOracle[pair];

        if (!pairReady(pair)) {
            return true;
        }

        return block.timestamp > obs.lastSuccessfulUpdate + cfg.maxTwapStaleness;
    }

    function pairLiquidityOk(address pair) public view returns (bool) {
        PairConfig storage cfg = pairConfig[pair];

        if (!cfg.exists || !cfg.enabled) {
            return false;
        }

        (uint112 r0, uint112 r1, ) = IUniswapV2LikePair(pair).getReserves();

        if (r0 == 0 || r1 == 0) {
            return false;
        }

        if (uint256(r0) < cfg.minReserve0) {
            return false;
        }

        if (uint256(r1) < cfg.minReserve1) {
            return false;
        }

        return true;
    }

    function canUpdate(address pair) public view returns (bool) {
        PairConfig storage cfg = pairConfig[pair];
        PairOracle storage obs = pairOracle[pair];

        if (!cfg.exists || !cfg.enabled) {
            return false;
        }

        uint32 now32 = _currentBlockTimestamp();

        uint32 elapsed;

        unchecked {
            elapsed = now32 - obs.blockTimestampLast;
        }

        return elapsed >= cfg.minUpdatePeriod;
    }

    // ------------------------------------------------------------
    // Internal route / path helpers
    // ------------------------------------------------------------

    function _requireApprovedPath(address[] calldata path) internal view {
        require(_pathBasicOkCalldata(path), "bad path");

        for (uint256 i = 0; i < path.length - 1; i++) {
            address pair = pairForTokens[path[i]][path[i + 1]];

            require(pair != address(0), "missing pair");
            require(pairConfig[pair].exists, "pair unknown");
            require(pairConfig[pair].enabled, "pair disabled");
        }
    }

    function _amountQuotePathOk(address[] calldata path) internal view returns (bool) {
        if (path.length < 2) return false;
        if (path[0] != JACK && path[path.length - 1] != JACK) return false;
        for (uint256 i = 0; i < path.length; i++) {
            if (path[i] == address(0)) return false;
            if (i > 0 && path[i] == path[i - 1]) return false;
        }
        return true;
    }

    function _pathBasicOk(address[] storage path) internal view returns (bool) {
        if (path.length < 2) {
            return false;
        }

        if (path[path.length - 1] != JACK) {
            return false;
        }

        for (uint256 i = 0; i < path.length; i++) {
            if (path[i] == address(0)) {
                return false;
            }

            if (i > 0 && path[i] == path[i - 1]) {
                return false;
            }
        }

        return true;
    }

    function _pathBasicOkCalldata(address[] calldata path) internal view returns (bool) {
        if (path.length < 2) {
            return false;
        }

        if (path[path.length - 1] != JACK) {
            return false;
        }

        for (uint256 i = 0; i < path.length; i++) {
            if (path[i] == address(0)) {
                return false;
            }

            if (i > 0 && path[i] == path[i - 1]) {
                return false;
            }
        }

        return true;
    }

    function _quotePathWithHealth(address[] storage path, uint256 amountIn)
        internal
        view
        returns (
            bool healthy,
            uint256 out,
            uint256 idealOut,
            uint256 slippageBps
        )
    {
        if (!_pathBasicOk(path)) {
            return (false, 0, 0, 0);
        }

        healthy = true;

        out = amountIn;
        idealOut = amountIn;

        for (uint256 i = 0; i < path.length - 1; i++) {
            address tokenIn = path[i];
            address tokenOut = path[i + 1];

            address pair = pairForTokens[tokenIn][tokenOut];

            if (
                pair == address(0) ||
                !pairReady(pair) ||
                pairStale(pair) ||
                !pairLiquidityOk(pair)
            ) {
                return (false, 0, 0, 0);
            }

            out = _amountOutDirect(tokenIn, tokenOut, out);
            idealOut = _idealOutDirect(tokenIn, tokenOut, idealOut);
        }

        if (idealOut == 0 || out >= idealOut) {
            slippageBps = 0;
        } else {
            slippageBps = ((idealOut - out) * BPS_DENOMINATOR) / idealOut;
        }
    }

    function _quotePathWithHealthCalldata(address[] calldata path, uint256 amountIn)
        internal
        view
        returns (
            bool healthy,
            uint256 out,
            uint256 idealOut,
            uint256 slippageBps
        )
    {
        if (!_pathBasicOkCalldata(path)) {
            return (false, 0, 0, 0);
        }

        healthy = true;

        out = amountIn;
        idealOut = amountIn;

        for (uint256 i = 0; i < path.length - 1; i++) {
            address tokenIn = path[i];
            address tokenOut = path[i + 1];

            address pair = pairForTokens[tokenIn][tokenOut];

            if (
                pair == address(0) ||
                !pairReady(pair) ||
                pairStale(pair) ||
                !pairLiquidityOk(pair)
            ) {
                return (false, 0, 0, 0);
            }

            out = _amountOutDirect(tokenIn, tokenOut, out);
            idealOut = _idealOutDirect(tokenIn, tokenOut, idealOut);
        }

        if (idealOut == 0 || out >= idealOut) {
            slippageBps = 0;
        } else {
            slippageBps = ((idealOut - out) * BPS_DENOMINATOR) / idealOut;
        }
    }

    function _amountOutForPath(address[] calldata path, uint256 amountIn)
        internal
        view
        returns (uint256 out)
    {
        out = amountIn;

        for (uint256 i = 0; i < path.length - 1; i++) {
            out = _amountOutDirect(path[i], path[i + 1], out);
        }
    }

    function _idealOutForPath(address[] calldata path, uint256 amountIn)
        internal
        view
        returns (uint256 out)
    {
        out = amountIn;

        for (uint256 i = 0; i < path.length - 1; i++) {
            out = _idealOutDirect(path[i], path[i + 1], out);
        }
    }

    function _maxSafeAmountForPath(
        address[] storage path,
        uint256 desiredAmountIn,
        uint256 maxSlippageBps
    ) internal view returns (uint256) {
        if (desiredAmountIn == 0) {
            return 0;
        }

        (bool healthy, , , uint256 slip) = _quotePathWithHealth(path, desiredAmountIn);

        if (healthy && slip <= maxSlippageBps) {
            return desiredAmountIn;
        }

        uint256 low = 0;
        uint256 high = desiredAmountIn;

        for (uint256 i = 0; i < 32; i++) {
            uint256 mid = (low + high + 1) / 2;

            (bool midHealthy, , , uint256 midSlip) = _quotePathWithHealth(path, mid);

            if (midHealthy && midSlip <= maxSlippageBps) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }

        return low;
    }

    function _maxSafeAmountForPathCalldata(
        address[] calldata path,
        uint256 desiredAmountIn,
        uint256 maxSlippageBps
    ) internal view returns (uint256) {
        if (desiredAmountIn == 0) {
            return 0;
        }

        (bool healthy, , , uint256 slip) = _quotePathWithHealthCalldata(path, desiredAmountIn);

        if (healthy && slip <= maxSlippageBps) {
            return desiredAmountIn;
        }

        uint256 low = 0;
        uint256 high = desiredAmountIn;

        for (uint256 i = 0; i < 32; i++) {
            uint256 mid = (low + high + 1) / 2;

            (bool midHealthy, , , uint256 midSlip) = _quotePathWithHealthCalldata(path, mid);

            if (midHealthy && midSlip <= maxSlippageBps) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }

        return low;
    }

    // ------------------------------------------------------------
    // Direct pair quotes
    // ------------------------------------------------------------

    function _amountOutDirect(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        if (amountIn == 0) {
            return 0;
        }

        address pair = pairForTokens[tokenIn][tokenOut];

        require(pair != address(0), "missing pair");

        PairConfig storage cfg = pairConfig[pair];

        require(cfg.exists && cfg.enabled, "pair disabled");

        (uint112 reserve0, uint112 reserve1, ) = IUniswapV2LikePair(pair).getReserves();

        uint256 reserveIn;
        uint256 reserveOut;

        if (cfg.token0 == tokenIn && cfg.token1 == tokenOut) {
            reserveIn = uint256(reserve0);
            reserveOut = uint256(reserve1);
        } else if (cfg.token1 == tokenIn && cfg.token0 == tokenOut) {
            reserveIn = uint256(reserve1);
            reserveOut = uint256(reserve0);
        } else {
            revert("bad pair direction");
        }

        if (reserveIn == 0 || reserveOut == 0) {
            return 0;
        }

        uint256 amountInAfterFee = amountIn * (BPS_DENOMINATOR - defaultSwapFeeBps);
        uint256 numerator = amountInAfterFee * reserveOut;
        uint256 denominator = reserveIn * BPS_DENOMINATOR + amountInAfterFee;

        return numerator / denominator;
    }

    function _idealOutDirect(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        if (amountIn == 0) {
            return 0;
        }

        address pair = pairForTokens[tokenIn][tokenOut];

        require(pair != address(0), "missing pair");

        PairConfig storage cfg = pairConfig[pair];
        PairOracle storage obs = pairOracle[pair];

        require(pairReady(pair), "pair not ready");

        if (cfg.token0 == tokenIn && cfg.token1 == tokenOut) {
            return Math.mulDiv(amountIn, obs.price0AverageX112, Q112);
        }

        if (cfg.token1 == tokenIn && cfg.token0 == tokenOut) {
            return Math.mulDiv(amountIn, obs.price1AverageX112, Q112);
        }

        revert("bad ideal direction");
    }

    // ------------------------------------------------------------
    // Cumulative price helpers
    // ------------------------------------------------------------

    function _currentCumulativePrices(address pair)
        internal
        view
        returns (PairSnapshot memory s)
    {
        IUniswapV2LikePair p = IUniswapV2LikePair(pair);

        s.price0Cumulative = p.price0CumulativeLast();
        s.price1Cumulative = p.price1CumulativeLast();

        uint32 pairBlockTimestampLast;

        (
            s.reserve0,
            s.reserve1,
            pairBlockTimestampLast
        ) = p.getReserves();

        require(s.reserve0 > 0 && s.reserve1 > 0, "empty reserves");

        s.blockTimestamp = _currentBlockTimestamp();

        if (pairBlockTimestampLast != s.blockTimestamp) {
            uint32 timeElapsed;

            unchecked {
                timeElapsed = s.blockTimestamp - pairBlockTimestampLast;
            }

            uint256 price0 = Math.mulDiv(uint256(s.reserve1), Q112, uint256(s.reserve0));
            uint256 price1 = Math.mulDiv(uint256(s.reserve0), Q112, uint256(s.reserve1));

            s.price0Cumulative += price0 * uint256(timeElapsed);
            s.price1Cumulative += price1 * uint256(timeElapsed);
        }
    }

    function _currentBlockTimestamp() internal view returns (uint32) {
        return uint32(block.timestamp % 2 ** 32);
    }

    function _requireDeviationOk(
        uint256 oldAverageX112,
        uint256 newAverageX112,
        uint256 maxDeviationBps
    ) internal pure {
        if (oldAverageX112 == 0 || maxDeviationBps == 0) {
            return;
        }

        uint256 diff = oldAverageX112 > newAverageX112
            ? oldAverageX112 - newAverageX112
            : newAverageX112 - oldAverageX112;

        uint256 allowed = Math.mulDiv(
            oldAverageX112,
            maxDeviationBps,
            BPS_DENOMINATOR
        );

        require(diff <= allowed, "TWAP deviation too high");
    }

    function _secondsSinceLastUpdate(address pair) internal view returns (uint256) {
        uint256 last = pairOracle[pair].lastSuccessfulUpdate;

        if (last == 0) {
            return 0;
        }

        return block.timestamp - last;
    }

    function _secondsUntilUpdate(address pair) internal view returns (uint256) {
        PairConfig storage cfg = pairConfig[pair];
        PairOracle storage obs = pairOracle[pair];

        if (!cfg.exists) {
            return 0;
        }

        uint32 now32 = _currentBlockTimestamp();

        uint32 elapsed;

        unchecked {
            elapsed = now32 - obs.blockTimestampLast;
        }

        if (elapsed >= cfg.minUpdatePeriod) {
            return 0;
        }

        return cfg.minUpdatePeriod - elapsed;
    }

    // ------------------------------------------------------------
    // Admin pause
    // ------------------------------------------------------------

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}