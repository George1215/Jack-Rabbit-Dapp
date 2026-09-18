import { IS_UI_PREVIEW } from "../ui/UiContext";
// src/pages/Jackies.js
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  BrowserProvider,
  Contract,
  formatUnits,
  parseUnits,
  MaxUint256,
} from "ethers";
import styles from "../styles/Jackies.module.css";

import logoUNKNOWN from "../assets/unknown.png";
import jackLogo from "../assets/jacklogo.png";

// Banner assets copied from Diamond banner setup
import bannerCarrots from "../assets/banner-carrots.png";
import bannerRightGarden from "../assets/banner-right-garden.png";
import bannerRightMedallion from "../assets/banner-right-medallion.png";

/**
 * Same deployed JackStake address used by Diamond.js
 */
const JACKSTAKE_ADDRESS = "0x37eC79d0f2D4e9645C65d7bBF8d3c9f237cd3967";

/**
 * ERC20 metadata ABI
 */
const ERC20_META_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

function shortAddr(a) {
  if (!a) return "";
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function calcPoolSharePct(yourRaw, totalRaw) {
  try {
    const y = yourRaw ?? 0n;
    const t = totalRaw ?? 0n;

    if (t === 0n || y === 0n) return "—";

    const pct100 = (y * 10000n) / t;
    const whole = pct100 / 100n;
    const frac = pct100 % 100n;

    return `${whole.toString()}.${frac.toString().padStart(2, "0")}%`;
  } catch {
    return "—";
  }
}

function formatAmt(raw, decimals = 18, maxDecimals = 6) {
  try {
    const value = raw || 0n;
    const text = formatUnits(value, decimals);
    const [whole, dec = ""] = text.split(".");

    if (!dec) return whole;

    const trimmed = dec.slice(0, maxDecimals).replace(/0+$/, "");
    return trimmed ? `${whole}.${trimmed}` : whole;
  } catch {
    return "0";
  }
}

function formatReward2(raw, decimals = 18) {
  try {
    const value = raw || 0n;

    if (value === 0n) return "0.00";

    const amountText = formatUnits(value, decimals);
    const [wholePart, decimalPart = ""] = amountText.split(".");
    const twoDecimals = `${decimalPart}00`.slice(0, 2);

    if (wholePart === "0" && twoDecimals === "00") {
      return "<0.01";
    }

    const wholeWithCommas = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return `${wholeWithCommas}.${twoDecimals}`;
  } catch {
    return "0.00";
  }
}

function trimBalanceText(value, decimals = 4) {
  const str = String(value || "0");

  if (!str.includes(".")) return str;

  const [whole, dec = ""] = str.split(".");
  const clean = dec.slice(0, decimals);

  return clean ? `${whole}.${clean}` : whole;
}

export default function Jackies() {
  const toastTimerRef = useRef(null);
  const rowFxTimerRef = useRef(null);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("…");

  // Modal state
  const [isModalOpen, setModalOpen] = useState(false);
  const [activePoolTab, setActivePoolTab] = useState("stake");
  const [amount, setAmount] = useState("");
  const [userBalance, setUserBalance] = useState("0");

  // Wallet
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [user, setUser] = useState("");

  // ABI
  const [jackStakeAbi, setJackStakeAbi] = useState(null);

  // JACK token meta
  const [jackTokenAddress, setJackTokenAddress] = useState("");
  const [jackDecimals, setJackDecimals] = useState(18);
  const [jackSymbol, setJackSymbol] = useState("JACK");
  const [jackName, setJackName] = useState("JackRabbit");

  // PLS marker
  const [, setPlsMarker] = useState("");

  // Live staking data
  const [loadingStake, setLoadingStake] = useState(false);
  const [stakeInfo, setStakeInfo] = useState({
    totalRaw: 0n,
    yourRaw: 0n,
    balanceRaw: 0n,
  });

  // JACK staker reward rows
  const [rewardRows, setRewardRows] = useState([]);
  const [recentActionToken, setRecentActionToken] = useState("");

  const isConnected = !!user && !!signer;

  const showToast = useCallback((msg = "Jackies notice.") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    setToastMsg(typeof msg === "string" ? msg : "Jackies notice.");
    setToastVisible(true);

    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 3000);
  }, []);

  const triggerRewardRowFx = useCallback((token) => {
    if (rowFxTimerRef.current) clearTimeout(rowFxTimerRef.current);

    setRecentActionToken(token || "");

    rowFxTimerRef.current = setTimeout(() => {
      setRecentActionToken("");
    }, 5200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (rowFxTimerRef.current) clearTimeout(rowFxTimerRef.current);
    };
  }, []);

  // Load JackStake ABI from public/abis/JackStake.json
  useEffect(() => {
    let alive = true;

    async function loadJackStakeAbi() {
      try {
        const res = await fetch("/abis/JackStake.json", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`Failed to load JackStake ABI. Status: ${res.status}`);
        }

        const json = await res.json();
        const abi = Array.isArray(json) ? json : json.abi;

        if (!Array.isArray(abi)) {
          throw new Error(
            "Invalid JackStake ABI format. Expected ABI array or { abi: [...] }."
          );
        }

        if (alive) {
          setJackStakeAbi(abi);
        }
      } catch (e) {
        console.error("[Jackies] ABI load failed:", e);

        if (alive) {
          setJackStakeAbi(null);
          showToast(e?.message || "Failed to load JackStake ABI.");
        }
      }
    }

    loadJackStakeAbi();

    return () => {
      alive = false;
    };
  }, [showToast]);

  const jackStake = useMemo(() => {
    if (!signer || !jackStakeAbi) return null;
    return new Contract(JACKSTAKE_ADDRESS, jackStakeAbi, signer);
  }, [signer, jackStakeAbi]);

  const connectWallet = useCallback(async () => {
    try {
      if (!window.ethereum) {
        showToast("No wallet found. Install MetaMask or a Web3 wallet.");
        return;
      }

      const p = new BrowserProvider(window.ethereum);
      await p.send("eth_requestAccounts", []);

      const s = await p.getSigner();
      const addr = await s.getAddress();

      setProvider(p);
      setSigner(s);
      setUser(addr);

      showToast("Wallet connected.");
    } catch (e) {
      console.error(e);
      showToast(e?.shortMessage || e?.message || "Failed to connect wallet.");
    }
  }, [showToast]);

  const autoConnect = useCallback(async () => {
    if (IS_UI_PREVIEW) return;
    try {
      if (!window.ethereum) return;

      const p = new BrowserProvider(window.ethereum);
      const accounts = await p.send("eth_accounts", []);

      if (!accounts || accounts.length === 0) return;

      const s = await p.getSigner();
      const addr = await s.getAddress();

      setProvider(p);
      setSigner(s);
      setUser(addr);
    } catch (e) {
      console.error("[Jackies] autoConnect error:", e);
    }
  }, []);

  const assertContractLive = useCallback(async () => {
    if (!provider) throw new Error("Provider not ready.");

    const net = await provider.getNetwork();
    const code = await provider.getCode(JACKSTAKE_ADDRESS);

    console.log("[Jackies] chainId:", Number(net.chainId));
    console.log("[Jackies] contract:", JACKSTAKE_ADDRESS);
    console.log("[Jackies] code:", code);

    if (!code || code === "0x") {
      throw new Error(
        `No contract found at ${JACKSTAKE_ADDRESS} on chainId ${Number(
          net.chainId
        )}. Switch network in MetaMask.`
      );
    }
  }, [provider]);

  const readUserJackStake = useCallback(async (readJackStake, wallet) => {
    if (!wallet) return 0n;

    try {
      return await readJackStake.userStakeJack(wallet);
    } catch {
      try {
        return await readJackStake.getUserJackStake(wallet);
      } catch {
        return 0n;
      }
    }
  }, []);

  const loadJackiesData = useCallback(
    async (silent = true) => {
      if (!provider) return;

      if (!jackStakeAbi) {
        if (!silent) showToast("JackStake ABI is still loading.");
        return;
      }

      setLoadingStake(true);

      try {
        await assertContractLive();

        const readJackStake = new Contract(
          JACKSTAKE_ADDRESS,
          jackStakeAbi,
          provider
        );

        let marker = "0x0000000000000000000000000000000000000000";

        try {
          marker = String(await readJackStake.PLS()).toLowerCase();
        } catch (e) {
          console.warn("[Jackies] PLS() read failed, using address(0):", e);
        }

        setPlsMarker(marker);

        const jackAddr = await readJackStake.jack();
        setJackTokenAddress(jackAddr);

        const jackErc = new Contract(jackAddr, ERC20_META_ABI, provider);

        const [dec, sym, name] = await Promise.all([
          jackErc.decimals().catch(() => 18),
          jackErc.symbol().catch(() => "JACK"),
          jackErc.name().catch(() => "JackRabbit"),
        ]);

        const decimals = Number(dec || 18);
        const cleanName =
          name && String(name).toUpperCase() !== "JACK"
            ? String(name)
            : "JackRabbit";

        setJackDecimals(decimals);
        setJackSymbol(sym || "JACK");
        setJackName(cleanName);

        const [totalRaw, yourRaw, balanceRaw] = await Promise.all([
          readJackStake.totalStakedJack().catch(() => 0n),
          user ? readUserJackStake(readJackStake, user) : 0n,
          user ? jackErc.balanceOf(user).catch(() => 0n) : 0n,
        ]);

        setStakeInfo({
          totalRaw,
          yourRaw,
          balanceRaw,
        });

        let rewardTokenList = [];

        try {
          const list = await readJackStake.getRewardTokens();
          rewardTokenList = Array.isArray(list) ? list : [];
        } catch (e) {
          console.warn("[Jackies] getRewardTokens() failed:", e);
          rewardTokenList = [];
        }

        const rows = await Promise.all(
          rewardTokenList.map(async (token) => {
            const tokenLower = String(token).toLowerCase();
            const isPLS = marker && tokenLower === marker;

            let symbol = shortAddr(token);
            let name = "External Token";
            let decimals = 18;

            if (isPLS) {
              symbol = "PLS";
              name = "PulseChain";
              decimals = 18;
            } else {
              const erc = new Contract(token, ERC20_META_ABI, provider);

              const [n, s, d] = await Promise.all([
                erc.name().catch(() => ""),
                erc.symbol().catch(() => ""),
                erc.decimals().catch(() => 18),
              ]);

              name = n && n.length ? n : "External Token";
              symbol = s && s.length ? s : shortAddr(token);
              decimals = Number(d || 18);
            }

            let active = false;
            let reserveRaw = 0n;
            let ppmRaw = 0n;

            try {
              const overview = await readJackStake.getJackStakerRewardOverview(
                token
              );

              reserveRaw = overview?.[0] ?? 0n;
              ppmRaw = overview?.[2] ?? 0n;
              active = Boolean(overview?.[3]);
            } catch {
              reserveRaw = await readJackStake
                .getRewardStreamReserve(token)
                .catch(() => 0n);

              ppmRaw = await readJackStake.emissionRatePpm(token).catch(() => 0n);

              active = await readJackStake
                .isRewardTokenActive(token)
                .catch(() => false);
            }

            const pendingRaw = user
              ? await readJackStake
                  .pendingExternalReward(token, user)
                  .catch((e) => {
                    console.warn(
                      "[Jackies] pendingExternalReward failed:",
                      token,
                      e
                    );
                    return 0n;
                  })
              : 0n;

            return {
              token,
              name,
              symbol,
              decimals,
              active,
              reserveRaw,
              ppmRaw,
              pendingRaw,
            };
          })
        );

        setRewardRows(rows);

        if (!silent) {
          showToast(`JACK staking loaded. External tokens: ${rows.length}`);
        }
      } catch (e) {
        console.error("[Jackies] loadJackiesData error:", e);
        setRewardRows([]);
        showToast(
          e?.shortMessage || e?.message || "Failed to load JACK staking data."
        );
      } finally {
        setLoadingStake(false);
      }
    },
    [
      provider,
      user,
      jackStakeAbi,
      assertContractLive,
      readUserJackStake,
      showToast,
    ]
  );

  useEffect(() => {
    autoConnect();
  }, [autoConnect]);

  useEffect(() => {
    if (provider && jackStakeAbi) {
      loadJackiesData(true);
    }
  }, [provider, user, jackStakeAbi, loadJackiesData]);

  useEffect(() => {
    if (!window.ethereum) return;

    const onAccounts = async (accs) => {
      if (!accs || !accs.length) {
        setUser("");
        setSigner(null);
        setStakeInfo({
          totalRaw: 0n,
          yourRaw: 0n,
          balanceRaw: 0n,
        });
        setRewardRows([]);
        showToast("Wallet disconnected.");
        return;
      }

      connectWallet();
    };

    const onChain = () => {
      connectWallet();
    };

    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", onChain);

    return () => {
      window.ethereum.removeListener?.("accountsChanged", onAccounts);
      window.ethereum.removeListener?.("chainChanged", onChain);
    };
  }, [connectWallet, showToast]);

  function openModal(isStake) {
    if (!isConnected) {
      showToast("Connect wallet first.");
      return;
    }

    setActivePoolTab(isStake ? "stake" : "unstake");
    setAmount("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  const loadJackMetaAndBalance = useCallback(async () => {
    try {
      if (!provider || !user || !jackStakeAbi) {
        setUserBalance("0");
        return;
      }

      const readJackStake = new Contract(
        JACKSTAKE_ADDRESS,
        jackStakeAbi,
        provider
      );

      const jackAddr = jackTokenAddress || (await readJackStake.jack());
      const erc = new Contract(jackAddr, ERC20_META_ABI, provider);

      const dec = await erc.decimals().catch(() => 18);
      const sym = await erc.symbol().catch(() => "JACK");

      setJackDecimals(Number(dec));
      setJackSymbol(sym || "JACK");

      if (activePoolTab === "unstake") {
        const staked = await readUserJackStake(readJackStake, user);
        setUserBalance(formatUnits(staked, Number(dec)));
      } else {
        const bal = await erc.balanceOf(user);
        setUserBalance(formatUnits(bal, Number(dec)));
      }
    } catch (e) {
      console.error("[Jackies] loadJackMetaAndBalance error:", e);
      setUserBalance("0");
    }
  }, [
    provider,
    user,
    jackStakeAbi,
    jackTokenAddress,
    activePoolTab,
    readUserJackStake,
  ]);

  useEffect(() => {
    if (isModalOpen) {
      loadJackMetaAndBalance();
    }
  }, [isModalOpen, activePoolTab, loadJackMetaAndBalance]);

  const ensureJackAllowance = useCallback(
    async (amountRaw) => {
      if (!signer || !user) throw new Error("Wallet not connected.");
      if (!jackTokenAddress) {
        throw new Error("JACK token address not loaded yet.");
      }

      const erc = new Contract(jackTokenAddress, ERC20_META_ABI, signer);
      const allowance = await erc.allowance(user, JACKSTAKE_ADDRESS);

      if (allowance >= amountRaw) return;

      showToast("Approving JACK…");

      const tx = await erc.approve(JACKSTAKE_ADDRESS, MaxUint256);
      await tx.wait();

      showToast("Approval confirmed.");
    },
    [signer, user, jackTokenAddress, showToast]
  );

  async function confirmAction() {
    try {
      if (!isConnected) {
        showToast("Connect wallet first.");
        return;
      }

      if (!jackStake) throw new Error("Contract not ready.");

      if (!amount || Number(amount) <= 0) {
        showToast("Enter a valid amount.");
        return;
      }

      const amountRaw = parseUnits(amount.trim(), jackDecimals);

      if (amountRaw <= 0n) {
        showToast("Invalid amount.");
        return;
      }

      if (activePoolTab === "stake") {
        await ensureJackAllowance(amountRaw);

        showToast("Sending JACK stake tx…");

        const tx = await jackStake.stakeJackToken(amountRaw);
        await tx.wait();

        showToast("JACK stake successful.");
      } else {
        showToast("Sending JACK unstake tx…");

        const tx = await jackStake.unstakeJackToken(amountRaw);
        await tx.wait();

        showToast("JACK unstake successful.");
      }

      closeModal();
      await loadJackiesData(false);
    } catch (e) {
      console.error("[Jackies] confirmAction error:", e);
      showToast(e?.shortMessage || e?.message || "Transaction failed.");
    }
  }

  const onSyncRewards = useCallback(async () => {
    try {
      if (!isConnected) {
        showToast("Connect wallet first.");
        return;
      }

      if (!jackStake) throw new Error("Contract not ready.");

      const tokens = rewardRows.map((r) => r.token).filter(Boolean);

      if (tokens.length === 0) {
        showToast("No external tokens to sync yet.");
        return;
      }

      showToast("Syncing external token rewards…");

      const tx = await jackStake.updateManyJackRewardTokens(tokens);
      await tx.wait();

      showToast("External token rewards synced.");

      await loadJackiesData(false);
    } catch (e) {
      console.error("[Jackies] onSyncRewards error:", e);
      showToast(e?.shortMessage || e?.message || "Reward sync failed.");
    }
  }, [isConnected, jackStake, rewardRows, loadJackiesData, showToast]);

  const onClaimExternalToken = useCallback(
    async (row) => {
      try {
        if (!isConnected) {
          showToast("Connect wallet first.");
          return;
        }

        if (!jackStake) throw new Error("Contract not ready.");

        const pending = await jackStake
          .pendingExternalReward(row.token, user)
          .catch(() => row.pendingRaw || 0n);

        if (pending <= 0n) {
          showToast(`No ${row.symbol} rewards to claim yet.`);
          return;
        }

        showToast(`Claiming ${row.symbol}…`);

        const tx = await jackStake.claimExternalTokenAsReward(row.token);
        await tx.wait();

        showToast(`${row.symbol} claimed successfully.`);

        triggerRewardRowFx(row.token);
        await loadJackiesData(false);
      } catch (e) {
        console.error("[Jackies] onClaimExternalToken error:", e);
        showToast(e?.shortMessage || e?.message || "Claim failed.");
      }
    },
    [isConnected, jackStake, user, loadJackiesData, showToast, triggerRewardRowFx]
  );

  const totalStakedText = formatAmt(stakeInfo.totalRaw, jackDecimals);
  const yourStakeText = formatAmt(stakeInfo.yourRaw, jackDecimals);
  const poolShareText = calcPoolSharePct(stakeInfo.yourRaw, stakeInfo.totalRaw);

  return (
    <div
      className={`${styles["page-wrapper"]} ${styles["jack-bg-page"]} ${styles["diamond-page-transition"]}`}
    >
      <div className={styles["jack-bg-motifs"]} aria-hidden="true" />

      <main className={styles["page-shell"]}>
        {/* ===== Top Banner copied from Diamond structure ===== */}
        <div className={styles.topBanner}>
          <span className={styles.bannerA11y}>Jackies Banner</span>

          <div className={styles.bannerCarrotStage} aria-hidden="true">
            <img
              src={bannerCarrots}
              alt=""
              className={styles.bannerCarrotImage}
              draggable="false"
            />
          </div>

          <div className={styles.bannerRightStage} aria-hidden="true">
            <img
              src={bannerRightGarden}
              alt=""
              className={styles.bannerRightImage}
              draggable="false"
            />

            <img
              src={bannerRightMedallion}
              alt=""
              className={styles.bannerRightTopper}
              draggable="false"
            />
          </div>

          <div className={styles.bannerContent}>
            <h1 className={styles.bannerTitle}>Jackies Stack JACK.</h1>

            <p className={styles.bannerSubtitle}>
              Stake JACK to earn ecosystem rewards.
            </p>
          </div>
        </div>

        {/* App card */}
        <section className={styles["app-card"]}>
          <div className={styles["page-header-row"]}>
            <div>
              <p className={styles["page-subtitle"]}>
                Stake JACK to earn external token rewards from the Jack Rabbit
                reward pool.
              </p>
            </div>

            <div className={styles["status-chips"]}>
              <div className={styles.chip}>
                <span className={styles["chip-dot"]}></span>
                {isConnected ? "Wallet Live" : "Wallet Off"}
              </div>

              <button
                type="button"
                className={styles.chip}
                data-transaction="Connect or refresh wallet" onClick={isConnected ? () => loadJackiesData(false) : connectWallet}
                disabled={loadingStake}
              >
                <span className={`${styles["chip-dot"]} ${styles.red}`}></span>
                {loadingStake
                  ? "Loading..."
                  : isConnected
                  ? "Reload"
                  : "Connect Wallet"}
              </button>
            </div>
          </div>

          {/* JACK stakers layout */}
          <div className={styles["stake-layout"]}>
            {/* Left: JACK staking */}
            <div className={styles.panel}>
              <div className={styles["stake-mode-row"]}>
                <button
                  className={styles["mode-btn"]}
                  type="button"
                  onClick={() => openModal(true)}
                >
                  Stake
                </button>

                <button
                  className={`${styles["mode-btn"]} ${styles.secondary}`}
                  type="button"
                  onClick={() => openModal(false)}
                >
                  Unstake
                </button>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Total Staked</th>
                    <th>Your Stake</th>
                    <th>Pool Share</th>
                  </tr>
                </thead>

                <tbody>
                  {!isConnected ? (
                    <tr>
                      <td colSpan={4}>
                        Connect wallet to load JACK stake info from the contract.
                      </td>
                    </tr>
                  ) : loadingStake ? (
                    <tr>
                      <td colSpan={4}>Loading JACK staking data…</td>
                    </tr>
                  ) : (
                    <tr>
                      <td>
                        <div className={styles["jack-token-cell"]}>
                          <span className={styles["jack-token-logo-wrap"]}>
                            <img
                              src={jackLogo}
                              alt={jackSymbol}
                              className={styles["jack-token-logo"]}
                              onError={(e) => {
                                e.currentTarget.src = logoUNKNOWN;
                              }}
                            />
                          </span>

                          <span className={styles["jack-token-stack"]}>
                            <strong>{jackName || "JackRabbit"}</strong>
                            <small>{jackSymbol || "JACK"}</small>
                          </span>
                        </div>
                      </td>

                      <td>
                        {totalStakedText}
                        <span className={styles["sub-dollar"]}>$0</span>
                      </td>

                      <td>
                        {yourStakeText}
                        <span className={styles["sub-dollar"]}>$0</span>
                      </td>

                      <td>
                        <span className={styles["share-text"]}>
                          {poolShareText}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <p className={styles["small-note"]}>
                ✅ A one time <strong>5% fee</strong> of your total stake is
                taken for every JACK stake you make. No fee on withdrawals.
              </p>
            </div>

            {/* Right: External token rewards */}
            <aside className={styles["rewards-panel"]}>
              <div className={styles["rewards-header"]}>
                <div className={styles["rewards-title"]}>Rewards</div>

                <button
                  type="button"
                  className={styles["reward-pill"]}
                  data-transaction="onSyncRewards" onClick={onSyncRewards}
                  disabled={!isConnected || loadingStake || rewardRows.length === 0}
                  title={
                    !isConnected
                      ? "Connect wallet to sync rewards."
                      : "Sync external token rewards by calling updateManyJackRewardTokens()."
                  }
                >
                  {loadingStake ? "SYNCING..." : "SYNC REWARDS"}
                </button>
              </div>

              <div className={styles["reward-desc"]}>
                <p>Claim the ecosystem rewards earned by staking JACK.</p>
              </div>

              {loadingStake ? (
                <div className={styles["reward-row"]}>
                  <span className={styles["token-pill-dark"]}>
                    <span className={styles.rewardAmt}>Loading…</span>
                  </span>

                  <span className={styles["reward-amount"]}>—</span>

                  <button type="button" className={styles["claim-btn"]} disabled>
                    …
                  </button>
                </div>
              ) : rewardRows.length === 0 ? (
                <div className={styles["reward-row"]}>
                  <span className={styles["token-pill-dark"]}>
                    <span className={styles.rewardAmt}>0.00</span>
                  </span>

                  <span className={styles["reward-amount"]}>
                    No External Tokens
                  </span>

                  <button
                    type="button"
                    className={`${styles["claim-btn"]} ${styles["claim-disabled"]}`}
                    disabled
                  >
                    Claim
                  </button>
                </div>
              ) : (
                rewardRows.map((row) => {
                  const pendingText = formatReward2(row.pendingRaw, row.decimals);
                  const isDisabled = !isConnected || (row.pendingRaw ?? 0n) <= 0n;
                  const rewardRowFx =
                    recentActionToken &&
                    row.token?.toLowerCase() === recentActionToken.toLowerCase();

                  return (
                    <div
                      className={`${styles["reward-row"]} ${
                        rewardRowFx ? styles["reward-row-flash"] : ""
                      }`}
                      key={row.token}
                    >
                      <span className={styles["token-pill-dark"]} title={row.token}>
                        <span className={styles.rewardAmt}>{pendingText}</span>
                      </span>

                      <span className={styles["reward-amount"]}>
                        {isConnected ? `${row.symbol} Pool` : "—"}
                      </span>

                      <button
                        type="button"
                        className={`${styles["claim-btn"]} ${
                          isDisabled ? styles["claim-disabled"] : ""
                        }`}
                        data-transaction="Claim rewards" onClick={() => onClaimExternalToken(row)}
                        disabled={isDisabled}
                        title={
                          !isConnected
                            ? "Connect wallet to claim."
                            : (row.pendingRaw ?? 0n) <= 0n
                            ? `No ${row.symbol} rewards yet.`
                            : `Claim ${row.symbol}`
                        }
                      >
                        Claim
                      </button>
                    </div>
                  );
                })
              )}
            </aside>
          </div>
        </section>
      </main>

      {/* MODAL */}
      {isModalOpen && (
        <div className={`${styles.modal} ${styles.modalVisible}`}>
          <div className={styles.modalOverlay} onClick={closeModal} />

          <div className={styles.modalPanel}>
            <div className={styles.modalInner}>
              <h2 className={styles.modalTitle}>
                {activePoolTab === "stake" ? "Stake" : "Unstake"} {jackSymbol}
              </h2>

              <div className={styles.modalRow}>
                <div className={styles.amountShell}>
                  <div className={styles.tokenField}>
                    <span className={styles.tokenIconFake}>
                      {(jackSymbol || "J").slice(0, 1).toUpperCase()}
                    </span>

                    <span className={styles.tokenFieldText}>{jackSymbol}</span>

                    <span className={styles.tokenCaret} style={{ opacity: 0.35 }}>
                      ▾
                    </span>
                  </div>

                  <input
                    className={styles.modalInput}
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => {
                      const v = e.target.value;
                      const cleaned = v.replace(/[^0-9.]/g, "");
                      setAmount(cleaned);
                    }}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <span className={styles.modalBalance}>
                  {activePoolTab === "unstake" ? "Staked:" : "Balance:"}{" "}
                  <strong>{trimBalanceText(userBalance, 4)}</strong> {jackSymbol}
                </span>

                <button className={styles.claimBtn} data-transaction="confirmAction" onClick={confirmAction}>
                  {activePoolTab === "stake" ? "Stake" : "Unstake"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toastVisible && <div className={styles.toast}>{toastMsg}</div>}
    </div>
  );
}