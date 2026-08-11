// src/pages/Mining.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BrowserProvider,
  Contract,
  formatUnits,
  parseUnits,
  ZeroAddress,
} from "ethers";

import styles from "../styles/Mining.module.css";

import miningBg from "../assets/mining-bg.png";
import miningHeroGif from "../assets/jack-mining.png";
import miningStatusIcon from "../assets/jack_mining_status_lock_transparent.png";
import timeLeftIcon from "../assets/jack_time_left_hourglass_transparent.png";
import calendarIconImg from "../assets/kawaii_calendar_with_cute_face.png";
import carrotIconImg from "../assets/cartoon_carrot_with_green_leaves.png";

import miningPointsIconImg from "../assets/mining-points-icon.png";
import miningShareIconImg from "../assets/mining-share-icon.png";
import miningEstimatedJackIconImg from "../assets/mining-estimated-jack-icon.png";
import miningMinersIconImg from "../assets/mining-miners-icon.png";

import plsTokenImg from "../assets/pls.svg";
import plsxTokenImg from "../assets/plsx.svg";
import hexTokenImg from "../assets/hex.svg";
import incTokenImg from "../assets/inc.svg";

/** 🔁 PUT YOUR REAL JACKMINING ADDRESS HERE */
const JACK_MINING_ADDRESS = "0x23E25b938E6c30C4D70C8D90bffa3E78b9f9f19a";

/** Assume 18 decimals for fee token */
const FEE_TOKEN_DECIMALS = 18;

/** Used only as fallback display when contract cap is unavailable */
const FALLBACK_WEEKLY_JACK_CAP = 100000;

const ERC20_SYMBOL_ABI = ["function symbol() view returns (string)"];

const TOKEN_ICON_BY_SYMBOL = {
  PLS: plsTokenImg,
  WPLS: plsTokenImg,
  PLSX: plsxTokenImg,
  HEX: hexTokenImg,
  INC: incTokenImg,
};

function normalizeTokenSymbol(symbol) {
  return String(symbol || "TOKEN").trim().toUpperCase();
}

function getFeeTokenIcon(symbol) {
  const cleanSymbol = normalizeTokenSymbol(symbol);
  return TOKEN_ICON_BY_SYMBOL[cleanSymbol] || plsTokenImg;
}

/* -----------------------------
   ABI LOADING FROM /public/abis
------------------------------ */

let jackMiningAbiCache = null;
let erc20AbiCache = null;

async function loadJackMiningAbi() {
  if (jackMiningAbiCache) return jackMiningAbiCache;

  const res = await fetch("/abis/JackMining.json");

  if (!res.ok) {
    throw new Error("Failed to load JackMining ABI from /abis/JackMining.json");
  }

  jackMiningAbiCache = await res.json();
  return jackMiningAbiCache;
}

async function loadErc20Abi() {
  if (erc20AbiCache) return erc20AbiCache;

  const res = await fetch("/abis/IERC20.json");

  if (!res.ok) {
    throw new Error("Failed to load IERC20 ABI from /abis/IERC20.json");
  }

  erc20AbiCache = await res.json();
  return erc20AbiCache;
}

async function getJackMiningContract(withSigner = false) {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No wallet provider found. Please install MetaMask.");
  }

  const abi = await loadJackMiningAbi();
  const provider = new BrowserProvider(window.ethereum);

  if (!withSigner) {
    return new Contract(JACK_MINING_ADDRESS, abi, provider);
  }

  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();

  return new Contract(JACK_MINING_ADDRESS, abi, signer);
}

async function getErc20Contract(tokenAddress) {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No wallet provider found. Please install MetaMask.");
  }

  const abi = await loadErc20Abi();
  const provider = new BrowserProvider(window.ethereum);

  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();

  return {
    token: new Contract(tokenAddress, abi, signer),
    signer,
  };
}

function formatDuration(secondsTotal) {
  const total = Number(secondsTotal || 0);

  if (!total || total <= 0) return "0m 0s";

  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);

  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;

  return `${m}m ${s}s`;
}

function formatShortNumber(value, maxFractionDigits = 2) {
  const num = Number(value || 0);

  if (Number.isNaN(num)) return "0";

  return num.toLocaleString(undefined, {
    maximumFractionDigits: maxFractionDigits,
  });
}

export default function Mining() {
  const pageStyle = useMemo(
    () => ({
      "--mining-page-bg": `url(${miningBg})`,
    }),
    []
  );

  const [amount, setAmount] = useState("");
  const [approved, setApproved] = useState(false);
  const [deployHint, setDeployHint] = useState(
    "💡 Hint: Enter an amount and deploy your miner for this weekly fee window."
  );

  const [userPoints, setUserPoints] = useState(0);
  const [userJack, setUserJack] = useState(0);
  const [userShare, setUserShare] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [currentWeek, setCurrentWeek] = useState(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(null);
  const [totalFees, setTotalFees] = useState(null);
  const [feeTokenLabel, setFeeTokenLabel] = useState("PLS");
  const [feeTokenAddress, setFeeTokenAddress] = useState(ZeroAddress);
  const [miningOpen, setMiningOpen] = useState(false);

  const [weeklyJackPool, setWeeklyJackPool] = useState(0);
  const [weeklyJackCap, setWeeklyJackCap] = useState(FALLBACK_WEEKLY_JACK_CAP);
  const [reserveFutureWeeks, setReserveFutureWeeks] = useState(0);

  const [fundingMode, setFundingMode] = useState("NONE");
  const [lastFundingAttempt, setLastFundingAttempt] = useState("Never");

  const [needsApproval, setNeedsApproval] = useState(false);
  const [checkingAllowance, setCheckingAllowance] = useState(false);

  const hasAmount = amount && Number(amount) > 0;

  const formattedPoints = useMemo(
    () => userPoints.toLocaleString(),
    [userPoints]
  );

  const formattedJack = useMemo(() => userJack.toFixed(2), [userJack]);

  const formattedShareThisWeek = useMemo(() => {
    if (userShare == null) return "0.00%";
    return `${userShare.toFixed(2)}%`;
  }, [userShare]);

  const formattedWeek = currentWeek ?? "—";

  const formattedTimeLeft = useMemo(
    () => (timeLeftSeconds == null ? "0m 0s" : formatDuration(timeLeftSeconds)),
    [timeLeftSeconds]
  );

  const formattedTotalFees = useMemo(() => {
    if (totalFees == null) return "0";

    return totalFees.toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
  }, [totalFees]);

  const formattedWeeklyPool = useMemo(
    () => formatShortNumber(weeklyJackPool, 2),
    [weeklyJackPool]
  );

  const formattedWeeklyCap = useMemo(
    () => formatShortNumber(weeklyJackCap, 2),
    [weeklyJackCap]
  );

  const weeklyPoolPercent = useMemo(() => {
    if (!weeklyJackCap || weeklyJackCap <= 0) return 0;
    return Math.min(100, (weeklyJackPool / weeklyJackCap) * 100);
  }, [weeklyJackPool, weeklyJackCap]);

  const formattedWeeklyPoolPercent = useMemo(
    () =>
      weeklyPoolPercent.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      }),
    [weeklyPoolPercent]
  );

  const formattedReserveFutureWeeks = useMemo(
    () => formatShortNumber(reserveFutureWeeks, 2),
    [reserveFutureWeeks]
  );

  const feeTokenIconSrc = useMemo(
    () => getFeeTokenIcon(feeTokenLabel),
    [feeTokenLabel]
  );

  const minerDeployedThisWeek = userPoints > 0 ? "1" : "0";

  const refreshOnChainState = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!/^0x[0-9a-fA-F]{40}$/.test(JACK_MINING_ADDRESS)) {
        throw new Error(
          "JACK_MINING_ADDRESS is not a valid 0x address. Please update Mining.js."
        );
      }

      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("No wallet provider found. Please install MetaMask.");
      }

      const abi = await loadJackMiningAbi();
      const provider = new BrowserProvider(window.ethereum);
      const contract = new Contract(JACK_MINING_ADDRESS, abi, provider);

      const [
        availableJackBn,
        currentWeekIdBn,
        currentWeekInfo,
        timeLeftBn,
        paused,
        minActiveJackBn,
        jackWeeklyCapBn,
      ] = await Promise.all([
        contract.availableJack(),
        contract.currentWeekId(),
        contract.getCurrentWeekInfo(),
        contract.timeLeftInCurrentWeek(),
        contract.paused(),
        contract.MIN_ACTIVE_JACK(),
        contract.JACK_WEEKLY_CAP(),
      ]);

      let reserveFutureBn = 0n;

      try {
        if (typeof contract.storedReserveForNextWeek === "function") {
          reserveFutureBn = await contract.storedReserveForNextWeek();
        } else if (typeof contract.reserveForNextWeek === "function") {
          reserveFutureBn = await contract.reserveForNextWeek();
        }
      } catch (reserveErr) {
        reserveFutureBn = 0n;
      }

      const totalFeesFloat = parseFloat(
        formatUnits(currentWeekInfo.totalFees || 0n, FEE_TOKEN_DECIMALS)
      );

      const feeToken = currentWeekInfo.feeToken || ZeroAddress;
      let label = feeToken === ZeroAddress ? "PLS" : "TOKEN";

      if (feeToken !== ZeroAddress) {
        try {
          const symbolReader = new Contract(feeToken, ERC20_SYMBOL_ABI, provider);
          const symbol = await symbolReader.symbol();
          label = normalizeTokenSymbol(symbol);
        } catch (symbolErr) {
          label = "TOKEN";
        }
      }

      const timeLeft = Number(timeLeftBn || 0n);

      const open =
        !paused &&
        availableJackBn >= minActiveJackBn &&
        !currentWeekInfo.finalized &&
        timeLeft > 0;

      const currentIdNum = Number(currentWeekIdBn || 0n);

      const weeklyJackPoolFloat = parseFloat(
        formatUnits(currentWeekInfo.jackReward || 0n, 18)
      );

      const weeklyJackCapFloat = parseFloat(formatUnits(jackWeeklyCapBn, 18));
      const reserveFutureFloat = parseFloat(formatUnits(reserveFutureBn, 18));

      setCurrentWeek(currentIdNum);
      setTotalFees(totalFeesFloat);
      setFeeTokenLabel(label);
      setFeeTokenAddress(feeToken);
      setTimeLeftSeconds(timeLeft);
      setMiningOpen(open);

      setWeeklyJackPool(weeklyJackPoolFloat);
      setWeeklyJackCap(
        weeklyJackCapFloat > 0 ? weeklyJackCapFloat : FALLBACK_WEEKLY_JACK_CAP
      );
      setReserveFutureWeeks(reserveFutureFloat);

      setFundingMode(open ? "ORGANIC" : "NONE");

      const accounts = await provider.send("eth_accounts", []);

      if (!accounts || !accounts.length) {
        setUserShare(0);
        setUserPoints(0);
        setUserJack(0);
        return;
      }

      const userAddr = accounts[0];

      const userPointsCurrentBn = await contract.userPoints(
        currentWeekIdBn,
        userAddr
      );

      setUserPoints(Number(userPointsCurrentBn));

      const totalPointsCurrentBn = currentWeekInfo.totalPoints || 0n;

      let sharePercent = 0;

      if (totalPointsCurrentBn > 0n && userPointsCurrentBn > 0n) {
        sharePercent =
          Number((userPointsCurrentBn * 10000n) / totalPointsCurrentBn) / 100;
      }

      setUserShare(sharePercent);

      let rewardBaseBn = currentWeekInfo.jackReward || 0n;

      if (rewardBaseBn === 0n) {
        const freeJackBn = availableJackBn;
        rewardBaseBn =
          freeJackBn > jackWeeklyCapBn ? jackWeeklyCapBn : freeJackBn;
      }

      let estJackWeekBn = 0n;

      if (
        totalPointsCurrentBn > 0n &&
        userPointsCurrentBn > 0n &&
        rewardBaseBn > 0n
      ) {
        estJackWeekBn =
          (rewardBaseBn * userPointsCurrentBn) / totalPointsCurrentBn;
      }

      const estJackWeekFloat = parseFloat(formatUnits(estJackWeekBn, 18));
      setUserJack(estJackWeekFloat);
    } catch (err) {
      console.error("Mining refresh error:", err);
      setError(err.message || "Failed to load mining data from contract.");
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAllowance = useCallback(async () => {
    try {
      if (feeTokenAddress === ZeroAddress) {
        setNeedsApproval(false);
        setApproved(true);
        return;
      }

      if (!hasAmount) {
        setNeedsApproval(false);
        setApproved(false);
        return;
      }

      if (typeof window === "undefined" || !window.ethereum) {
        return;
      }

      setCheckingAllowance(true);

      const abi = await loadErc20Abi();
      const provider = new BrowserProvider(window.ethereum);

      const accounts = await provider.send("eth_accounts", []);

      if (!accounts || !accounts.length) {
        setNeedsApproval(false);
        setApproved(false);
        return;
      }

      const userAddress = accounts[0];
      const token = new Contract(feeTokenAddress, abi, provider);
      const amountWei = parseUnits(amount, FEE_TOKEN_DECIMALS);

      const allowanceBn = await token.allowance(
        userAddress,
        JACK_MINING_ADDRESS
      );

      if (allowanceBn >= amountWei) {
        setNeedsApproval(false);
        setApproved(true);
        setDeployHint(
          "✅ You already have enough allowance for this amount. You can deploy your miner."
        );
      } else {
        setNeedsApproval(true);
        setApproved(false);
        setDeployHint(
          "You need to approve this fee token before deploying a miner for this amount."
        );
      }
    } catch (err) {
      console.error("checkAllowance error:", err);
    } finally {
      setCheckingAllowance(false);
    }
  }, [amount, feeTokenAddress, hasAmount]);

  useEffect(() => {
    refreshOnChainState();
  }, [refreshOnChainState]);

  useEffect(() => {
    checkAllowance();
  }, [checkAllowance]);

  const handleApprove = useCallback(async () => {
    try {
      setError(null);

      if (!hasAmount) {
        setDeployHint("Enter an amount first so we know how much to approve.");
        return;
      }

      if (feeTokenAddress === ZeroAddress) {
        setApproved(true);
        setNeedsApproval(false);
        setDeployHint(
          "✅ This is a PLS week — no token approval needed. You can deploy your miner directly."
        );
        return;
      }

      const { token, signer } = await getErc20Contract(feeTokenAddress);
      const userAddr = await signer.getAddress();
      const amountWei = parseUnits(amount, FEE_TOKEN_DECIMALS);

      const currentAllowance = await token.allowance(
        userAddr,
        JACK_MINING_ADDRESS
      );

      if (currentAllowance >= amountWei) {
        setApproved(true);
        setNeedsApproval(false);
        setDeployHint(
          "✅ You already have enough allowance for this amount. You can deploy your miner."
        );
        return;
      }

      setLoading(true);
      setDeployHint("⏳ Sending approve transaction…");

      const tx = await token.approve(JACK_MINING_ADDRESS, amountWei);
      await tx.wait();

      setApproved(true);
      setNeedsApproval(false);
      setDeployHint(
        "✅ Fee token approved. You can now deploy your miner for this week."
      );
    } catch (err) {
      console.error("Approve error:", err);
      setError(err.reason || err.message || "Approve failed.");
    } finally {
      setLoading(false);
    }
  }, [amount, feeTokenAddress, hasAmount]);

  const handleDeploy = useCallback(async () => {
    try {
      setError(null);

      const raw = parseFloat(amount || "0");

      if (!raw || raw <= 0) {
        setDeployHint("Enter an amount greater than 0 to deploy a miner.");
        return;
      }

      if (feeTokenAddress !== ZeroAddress && (!approved || needsApproval)) {
        setDeployHint(
          "You clicked Deploy Miner, but the ERC-20 fee token isn't approved yet. Hit 'Approve Fee Token' first."
        );
        return;
      }

      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("No wallet provider found. Please install MetaMask.");
      }

      setLoading(true);

      const mining = await getJackMiningContract(true);
      const amountWei = parseUnits(amount, FEE_TOKEN_DECIMALS);

      let tx;

      if (feeTokenAddress === ZeroAddress) {
        tx = await mining.deployMiner(amountWei, { value: amountWei });
      } else {
        tx = await mining.deployMiner(amountWei);
      }

      setDeployHint("⛏ Deploying miner… waiting for confirmation.");
      await tx.wait();

      const extraPoints = Math.round(raw * 100000);
      const extraJack = raw * 0.05;

      setUserPoints((p) => p + extraPoints);
      setUserJack((p) => p + extraJack);
      setDeployHint("🎉 Miner deployed! Preview updated.");

      await refreshOnChainState();
      await checkAllowance();
    } catch (err) {
      console.error("Deploy error:", err);
      setError(err.reason || err.message || "Deploy miner failed.");
    } finally {
      setLoading(false);
    }
  }, [
    amount,
    approved,
    needsApproval,
    feeTokenAddress,
    refreshOnChainState,
    checkAllowance,
  ]);

  const handleTryFunding = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const mining = await getJackMiningContract(true);

      const functionNames = ["tryFunding", "fundCurrentWeek", "triggerFunding"];
      const fnName = functionNames.find(
        (name) => typeof mining[name] === "function"
      );

      if (!fnName) {
        setDeployHint("Funding function is not exposed in the current ABI.");
        setLastFundingAttempt("Checked");
        return;
      }

      setDeployHint("⏳ Trying funding… waiting for confirmation.");

      const tx = await mining[fnName]();
      await tx.wait();

      setLastFundingAttempt("Just now");
      setDeployHint("✅ Funding attempt completed.");

      await refreshOnChainState();
    } catch (err) {
      console.error("Try funding error:", err);
      setError(err.reason || err.message || "Funding attempt failed.");
    } finally {
      setLoading(false);
    }
  }, [refreshOnChainState]);

  const handleSyncWeek = useCallback(async () => {
    try {
      setError(null);
      setDeployHint("🔄 Syncing latest week data…");

      await refreshOnChainState();
      await checkAllowance();

      setDeployHint("✅ Week data synced.");
    } catch (err) {
      console.error("Sync Week error:", err);
      setError(err.reason || err.message || "Sync Week failed.");
    }
  }, [refreshOnChainState, checkAllowance]);

  return (
    <div className={styles.miningPage} style={pageStyle}>
      <main className={styles.main}>
        <section className={styles.leftColumn}>
          <div className={styles.heroCard}>
            <div className={styles.heroInner}>
              <div className={styles.heroContent}>
                <h1 className={styles.heroTitle}>
                  <span className={styles.heroTitleCream}>Mine Jack with</span>
                  <span className={styles.heroTitleGold}>
                    Weekly Fee Windows
                  </span>
                </h1>

                <p className={styles.heroText}>
                  Deploy miners using the weekly fee token, earn points based on{" "}
                  <strong>amount × seconds remaining</strong>, and share in JACK
                  emissions while supporting the PulseX ecosystem.
                </p>

                <div className={styles.badgeRow}>
                  <span className={styles.badge}>
                    <span className={styles.badgeIconSlot} aria-hidden="true">
                      <span
                        className={`${styles.badgeImagePlaceholder} ${styles.badgeCoinPlaceholder}`}
                      />
                    </span>
                    <span className={styles.badgeText}>
                      Weekly JACK
                      <br />
                      Emissions
                    </span>
                  </span>

                  <span className={`${styles.badge} ${styles.badgeSoft}`}>
                    <span className={styles.badgeIconSlot} aria-hidden="true">
                      <span
                        className={`${styles.badgeImagePlaceholder} ${styles.badgeChartPlaceholder}`}
                      />
                    </span>
                    <span className={styles.badgeText}>
                      DBXen-inspired
                      <br />
                      Fee Curves
                    </span>
                  </span>

                  <span className={`${styles.badge} ${styles.badgeGlow}`}>
                    <span className={styles.badgeIconSlot} aria-hidden="true">
                      <span
                        className={`${styles.badgeImagePlaceholder} ${styles.badgeRabbitPlaceholder}`}
                      />
                    </span>
                    <span className={styles.badgeText}>
                      Jack Rabbit
                      <br />
                      Ecosystem
                    </span>
                  </span>
                </div>
              </div>

              <div className={styles.heroVisual}>
                <img
                  src={miningHeroGif}
                  alt="Jack Rabbit mining"
                  className={styles.heroRabbitGif}
                />
              </div>
            </div>

            <div className={styles.metricsGrid}>
              <div className={`${styles.metricCard} ${styles.statusNoticeCard}`}>
                <div className={styles.statusIconColumn} aria-hidden="true">
                  <img
                    src={miningStatusIcon}
                    alt=""
                    className={`${styles.metricImageIcon} ${styles.miningStatusImage}`}
                  />
                </div>

                <div className={styles.statusNoticeBody}>
                  <div className={styles.statusNoticeHeader}>
                    <h3 className={styles.statusNoticeTitle}>Mining Status</h3>

                    <span
                      className={`${styles.statusPill} ${
                        miningOpen ? styles.statusOpen : styles.statusClosed
                      }`}
                    >
                      <span
                        className={`${styles.statusDot} ${
                          miningOpen ? "" : styles.statusDotOff
                        }`}
                      />
                      {miningOpen ? "OPEN" : "CLOSED"}
                    </span>
                  </div>

                  <p className={styles.statusNoticeText}>
                    {miningOpen
                      ? "Mining for this week is live. Deploy your miner before the window ends."
                      : "Mining for this week hasn't started yet. Please check back later!"}
                  </p>
                </div>
              </div>

              <div className={`${styles.metricCard} ${styles.currentWeekCard}`}>
                <div className={styles.metricIconColumn} aria-hidden="true">
                  <img
                    src={calendarIconImg}
                    alt=""
                    className={`${styles.metricImageIcon} ${styles.calendarImageIcon}`}
                  />
                </div>

                <div className={styles.currentWeekInfo}>
                  <h3 className={styles.metricTitle}>Current Week</h3>

                  <div className={styles.currentWeekNumber}>
                    #{formattedWeek}
                  </div>

                  <div className={styles.feeTokenLine}>
                    This Week&apos;s Fee Token:
                  </div>
                </div>
              </div>

              <div className={`${styles.metricCard} ${styles.smallInfoCard}`}>
                <div className={styles.metricIconColumn} aria-hidden="true">
                  <img
                    src={timeLeftIcon}
                    alt=""
                    className={`${styles.metricImageIcon} ${styles.timeLeftImage}`}
                  />
                </div>

                <div className={styles.smallInfoBody}>
                  <h3 className={styles.metricTitle}>Time Left This Week</h3>

                  <div className={styles.bigMetricValue}>
                    {formattedTimeLeft}
                  </div>

                  <p className={styles.metricDescription}>
                    {timeLeftSeconds && timeLeftSeconds > 0
                      ? "Earlier miners earn more points from the same amount."
                      : "New week will begin soon."}
                  </p>
                </div>
              </div>

              <div className={`${styles.metricCard} ${styles.feeTokenCard}`}>
                <div className={styles.feeTokenIconColumn} aria-hidden="true">
                  <div className={styles.weekFeeTokenImageWrap}>
                    <img
                      src={feeTokenIconSrc}
                      alt=""
                      className={styles.weekFeeTokenImage}
                    />
                  </div>
                </div>

                <div className={styles.feeTokenCardBody}>
                  <h3 className={styles.metricTitle}>Week Fee Token</h3>

                  <div className={styles.weekFeeTokenName}>
                    {feeTokenLabel}
                  </div>

                  <p className={styles.metricDescription}>
                    Fees collected this week:{" "}
                    <strong>
                      {formattedTotalFees} {feeTokenLabel}
                    </strong>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.poolCardsGrid}>
            <div className={styles.poolInfoCard}>
              <div className={styles.poolIconColumn} aria-hidden="true">
                <span className={styles.poolBagIcon} />
              </div>

              <div className={styles.poolCardBody}>
                <h3 className={styles.poolCardTitle}>Weekly JACK Pool</h3>

                <div className={styles.poolAmountLine}>
                  <span>{formattedWeeklyPool}</span>
                  <span className={styles.poolDivider}>/</span>
                  <span>{formattedWeeklyCap}</span>
                  <span className={styles.poolUnit}>JACK</span>
                </div>

                <div className={styles.poolProgressRow}>
                  <div className={styles.poolProgressTrack}>
                    <div
                      className={styles.poolProgressFill}
                      style={{ width: `${weeklyPoolPercent}%` }}
                    />
                  </div>

                  <span className={styles.poolPercent}>
                    {formattedWeeklyPoolPercent}%
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.poolInfoCard}>
              <div className={styles.poolIconColumn} aria-hidden="true">
                <span className={styles.poolChestIcon} />
              </div>

              <div className={styles.poolCardBody}>
                <h3 className={styles.poolCardTitle}>
                  Reserve for Future Weeks
                </h3>

                <div className={styles.reserveAmountLine}>
                  {formattedReserveFutureWeeks} JACK
                </div>

                <p className={styles.reserveDescription}>
                  Leftover &amp; unclaimed rewards are carried forward.
                </p>
              </div>

              <span className={styles.poolPaw} aria-hidden="true" />
            </div>
          </div>

          {(loading || checkingAllowance) && (
            <div className={styles.metricSub}>Syncing / sending tx…</div>
          )}

          {error && <div className={styles.metricSub}>⚠️ {error}</div>}
        </section>

        <section className={styles.panelRight}>
          <div className={`${styles.card} ${styles.deployCard}`}>
            <div className={styles.deployHeader}>
              <div className={styles.deployHeaderLeft}>
                <span className={styles.deployMinerIcon} aria-hidden="true" />

                <div>
                  <h2 className={styles.deployTitle}>Deploy Miner</h2>

                  <p className={styles.deployIntro}>
                    Join this week&apos;s mining window by spending the fee
                    token.
                    <br />
                    Your miner earns points as amount × seconds remaining until
                    the week ends.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className={styles.deploySyncButton}
                onClick={handleSyncWeek}
                disabled={loading || checkingAllowance}
              >
                {loading || checkingAllowance ? "Syncing…" : "Sync Week"}
              </button>
            </div>

            <label className={styles.deployLabel}>Amount ({feeTokenLabel})</label>

            <div className={styles.deployInputRow}>
              <input
                type="number"
                className={styles.deployInput}
                placeholder="0.0"
                min="0"
                step="0.001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />

              <div
                className={styles.tokenSelector}
                aria-label={`Selected fee token: ${feeTokenLabel}`}
              >
                <span className={styles.tokenSelectorCoin} aria-hidden="true">
                  <img
                    src={feeTokenIconSrc}
                    alt=""
                    className={styles.tokenSelectorImage}
                  />
                </span>

                <span className={styles.tokenSelectorLabel}>
                  {feeTokenLabel}
                </span>
              </div>
            </div>

            <div className={styles.deployInfoBox}>
              <div className={styles.deployInfoIcon}>i</div>

              <div>
                For native <strong>PLS weeks</strong>, you pay with PLS
                directly.
                <br />
                For ERC-20 weeks, you&apos;ll first approve the token, then
                deploy your miner.
              </div>
            </div>

            <div className={styles.deployActionsRow}>
              {feeTokenAddress !== ZeroAddress && needsApproval && (
                <button
                  type="button"
                  className={styles.deployApproveButton}
                  onClick={handleApprove}
                  disabled={loading}
                >
                  {loading ? "Approving…" : `Approve ${feeTokenLabel}`}
                </button>
              )}

              <button
                type="button"
                className={styles.deployButton}
                onClick={handleDeploy}
                disabled={loading || checkingAllowance}
              >
                {loading ? "Working…" : "Deploy Miner"}

                <img
                  src={carrotIconImg}
                  alt=""
                  className={styles.deployButtonCarrot}
                  aria-hidden="true"
                />
              </button>
            </div>

            <div className={styles.deployHint}>{deployHint}</div>
          </div>

          <div className={styles.positionPanel}>
            <div className={styles.positionHeader}>
              <div className={styles.positionTitleWrap}>
                <span className={styles.positionStar} aria-hidden="true" />
                <h2 className={styles.positionTitle}>Your Mining Position</h2>
              </div>
            </div>

            <div className={styles.positionStatsGrid}>
              <div className={styles.positionStatCard}>
                <span className={styles.positionStatIcon} aria-hidden="true">
                  <img
                    src={miningPointsIconImg}
                    alt=""
                    className={`${styles.positionStatIconImage} ${styles.positionPointsIconImage}`}
                  />
                </span>

                <div className={styles.positionStatContent}>
                  <div className={styles.positionStatLabel}>Your Points</div>
                  <div className={styles.positionStatValue}>{formattedPoints}</div>
                </div>
              </div>

              <div className={styles.positionStatCard}>
                <span className={styles.positionStatIcon} aria-hidden="true">
                  <img
                    src={miningShareIconImg}
                    alt=""
                    className={`${styles.positionStatIconImage} ${styles.positionShareIconImage}`}
                  />
                </span>

                <div className={styles.positionStatContent}>
                  <div className={styles.positionStatLabel}>Share This Week</div>
                  <div className={styles.positionStatValue}>
                    {formattedShareThisWeek}
                  </div>
                </div>
              </div>

              <div className={styles.positionStatCard}>
                <span className={styles.positionStatIcon} aria-hidden="true">
                  <img
                    src={miningEstimatedJackIconImg}
                    alt=""
                    className={`${styles.positionStatIconImage} ${styles.positionEstimatedJackIconImage}`}
                  />
                </span>

                <div className={styles.positionStatContent}>
                  <div className={styles.positionStatLabel}>Est. JACK</div>
                  <div
                    className={`${styles.positionStatValue} ${styles.positionStatValueRed}`}
                  >
                    {formattedJack}
                  </div>
                </div>
              </div>

              <div className={styles.positionStatCard}>
                <span className={styles.positionStatIcon} aria-hidden="true">
                  <img
                    src={miningMinersIconImg}
                    alt=""
                    className={`${styles.positionStatIconImage} ${styles.positionMinersIconImage}`}
                  />
                </span>

                <div className={styles.positionStatContent}>
                  <div className={styles.positionStatLabel}>
                    Miners This Week
                  </div>
                  <div className={styles.positionStatValue}>
                    {minerDeployedThisWeek}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.fundingPanel}>
          <div className={styles.fundingIconBox} aria-hidden="true">
            <span className={styles.fundingBankIcon} />
          </div>

          <div className={styles.fundingContent}>
            <h3 className={styles.fundingTitle}>Week Funding Engine</h3>
            <p className={styles.fundingText}>
              Current mode: <strong>{fundingMode}</strong>. If the active JACK
              pool runs low, funding can be attempted from treasury or reserve
              flow when the contract exposes the function.
            </p>
          </div>

          <div className={styles.fundingDivider} />

          <div className={styles.fundingAttemptBox}>
            <div className={styles.fundingAttemptLabel}>Last Attempt</div>
            <div className={styles.fundingAttemptValue}>{lastFundingAttempt}</div>
          </div>

          <button
            type="button"
            className={styles.tryFundingButton}
            onClick={handleTryFunding}
            disabled={loading}
          >
            Try Funding
            <img
              src={carrotIconImg}
              alt=""
              className={styles.tryFundingCarrotImage}
              aria-hidden="true"
            />
          </button>
        </section>
      </main>
    </div>
  );
}