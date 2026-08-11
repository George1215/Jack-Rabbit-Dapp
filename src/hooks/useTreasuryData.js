// src/hooks/useTreasuryData.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { TREASURY_CONFIG } from "../config/treasuryConfig";

const ZERO = ethers.ZeroAddress;

const ABI_CACHE = new Map();

const EMPTY_OVERVIEW = {
  name: "–",
  symbol: "JACK",
  decimals: 18,

  jackTokenAddress: "–",
  jackTokenAddressShort: "–",

  supply: "–",
  burned: "–",
  circulating: "–",
  mintable: "–",
  lastMint: "–",
  nextMint: "–",
  isMintReady: "–",

  feePct: "0.0000%",
  burnSharePct: "0.00%",
  configuredBurnSharePct: "0.00%",
  feeMode: "Dynamic",
  manualExpiry: "–",
  treasuryTarget: "–",
  maxMinFee: "–",
  burnShareRange: "–",

  treasuryJack: "–",
  jackIncome5Y: "–",
  jackPushedFees5Y: "–",
  todayNet: "–",
  todayPushed: "–",

  loanOutstanding: "0 JACK",
  loanRepaid: "0 JACK",
  loanRequestable: "0 JACK",
  loanRoomLeft: "0 JACK",

  treasuryAddress: "–",
  treasuryAddressShort: "–",
  treasuryOwner: "–",
  treasuryOwnerShort: "–",
  treasuryStatus: "–",
  treasuryPaused: false,
  routerAddress: "–",
  routerAddressShort: "–",
  wplsAddress: "–",
  wplsAddressShort: "–",

  pdaiAddress: ZERO,
  pdaiAddressShort: "–",
  pdaiSymbol: "pDAI",
  pdaiDecimals: 18,
  pdaiTotalSupply: "–",
  pdaiTreasuryBalance: "–",
  pdaiTreasuryReserves: "–",
  pdaiIncome5Y: "–",
  pdaiReserveDeposits5Y: "–",
  pdaiReservesIn: "–",
  pdaiReservesOut: "–",
  pdaiTodayIncome: "–",
  pdaiTodayReserveDeposits: "–",

  jackPegReturns5Y: "–",
  pdaiPegReturns5Y: "–",
  todayJackPegReturns: "–",
  todayPdaiPegReturns: "–",
};

function publicAsset(path) {
  const base = process.env.PUBLIC_URL || "";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

function extractAbi(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.abi)) return payload.abi;
  if (Array.isArray(payload?.output?.abi)) return payload.output.abi;
  if (Array.isArray(payload?.compilerOutput?.abi)) return payload.compilerOutput.abi;
  if (Array.isArray(payload?.contract?.abi)) return payload.contract.abi;
  return [];
}

async function loadAbiFile(path) {
  if (ABI_CACHE.has(path)) {
    return ABI_CACHE.get(path);
  }

  const promise = fetch(publicAsset(path))
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load ABI file: ${path}`);
      }

      const json = await response.json();
      const abi = extractAbi(json);

      if (!abi.length) {
        throw new Error(`No usable ABI found in: ${path}`);
      }

      return abi;
    })
    .catch((error) => {
      ABI_CACHE.delete(path);
      throw error;
    });

  ABI_CACHE.set(path, promise);
  return promise;
}

async function loadAllAbis() {
  const [erc20, jackToken, treasury] = await Promise.all([
    loadAbiFile("/abis/IERC20.json"),
    loadAbiFile("/abis/JackToken.json"),
    loadAbiFile("/abis/JackTreasury.json"),
  ]);

  return { erc20, jackToken, treasury };
}

function isAddress(value) {
  try {
    return ethers.isAddress(value);
  } catch {
    return false;
  }
}

export function shortAddress(addr) {
  if (!addr || !isAddress(addr)) return "–";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtNum(value) {
  try {
    const text = String(value);
    const parts = text.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  } catch {
    return String(value);
  }
}

export function fmtUnits(value, decimals = 18, maxDp = 4) {
  try {
    const formatted = ethers.formatUnits(value ?? 0n, decimals);

    if (!formatted.includes(".")) return fmtNum(formatted);

    const [whole, fraction] = formatted.split(".");
    const trimmed = fraction.slice(0, maxDp).replace(/0+$/, "");

    return fmtNum(`${whole}${trimmed ? `.${trimmed}` : ""}`);
  } catch {
    return "–";
  }
}

export function fmtToken(value, decimals, symbol, maxDp = 2) {
  return `${fmtUnits(value, decimals, maxDp)} ${symbol || ""}`.trim();
}

function fmtTime(timestamp) {
  try {
    if (!timestamp || timestamp === 0n) return "–";

    const n = Number(timestamp);
    if (!n) return "–";

    return new Date(n * 1000).toLocaleString();
  } catch {
    return "–";
  }
}

function feePpbToPctStr(feePPB) {
  try {
    return `${(Number(feePPB ?? 0n) / 10_000_000).toFixed(4)}%`;
  } catch {
    return "0.0000%";
  }
}

function burnShareToPctStr(bp) {
  try {
    return `${(Number(bp ?? 0n) / 100).toFixed(2)}%`;
  } catch {
    return "0.00%";
  }
}

function toBigIntOrNull(value) {
  if (value === undefined || value === null) return null;

  try {
    return ethers.toBigInt(value);
  } catch {
    return null;
  }
}

function getTupleField(value, names, index) {
  if (!value) return null;

  for (const name of names) {
    if (value[name] !== undefined && value[name] !== null) {
      return value[name];
    }
  }

  if (value[index] !== undefined && value[index] !== null) {
    return value[index];
  }

  return null;
}

export function humanToUnits(amountText, decimals) {
  const raw = String(amountText || "").trim().replace(/,/g, "");
  if (!raw) throw new Error("Enter amount");
  return ethers.parseUnits(raw, decimals);
}

async function safeRead(factory, fallback) {
  try {
    return await factory();
  } catch {
    return fallback;
  }
}

async function readAny(contract, methods, fallback = null) {
  for (const item of methods) {
    const methodName = Array.isArray(item) ? item[0] : item;
    const args = Array.isArray(item) ? item.slice(1) : [];

    try {
      if (typeof contract?.[methodName] === "function") {
        const value = await contract[methodName](...args);

        if (value !== undefined && value !== null) {
          return value;
        }
      }
    } catch {
      // Try next method.
    }
  }

  return fallback;
}

async function readFirst(contracts, methods, fallback = null) {
  for (const contract of contracts) {
    const value = await readAny(contract, methods, null);

    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return fallback;
}

export default function useTreasuryData() {
  const CONFIG = useMemo(() => TREASURY_CONFIG, []);

  const configReady = useMemo(() => {
    return isAddress(CONFIG.JACK_TOKEN) && isAddress(CONFIG.JACK_TREASURY);
  }, [CONFIG.JACK_TOKEN, CONFIG.JACK_TREASURY]);

  const [abiPack, setAbiPack] = useState(null);
  const [rpcProvider, setRpcProvider] = useState(null);
  const [web3Provider, setWeb3Provider] = useState(null);

  const readProvider = useMemo(
    () => rpcProvider || web3Provider,
    [rpcProvider, web3Provider]
  );

  const [userAddress, setUserAddress] = useState(null);
  const [globalStatus, setGlobalStatus] = useState(
    "Preview mode. Add your addresses + RPC inside ENV."
  );

  const [overview, setOverview] = useState(EMPTY_OVERVIEW);

  const [LIVE, setLIVE] = useState({
    symbol: "JACK",
    feeBP: 0n,
    burnShareBP: 0n,
    configuredBurnShareBP: 0n,
    minFeeBP: 0n,
    maxFeeBP: 0n,
    startBurnShareBP: 0n,
    endBurnShareBP: 0n,
    treasuryTarget: 0n,
    treasuryJack: 0n,
    overrideFeeBP: 0n,
    overrideUntil: 0n,

    loanOutstanding: 0n,
    loanRepaid: 0n,
    loanRequestable: 0n,
    loanRoomLeft: 0n,
  });

  const [holdingsRows, setHoldingsRows] = useState([]);
  const [lpRows, setLpRows] = useState([]);
  const [holdingsStatus, setHoldingsStatus] = useState("");
  const [lpStatus, setLpStatus] = useState("");

  const [eventsRows, setEventsRows] = useState([]);
  const [eventsStatus, setEventsStatus] = useState("");

  const tokenMetaRef = useRef(new Map());

  useEffect(() => {
    let mounted = true;

    loadAllAbis()
      .then((abis) => {
        if (!mounted) return;
        setAbiPack(abis);
      })
      .catch((error) => {
        console.error(error);
        if (!mounted) return;
        setGlobalStatus(`❌ ${error?.message || "Failed to load ABI files."}`);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const getTokenMeta = useCallback(
    async (address) => {
      if (address === ZERO) {
        return { name: "Pulse", symbol: "PLS", decimals: 18 };
      }

      if (!readProvider || !abiPack?.erc20 || !isAddress(address)) {
        return { name: "Unknown", symbol: "TOKEN", decimals: 18 };
      }

      const key = address.toLowerCase();

      if (tokenMetaRef.current.has(key)) {
        return tokenMetaRef.current.get(key);
      }

      const token = new ethers.Contract(address, abiPack.erc20, readProvider);

      const [name, symbol, decimals] = await Promise.all([
        safeRead(() => token.name(), "Unknown"),
        safeRead(() => token.symbol(), "TOKEN"),
        safeRead(() => token.decimals(), 18),
      ]);

      const meta = {
        name,
        symbol,
        decimals: Number(decimals),
      };

      tokenMetaRef.current.set(key, meta);
      return meta;
    },
    [abiPack?.erc20, readProvider]
  );

  const refreshOverview = useCallback(async () => {
    if (!configReady) {
      setGlobalStatus("Preview mode. Add your Treasury + JACK addresses in ENV.");
      return;
    }

    if (!readProvider) {
      setGlobalStatus("No provider found. Add RPC URL or connect wallet.");
      return;
    }

    if (!abiPack?.erc20 || !abiPack?.jackToken || !abiPack?.treasury) {
      setGlobalStatus("Loading ABI files…");
      return;
    }

    try {
      const jack = new ethers.Contract(
        CONFIG.JACK_TOKEN,
        abiPack.jackToken,
        readProvider
      );

      const treasury = new ethers.Contract(
        CONFIG.JACK_TREASURY,
        abiPack.treasury,
        readProvider
      );

      const [
        treasuryOwner,
        treasuryPaused,
        treasuryJackAddress,
        treasuryPdaiAddress,
        routerAddress,
        wplsAddress,
      ] = await Promise.all([
        readAny(treasury, ["owner"], ZERO),
        readAny(treasury, ["paused"], false),
        readAny(treasury, ["JACK", "jack"], CONFIG.JACK_TOKEN),
        readAny(treasury, ["pdai"], CONFIG.PDAI_TOKEN || ZERO),
        readAny(treasury, ["router"], ZERO),
        readAny(treasury, ["wpls"], CONFIG.WPLS_TOKEN || ZERO),
      ]);

      const resolvedJackAddress =
        isAddress(treasuryJackAddress) && treasuryJackAddress !== ZERO
          ? treasuryJackAddress
          : CONFIG.JACK_TOKEN;

      const jackForBalance = new ethers.Contract(
        resolvedJackAddress,
        abiPack.erc20,
        readProvider
      );

      const [
        name,
        symbol,
        decimalsRaw,
        totalSupplyRaw,
        totalBurnedRaw,
        mintableRaw,
        lastMintRaw,
        nextMintRaw,
        isMintReadyRaw,

        feeBP,
        burnShareBP,
        configuredBurnShareBP,
        maxFeeBP,
        minFeeBP,
        startBurnShareBP,
        endBurnShareBP,
        overrideFeeBP,
        overrideUntil,
        treasuryTargetRaw,

        treasuryJackBalanceRaw,

        totalJackIncomeFiveYearsRaw,
        totalJackPushedFeesFiveYearsRaw,
        todayJackIncomeRaw,
        todayPushedFeesRaw,

        pdaiTreasuryReservesRaw,
        totalPdaiIncomeFiveYearsRaw,
        totalPdaiReserveDepositsFiveYearsRaw,
        totalPdaiReservesInRaw,
        totalPdaiReservesOutRaw,
        pdaiTodayIncomeRaw,
        pdaiTodayReserveDepositsRaw,

        totalJackPegReturnsFiveYearsRaw,
        totalPdaiPegReturnsFiveYearsRaw,
        todayJackPegReturnsRaw,
        todayPdaiPegReturnsRaw,
      ] = await Promise.all([
        readAny(jack, ["name"], "Jack Rabbit"),
        readAny(jack, ["symbol"], "JACK"),
        readAny(jack, ["decimals"], 18),
        readAny(jack, ["totalSupply"], 0n),

        readFirst([treasury, jack], ["totalBurned", "lifetimeBurned"], 0n),
        readFirst([treasury, jack], ["getMintableAmount", "mintCredit"], 0n),
        readFirst([treasury, jack], ["lastMintTimestamp"], 0n),
        readFirst([treasury, jack], ["getNextMintTimestamp", "nextMintTimestamp"], 0n),
        readFirst([treasury, jack], ["isMintReady"], false),

        readFirst([treasury, jack], ["getCurrentFeeBP", "currentFeeBP", "feeBP"], 0n),
        readFirst(
          [treasury, jack],
          ["getCurrentBurnShareBP", "currentBurnShareBP", "burnShareBP"],
          0n
        ),
        readFirst(
          [treasury, jack],
          ["getConfiguredBurnShareBP", "configuredBurnShareBP"],
          0n
        ),
        readFirst([treasury, jack], ["maxFeeBP"], 0n),
        readFirst([treasury, jack], ["minFeeBP"], 0n),
        readFirst([treasury, jack], ["startBurnShareBP"], 0n),
        readFirst([treasury, jack], ["endBurnShareBP"], 0n),
        readFirst([treasury, jack], ["overrideFeeBP"], 0n),
        readFirst([treasury, jack], ["overrideUntil"], 0n),
        readFirst([treasury, jack], ["treasuryTarget", "getTreasuryTarget"], 0n),

        readAny(jackForBalance, [["balanceOf", CONFIG.JACK_TREASURY]], 0n),

        readAny(treasury, ["totalJackIncomeFiveYears"], 0n),
        readAny(treasury, ["totalJackPushedFeesFiveYears"], 0n),
        readAny(treasury, ["getTodayJackIncome"], 0n),
        readAny(treasury, ["getTodayJackPushedFees"], 0n),

        readAny(treasury, ["treasuryPdaiReserves"], 0n),
        readAny(treasury, ["totalPdaiIncomeFiveYears"], 0n),
        readAny(treasury, ["totalPdaiReserveDepositsFiveYears"], 0n),
        readAny(treasury, ["totalPdaiReservesIn"], 0n),
        readAny(treasury, ["totalPdaiReservesOut"], 0n),
        readAny(treasury, ["getTodayPdaiIncome"], 0n),
        readAny(treasury, ["getTodayPdaiReserveDeposits"], 0n),

        readAny(treasury, ["totalJackPegReturnsFiveYears"], 0n),
        readAny(treasury, ["totalPdaiPegReturnsFiveYears"], 0n),
        readAny(treasury, ["getTodayJackPegReturns"], 0n),
        readAny(treasury, ["getTodayPdaiPegReturns"], 0n),
      ]);

      const decimals = Number(decimalsRaw);

      const loanBundle = await readAny(
        treasury,
        [
          "getLoanStatus",
          "getLoanOverview",
          "getLoanReadouts",
          "getLoanAccounting",
        ],
        null
      );

      const loanOutstandingFromBundle = getTupleField(
        loanBundle,
        ["loanOutstanding", "outstanding", "outstandingLoan"],
        0
      );

      const loanRepaidFromBundle = getTupleField(
        loanBundle,
        ["loanRepaid", "repaid", "totalRepaid"],
        1
      );

      const loanRequestableFromBundle = getTupleField(
        loanBundle,
        ["loanRequestable", "requestable", "requestableLoan", "requestableAmount"],
        2
      );

      const loanRoomLeftFromBundle = getTupleField(
        loanBundle,
        [
          "loanRoomLeft",
          "roomLeft",
          "remainingLoanRoom",
          "loanCapacityRemaining",
          "availableRoom",
        ],
        3
      );

      const loanOutstandingDirect = await readAny(
        treasury,
        ["loanOutstanding", "getLoanOutstanding"],
        null
      );

      const loanRepaidDirect = await readAny(
        treasury,
        [
          "loanRepaid",
          "totalLoanRepaid",
          "cumulativeLoanRepaid",
          "loanRepaidTotal",
          "getLoanRepaid",
        ],
        null
      );

      const loanRequestableDirect = await readAny(
        treasury,
        [
          "loanRequestable",
          "getLoanRequestableAmount",
          "requestableLoanAmount",
          "getRequestableLoanAmount",
          "requestableJackLoan",
          "getRequestableJackLoan",
        ],
        null
      );

      const loanRoomLeftDirect = await readAny(
        treasury,
        [
          "loanRoomLeft",
          "getLoanRoomLeft",
          "remainingLoanRoom",
          "loanCapacityRemaining",
          "loanAvailableRoom",
          "remainingMintCreditRoom",
        ],
        null
      );

      const loanOutstandingRaw =
        toBigIntOrNull(loanOutstandingFromBundle) ??
        toBigIntOrNull(loanOutstandingDirect) ??
        0n;

      const loanRepaidRaw =
        toBigIntOrNull(loanRepaidFromBundle) ??
        toBigIntOrNull(loanRepaidDirect) ??
        0n;

      const loanRoomLeftRaw =
        toBigIntOrNull(loanRoomLeftFromBundle) ??
        toBigIntOrNull(loanRoomLeftDirect) ??
        toBigIntOrNull(mintableRaw) ??
        0n;

      const loanRequestableRaw =
        treasuryPaused
          ? 0n
          : toBigIntOrNull(loanRequestableFromBundle) ??
            toBigIntOrNull(loanRequestableDirect) ??
            (isMintReadyRaw ? loanRoomLeftRaw : 0n);

      const circulatingRaw =
        totalSupplyRaw > totalBurnedRaw ? totalSupplyRaw - totalBurnedRaw : 0n;

      const resolvedPdaiAddress =
        isAddress(treasuryPdaiAddress) && treasuryPdaiAddress !== ZERO
          ? treasuryPdaiAddress
          : CONFIG.PDAI_TOKEN;

      let pdaiSymbol = "pDAI";
      let pdaiDecimals = 18;
      let pdaiTotalSupplyRaw = 0n;
      let pdaiTreasuryBalanceRaw = 0n;

      if (isAddress(resolvedPdaiAddress) && resolvedPdaiAddress !== ZERO) {
        const pdaiMeta = await getTokenMeta(resolvedPdaiAddress);
        const pdai = new ethers.Contract(
          resolvedPdaiAddress,
          abiPack.erc20,
          readProvider
        );

        pdaiSymbol = pdaiMeta.symbol || "pDAI";
        pdaiDecimals = pdaiMeta.decimals || 18;

        pdaiTotalSupplyRaw = await readAny(pdai, ["totalSupply"], 0n);
        pdaiTreasuryBalanceRaw = await readAny(
          pdai,
          [["balanceOf", CONFIG.JACK_TREASURY]],
          0n
        );
      }

      const now = Math.floor(Date.now() / 1000);
      const until = Number(overrideUntil || 0n);
      const isManual = until && until > now && Number(overrideFeeBP || 0n) > 0;

      setLIVE({
        symbol,
        feeBP,
        burnShareBP,
        configuredBurnShareBP,
        minFeeBP,
        maxFeeBP,
        startBurnShareBP,
        endBurnShareBP,
        treasuryTarget: treasuryTargetRaw,
        treasuryJack: treasuryJackBalanceRaw,
        overrideFeeBP,
        overrideUntil,

        loanOutstanding: loanOutstandingRaw,
        loanRepaid: loanRepaidRaw,
        loanRequestable: loanRequestableRaw,
        loanRoomLeft: loanRoomLeftRaw,
      });

      setOverview({
        name,
        symbol,
        decimals,

        jackTokenAddress: CONFIG.JACK_TOKEN,
        jackTokenAddressShort: shortAddress(CONFIG.JACK_TOKEN),

        supply: fmtToken(totalSupplyRaw, decimals, symbol, 2),
        burned: fmtToken(totalBurnedRaw, decimals, symbol, 2),
        circulating: fmtToken(circulatingRaw, decimals, symbol, 2),
        mintable: fmtToken(mintableRaw, decimals, symbol, 2),
        lastMint: fmtTime(lastMintRaw),
        nextMint: fmtTime(nextMintRaw),
        isMintReady: isMintReadyRaw ? "Ready" : "Not ready",

        feePct: feePpbToPctStr(feeBP),
        burnSharePct: burnShareToPctStr(burnShareBP),
        configuredBurnSharePct: burnShareToPctStr(configuredBurnShareBP),
        feeMode: isManual ? "Manual override active" : "Dynamic",
        manualExpiry: isManual ? fmtTime(overrideUntil) : "–",
        treasuryTarget: fmtToken(treasuryTargetRaw, decimals, symbol, 2),
        maxMinFee: `${feePpbToPctStr(maxFeeBP)} / ${feePpbToPctStr(minFeeBP)}`,
        burnShareRange: `${burnShareToPctStr(startBurnShareBP)} → ${burnShareToPctStr(endBurnShareBP)}`,

        treasuryJack: fmtToken(treasuryJackBalanceRaw, decimals, symbol, 2),
        jackIncome5Y: fmtToken(totalJackIncomeFiveYearsRaw, decimals, symbol, 2),
        jackPushedFees5Y: fmtToken(
          totalJackPushedFeesFiveYearsRaw,
          decimals,
          symbol,
          2
        ),
        todayNet: fmtToken(todayJackIncomeRaw, decimals, symbol, 2),
        todayPushed: fmtToken(todayPushedFeesRaw, decimals, symbol, 2),

        loanOutstanding: fmtToken(loanOutstandingRaw, decimals, symbol, 2),
        loanRepaid: fmtToken(loanRepaidRaw, decimals, symbol, 2),
        loanRequestable: fmtToken(loanRequestableRaw, decimals, symbol, 2),
        loanRoomLeft: fmtToken(loanRoomLeftRaw, decimals, symbol, 2),

        treasuryAddress: CONFIG.JACK_TREASURY,
        treasuryAddressShort: shortAddress(CONFIG.JACK_TREASURY),
        treasuryOwner,
        treasuryOwnerShort: shortAddress(treasuryOwner),
        treasuryStatus: treasuryPaused ? "Paused" : "Active",
        treasuryPaused,
        routerAddress,
        routerAddressShort: shortAddress(routerAddress),
        wplsAddress,
        wplsAddressShort: shortAddress(wplsAddress),

        pdaiAddress: resolvedPdaiAddress,
        pdaiAddressShort: shortAddress(resolvedPdaiAddress),
        pdaiSymbol,
        pdaiDecimals,
        pdaiTotalSupply: fmtToken(pdaiTotalSupplyRaw, pdaiDecimals, pdaiSymbol, 2),
        pdaiTreasuryBalance: fmtToken(
          pdaiTreasuryBalanceRaw,
          pdaiDecimals,
          pdaiSymbol,
          2
        ),
        pdaiTreasuryReserves: fmtToken(
          pdaiTreasuryReservesRaw,
          pdaiDecimals,
          pdaiSymbol,
          2
        ),
        pdaiIncome5Y: fmtToken(
          totalPdaiIncomeFiveYearsRaw,
          pdaiDecimals,
          pdaiSymbol,
          2
        ),
        pdaiReserveDeposits5Y: fmtToken(
          totalPdaiReserveDepositsFiveYearsRaw,
          pdaiDecimals,
          pdaiSymbol,
          2
        ),
        pdaiReservesIn: fmtToken(
          totalPdaiReservesInRaw,
          pdaiDecimals,
          pdaiSymbol,
          2
        ),
        pdaiReservesOut: fmtToken(
          totalPdaiReservesOutRaw,
          pdaiDecimals,
          pdaiSymbol,
          2
        ),
        pdaiTodayIncome: fmtToken(pdaiTodayIncomeRaw, pdaiDecimals, pdaiSymbol, 2),
        pdaiTodayReserveDeposits: fmtToken(
          pdaiTodayReserveDepositsRaw,
          pdaiDecimals,
          pdaiSymbol,
          2
        ),

        jackPegReturns5Y: fmtToken(
          totalJackPegReturnsFiveYearsRaw,
          decimals,
          symbol,
          2
        ),
        pdaiPegReturns5Y: fmtToken(
          totalPdaiPegReturnsFiveYearsRaw,
          pdaiDecimals,
          pdaiSymbol,
          2
        ),
        todayJackPegReturns: fmtToken(todayJackPegReturnsRaw, decimals, symbol, 2),
        todayPdaiPegReturns: fmtToken(
          todayPdaiPegReturnsRaw,
          pdaiDecimals,
          pdaiSymbol,
          2
        ),
      });

      setGlobalStatus(
        treasuryPaused
          ? "✅ Live Treasury data loaded. Treasury is paused."
          : "✅ Live Treasury data loaded."
      );
    } catch (error) {
      console.error(error);
      setGlobalStatus(`❌ ${error?.message || "Treasury overview read failed."}`);
    }
  }, [
    CONFIG.JACK_TOKEN,
    CONFIG.JACK_TREASURY,
    CONFIG.PDAI_TOKEN,
    CONFIG.WPLS_TOKEN,
    abiPack,
    configReady,
    getTokenMeta,
    readProvider,
  ]);

  const refreshVault = useCallback(async () => {
    if (!configReady || !readProvider || !abiPack?.erc20 || !abiPack?.treasury) {
      return;
    }

    const treasury = new ethers.Contract(
      CONFIG.JACK_TREASURY,
      abiPack.treasury,
      readProvider
    );

    try {
      const tokens = await readAny(treasury, ["getHoldingTokens"], []);
      const rows = [];

      for (let i = 0; i < tokens.length; i++) {
        const addr = tokens[i];
        const meta = await getTokenMeta(addr);

        const actualRaw =
          addr === ZERO
            ? await readProvider.getBalance(CONFIG.JACK_TREASURY)
            : await readAny(
                new ethers.Contract(addr, abiPack.erc20, readProvider),
                [["balanceOf", CONFIG.JACK_TREASURY]],
                0n
              );

        const trackedRaw = await readAny(
          treasury,
          [["trackedHoldings", addr]],
          0n
        );

        const usableRaw = await readAny(
          treasury,
          [["getUsableHoldingBalance", addr]],
          0n
        );

        rows.push({
          symbol: meta.symbol,
          name: meta.name,
          addr,
          addrShort: addr === ZERO ? "PLS (native)" : shortAddress(addr),
          actual: fmtUnits(actualRaw, meta.decimals, 6),
          tracked: fmtUnits(trackedRaw, meta.decimals, 6),
          usable: fmtUnits(usableRaw, meta.decimals, 6),
        });
      }

      setHoldingsRows(rows);
      setHoldingsStatus(
        rows.length ? "✅ Holdings loaded." : "No holding tokens found."
      );
    } catch (error) {
      console.error(error);
      setHoldingsStatus(`❌ ${error?.message || "Holdings read failed."}`);
    }

    try {
      const lpTokens = await readAny(treasury, ["getLpTokens"], []);
      const rows = [];

      for (let i = 0; i < lpTokens.length; i++) {
        const addr = lpTokens[i];
        const meta = await getTokenMeta(addr);

        const balanceRaw = await readAny(
          new ethers.Contract(addr, abiPack.erc20, readProvider),
          [["balanceOf", CONFIG.JACK_TREASURY]],
          0n
        );

        rows.push({
          symbol: meta.symbol,
          name: meta.name,
          addr,
          addrShort: shortAddress(addr),
          bal: fmtUnits(balanceRaw, meta.decimals, 6),
        });
      }

      setLpRows(rows);
      setLpStatus(rows.length ? "✅ LP list loaded." : "No LP tokens found.");
    } catch (error) {
      console.error(error);
      setLpStatus(`❌ ${error?.message || "LP read failed."}`);
    }
  }, [
    CONFIG.JACK_TREASURY,
    abiPack?.erc20,
    abiPack?.treasury,
    configReady,
    getTokenMeta,
    readProvider,
  ]);

  const loadEvents = useCallback(async () => {
    if (
      !configReady ||
      !readProvider ||
      !abiPack?.jackToken ||
      !abiPack?.treasury
    ) {
      return;
    }

    try {
      setEventsStatus("Loading events…");

      const latest = await readProvider.getBlockNumber();
      const from = Math.max(0, latest - (CONFIG.EVENT_LOOKBACK_BLOCKS || 2000));

      const treasury = new ethers.Contract(
        CONFIG.JACK_TREASURY,
        abiPack.treasury,
        readProvider
      );

      const jack = new ethers.Contract(
        CONFIG.JACK_TOKEN,
        abiPack.jackToken,
        readProvider
      );

      const logs = [];

      const [
        tokenSwapped,
        loanRepaid,
        holdingsSynced,
        pdaiIncome,
        pdaiReserveDeposited,
        pdaiReserveSent,
        jackIncomeRecorded,
        pushedFeeRecorded,
        burns,
        feeOverrides,
        feeOverrideExpired,
      ] = await Promise.all([
        safeRead(
          () => treasury.queryFilter(treasury.filters.TokenSwapped(), from, latest),
          []
        ),
        safeRead(
          () => treasury.queryFilter(treasury.filters.LoanRepaid(), from, latest),
          []
        ),
        safeRead(
          () => treasury.queryFilter(treasury.filters.HoldingsSynced(), from, latest),
          []
        ),
        safeRead(
          () =>
            treasury.queryFilter(
              treasury.filters.PdaiIncomeReceived(),
              from,
              latest
            ),
          []
        ),
        safeRead(
          () =>
            treasury.queryFilter(
              treasury.filters.PdaiReserveDeposited(),
              from,
              latest
            ),
          []
        ),
        safeRead(
          () =>
            treasury.queryFilter(treasury.filters.PdaiReserveSent(), from, latest),
          []
        ),
        safeRead(
          () =>
            treasury.queryFilter(
              treasury.filters.JackIncomeRecorded(),
              from,
              latest
            ),
          []
        ),
        safeRead(
          () =>
            treasury.queryFilter(
              treasury.filters.PushedFeeRecorded(),
              from,
              latest
            ),
          []
        ),
        safeRead(() => jack.queryFilter(jack.filters.Burn(), from, latest), []),
        safeRead(
          () => jack.queryFilter(jack.filters.FeeOverrideActivated(), from, latest),
          []
        ),
        safeRead(
          () => jack.queryFilter(jack.filters.FeeOverrideExpired(), from, latest),
          []
        ),
      ]);

      for (const event of tokenSwapped) {
        logs.push({
          block: event.blockNumber,
          c: "Treasury",
          ev: "TokenSwapped",
          d: `token ${shortAddress(event.args.token)} in ${event.args.amountIn.toString()} out ${event.args.jackReceivedNet.toString()}`,
        });
      }

      for (const event of loanRepaid) {
        logs.push({
          block: event.blockNumber,
          c: "Treasury",
          ev: "LoanRepaid",
          d: `burned ${event.args.burned.toString()} remaining ${event.args.remainingLoan.toString()}`,
        });
      }

      for (const event of holdingsSynced) {
        logs.push({
          block: event.blockNumber,
          c: "Treasury",
          ev: "HoldingsSynced",
          d: `count ${event.args.count.toString()}`,
        });
      }

      for (const event of pdaiIncome) {
        logs.push({
          block: event.blockNumber,
          c: "Treasury",
          ev: "PdaiIncomeReceived",
          d: `from ${shortAddress(event.args.from)} amount ${event.args.amountReceived.toString()}`,
        });
      }

      for (const event of pdaiReserveDeposited) {
        logs.push({
          block: event.blockNumber,
          c: "Treasury",
          ev: "PdaiReserveDeposited",
          d: `from ${shortAddress(event.args.from)} amount ${event.args.amountReceived.toString()}`,
        });
      }

      for (const event of pdaiReserveSent) {
        logs.push({
          block: event.blockNumber,
          c: "Treasury",
          ev: "PdaiReserveSent",
          d: `to ${shortAddress(event.args.to)} amount ${event.args.amount.toString()}`,
        });
      }

      for (const event of jackIncomeRecorded) {
        logs.push({
          block: event.blockNumber,
          c: "Treasury",
          ev: "JackIncomeRecorded",
          d: `amount ${event.args.jackNetRecorded.toString()}`,
        });
      }

      for (const event of pushedFeeRecorded) {
        logs.push({
          block: event.blockNumber,
          c: "Treasury",
          ev: "PushedFeeRecorded",
          d: `amount ${event.args.jackTreasuryPart.toString()}`,
        });
      }

      for (const event of burns) {
        logs.push({
          block: event.blockNumber,
          c: "JackToken",
          ev: "Burn",
          d: `from ${shortAddress(event.args.from)} amount ${event.args.amount.toString()}`,
        });
      }

      for (const event of feeOverrides) {
        logs.push({
          block: event.blockNumber,
          c: "JackToken",
          ev: "FeeOverrideActivated",
          d: `feeBP ${event.args.feeBP.toString()} until ${event.args.until.toString()}`,
        });
      }

      for (const event of feeOverrideExpired) {
        logs.push({
          block: event.blockNumber,
          c: "JackToken",
          ev: "FeeOverrideExpired",
          d: "expired",
        });
      }

      logs.sort((a, b) => b.block - a.block);
      setEventsRows(logs.slice(0, 80));
      setEventsStatus(`✅ Loaded ${logs.length} events. Showing up to 80.`);
    } catch (error) {
      console.error(error);
      setEventsStatus(`❌ ${error?.message || "Event loading failed."}`);
    }
  }, [
    CONFIG.EVENT_LOOKBACK_BLOCKS,
    CONFIG.JACK_TOKEN,
    CONFIG.JACK_TREASURY,
    abiPack?.jackToken,
    abiPack?.treasury,
    configReady,
    readProvider,
  ]);

  const refreshAll = useCallback(async () => {
    await refreshOverview();
    await refreshVault();
  }, [refreshOverview, refreshVault]);

  useEffect(() => {
    if (CONFIG.RPC_URL) {
      try {
        setRpcProvider(new ethers.JsonRpcProvider(CONFIG.RPC_URL));
      } catch (error) {
        console.error(error);
      }
    }

    if (window.ethereum) {
      setWeb3Provider(new ethers.BrowserProvider(window.ethereum));

      window.ethereum
        .request?.({ method: "eth_accounts" })
        .then((accounts) => {
          if (accounts?.length) {
            setUserAddress(accounts[0]);
          }
        })
        .catch(() => {});
    }
  }, [CONFIG.RPC_URL]);

  useEffect(() => {
    if (!window.ethereum) return;

    const onAccountsChanged = (accounts) => {
      if (!accounts || !accounts.length) {
        setUserAddress(null);
        setGlobalStatus("Disconnected.");
        return;
      }

      setUserAddress(accounts[0]);
    };

    const onChainChanged = () => {
      setGlobalStatus("Chain changed. Refreshing…");
      refreshAll();
    };

    window.ethereum.on?.("accountsChanged", onAccountsChanged);
    window.ethereum.on?.("chainChanged", onChainChanged);

    return () => {
      window.ethereum.removeListener?.("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener?.("chainChanged", onChainChanged);
    };
  }, [refreshAll]);

  useEffect(() => {
    if (!configReady) {
      setGlobalStatus("Preview mode. Add your addresses + RPC inside ENV.");
      return;
    }

    if (!readProvider || !abiPack) return;

    refreshAll();
  }, [abiPack, configReady, readProvider, refreshAll]);

  const computed = useMemo(() => {
    const fee = Number(LIVE.feeBP || 0n);
    const min = Number(LIVE.minFeeBP || 0n);
    const max = Number(LIVE.maxFeeBP || 0n);

    const burnBP = Number(
      ((LIVE.feeBP || 0n) * (LIVE.burnShareBP || 0n)) / 10000n
    );

    let feePct = 0.55;

    if (max > min) {
      feePct = (fee - min) / (max - min);
    }

    feePct = Math.max(0, Math.min(1, feePct));

    const burnSharePct = Math.max(
      0,
      Math.min(100, Number(LIVE.burnShareBP || 0n) / 100)
    );

    const treSharePct = Math.max(0, 100 - burnSharePct);

    const now = Math.floor(Date.now() / 1000);
    const until = Number(LIVE.overrideUntil || 0n);

    const mode =
      until && until > now ? "Manual override active" : "Auto-tuned by Treasury";

    return {
      fee,
      burnBP,
      feePctStr: feePpbToPctStr(LIVE.feeBP),
      burnPctStr: burnShareToPctStr(LIVE.burnShareBP),
      configuredBurnPctStr: burnShareToPctStr(LIVE.configuredBurnShareBP),
      feePos: `${(feePct * 100).toFixed(1)}%`,
      burnSharePct,
      treSharePct,
      mode,
    };
  }, [LIVE]);

  return {
    CONFIG,
    configReady,
    readProvider,
    userAddress,
    globalStatus,

    overview,
    LIVE,
    computed,

    holdingsRows,
    lpRows,
    holdingsStatus,
    lpStatus,

    eventsRows,
    eventsStatus,

    refreshOverview,
    refreshVault,
    refreshAll,
    loadEvents,
  };
}