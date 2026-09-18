import { IS_UI_PREVIEW } from "../ui/UiContext";
// src/pages/Diamond.js
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import styles from "../styles/Diamond.module.css";
import { BrowserProvider, Contract, formatUnits, parseUnits, MaxUint256 } from "ethers";
import logoPLS from "../assets/pls.svg";
import logoPLSX from "../assets/plsx.svg";
import logoHEX from "../assets/hex.svg";
import logoINC from "../assets/inc.svg";
import logoATROPA from "../assets/atropa.svg";
import logoPDAI from "../assets/pdai.svg";
import logoTEDDY from "../assets/teddy.png";
import logoUNKNOWN from "../assets/unknown.png";

// Banner assets
import bannerCarrots from "../assets/banner-carrots.png";
import bannerRightGarden from "../assets/banner-right-garden.png";
import bannerRightMedallion from "../assets/banner-right-medallion.png";

/**
 * OPTIONAL ICON PLACEHOLDERS
 *
 * Later, when you have your own popup/toast icons:
 *
 * 1) Import them at the top, for example:
 *    import iconPending from "../assets/toast-pending.png";
 *    import iconSuccess from "../assets/toast-success.png";
 *    import iconError from "../assets/toast-error.png";
 *    import iconStake from "../assets/popup-stake.png";
 *
 * 2) Then replace the empty strings below with the imported image variables.
 *
 * Keep empty string "" if you want the emoji fallback to show.
 */
const TOAST_ICON_PLACEHOLDERS = {
  info: "",
  pending: "",
  success: "",
  error: "",
};

const ACTION_POPUP_ICON_PLACEHOLDERS = {
  stake: "",
  unstake: "",
  claim: "",
};

/**
 * ✅ SET THIS
 * Put your deployed JackStake contract address here.
 */
const JACKSTAKE_ADDRESS = "0x37eC79d0f2D4e9645C65d7bBF8d3c9f237cd3967";


const TOKEN_LOGOS_BY_ADDRESS = {
  // PLSX
  "0x8a810ea8b121d08342e9e7696f4a9915cbe494b7": logoPLSX,

  // HEX
  "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39": logoHEX,

  // INC
  "0x6efafcb715f385c71d8af763e8478feea6fadf63": logoINC,

  // ATROPA
  "0x8f618a17f59b4b2bd9ab0fbcde0d7d2f66bfee3a": logoATROPA,

  // pDAI
  "0x72f99d6a755609ab03ce601e4674c059420901b9": logoPDAI,

  // TEDDY
  "0xe510cc9bafaaec0ce01995ed2b257422da32aac5": logoTEDDY,
};

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

function getTokenLogo(tokenAddr, plsMarker) {
  if (!tokenAddr) return logoUNKNOWN;

  const t = tokenAddr.toLowerCase();

  if (plsMarker && t === plsMarker.toLowerCase()) return logoPLS;

  return TOKEN_LOGOS_BY_ADDRESS[t] || logoUNKNOWN;
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
  } catch (e) {
    return "—";
  }
}

function getToastMeta(kind) {
  switch (kind) {
    case "pending":
      return { icon: "⏳", label: "IN PROGRESS" };
    case "success":
      return { icon: "🥕", label: "SUCCESS" };
    case "error":
      return { icon: "⚠️", label: "ALERT" };
    default:
      return { icon: "🐰", label: "JACK NOTICE" };
  }
}

function getActionFxPill(type) {
  if (type === "stake") return "BURROW BOOST";
  if (type === "unstake") return "SAFE EXIT";
  return "REWARD DROP";
}

export default function Diamond() {
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("…");
  const [toastKind, setToastKind] = useState("info");
  const [poolView, setPoolView] = useState("active");

  // ===== Modal State =====
  const [isModalOpen, setModalOpen] = useState(false);
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [activePoolTab, setActivePoolTab] = useState("stake");
  const [selectedToken, setSelectedToken] = useState("");
  const [amount, setAmount] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [userBalance, setUserBalance] = useState("0");
  const [plsMarker, setPlsMarker] = useState("");

  // wallet
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [user, setUser] = useState("");

  // live pools
  const [loadingPools, setLoadingPools] = useState(false);
  const [poolsLive, setPoolsLive] = useState([]);

// Contract ABI loaded from public/abis/JackStake.json
const [jackStakeAbi, setJackStakeAbi] = useState(null);

// JACK reward display
const [jackDecimals, setJackDecimals] = useState(18);

  // ===== Action animation state =====
  const fxTimerRef = useRef(null);
  const rowFxTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  const [recentActionToken, setRecentActionToken] = useState("");
  const [actionFx, setActionFx] = useState({
    visible: false,
    id: 0,
    type: "stake",
    emoji: "🥕",
    iconSrc: "",
    title: "",
    message: "",
  });

  const showToast = useCallback((msg, kind = "info") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    setToastKind(kind);
    setToastMsg(msg);
    setToastVisible(true);

    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 3400);
  }, []);

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

      // Supports both formats:
      // 1) Full artifact: { abi: [...] }
      // 2) Plain ABI array: [...]
      const abi = Array.isArray(json) ? json : json.abi;

      if (!Array.isArray(abi)) {
        throw new Error("Invalid JackStake ABI format. Expected ABI array or { abi: [...] }.");
      }

      if (alive) {
        setJackStakeAbi(abi);
      }
    } catch (e) {
      console.error("[Diamond] ABI load failed:", e);

      if (alive) {
        setJackStakeAbi(null);
        showToast(e?.message || "Failed to load JackStake ABI.", "error");
      }
    } finally {
      if (alive) {
      }
    }
  }

  loadJackStakeAbi();

  return () => {
    alive = false;
  };
}, [showToast]);

  const triggerActionFx = useCallback((type, title, message, emoji, tokenAddr = "") => {
    if (fxTimerRef.current) clearTimeout(fxTimerRef.current);
    if (rowFxTimerRef.current) clearTimeout(rowFxTimerRef.current);

    setActionFx((prev) => ({
      visible: true,
      id: prev.id + 1,
      type,
      emoji,
      iconSrc: ACTION_POPUP_ICON_PLACEHOLDERS[type] || "",
      title,
      message,
    }));

    if (tokenAddr) {
      setRecentActionToken(tokenAddr.toLowerCase());
    }

    fxTimerRef.current = setTimeout(() => {
      setActionFx((prev) => ({
        ...prev,
        visible: false,
      }));
    }, 4200);

    rowFxTimerRef.current = setTimeout(() => {
      setRecentActionToken("");
    }, 5200);
  }, []);

  useEffect(() => {
    return () => {
      if (fxTimerRef.current) clearTimeout(fxTimerRef.current);
      if (rowFxTimerRef.current) clearTimeout(rowFxTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const isConnected = !!user && !!signer;

const jackStake = useMemo(() => {
  if (!signer || !jackStakeAbi) return null;
  return new Contract(JACKSTAKE_ADDRESS, jackStakeAbi, signer);
}, [signer, jackStakeAbi]);

  const connectWallet = useCallback(async () => {
    try {
      if (!window.ethereum) {
        showToast("No wallet found. Install MetaMask or a Web3 wallet.", "error");
        return;
      }

      const p = new BrowserProvider(window.ethereum);
      await p.send("eth_requestAccounts", []);

      const s = await p.getSigner();
      const addr = await s.getAddress();

      setProvider(p);
      setSigner(s);
      setUser(addr);

      showToast("Wallet connected.", "success");
    } catch (e) {
      console.error(e);
      showToast(e?.message || "Failed to connect wallet.", "error");
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
      console.error("autoConnect error:", e);
    }
  }, []);

  const assertContractLive = useCallback(async () => {
    if (!provider) throw new Error("Provider not ready.");

    const net = await provider.getNetwork();
    const code = await provider.getCode(JACKSTAKE_ADDRESS);

    console.log("[Diamond] chainId:", Number(net.chainId));
    console.log("[Diamond] contract:", JACKSTAKE_ADDRESS);
    console.log("[Diamond] code:", code);

    if (!code || code === "0x") {
      throw new Error(
        `No contract found at ${JACKSTAKE_ADDRESS} on chainId ${Number(
          net.chainId
        )}. Switch network in MetaMask.`
      );
    }
  }, [provider]);

const loadPools = useCallback(async () => {
  if (!provider) return;

    if (!jackStakeAbi) {
    showToast("JackStake ABI is still loading.", "info");
    return;
  }

  setLoadingPools(true);

  try {
    await assertContractLive();

    const readJackStake = new Contract(JACKSTAKE_ADDRESS, jackStakeAbi, provider);

    let marker = "0x0000000000000000000000000000000000000000";

    try {
      const m = await readJackStake.PLS();
      marker = String(m).toLowerCase();
    } catch (e) {
      console.warn("[loadPools] PLS() read failed, using address(0):", e);
    }

    setPlsMarker(marker);

    try {
      const jackAddress = await readJackStake.jack();
      const jackErc = new Contract(jackAddress, ERC20_META_ABI, provider);

      const dec = await jackErc.decimals().catch(() => 18);
      setJackDecimals(Number(dec));
    } catch (e) {
      console.warn("[loadPools] JACK metadata read failed, using default 18/JACK:", e);
      setJackDecimals(18);
    }

    let tokenList = [];

    try {
      const list = await readJackStake.getExternalPools();
      tokenList = Array.isArray(list) ? list : [];
    } catch (e) {
      console.error("[loadPools] getExternalPools failed:", e);
      setPoolsLive([]);
      showToast("getExternalPools() failed. Check address, network, or ABI.", "error");
      return;
    }

    if (tokenList.length === 0) {
      setPoolsLive([]);
      showToast("No pools returned from contract yet.", "info");
      return;
    }

    const results = await Promise.allSettled(
      tokenList.map(async (token) => {
        const tokenLower = token.toLowerCase();

        const active = await readJackStake.isExternalPoolActive(token);
        const totalRaw = await readJackStake.totalStakedExternal(token);
        const yourRaw = user ? await readJackStake.userStakeExternal(token, user) : 0n;

        // This is the important part for your rewards panel.
        // It reads how much JACK the connected wallet has earned in this pool.
        const pendingJackRaw = user
          ? await readJackStake.pendingJack(token, user).catch((e) => {
              console.warn("[loadPools] pendingJack failed for token:", token, e);
              return 0n;
            })
          : 0n;

        let name = "ERC-20 Token";
        let symbol = shortAddr(token);
        let decimals = 18;

        if (tokenLower === marker) {
          name = "PulseChain";
          symbol = "PLS";
          decimals = 18;
        } else {
          const erc = new Contract(token, ERC20_META_ABI, provider);
          const n = await erc.name().catch(() => "");
          const sym = await erc.symbol().catch(() => "");
          const dec = await erc.decimals().catch(() => 18);

          name = n && n.length ? n : "ERC-20 Token";
          symbol = sym && sym.length ? sym : shortAddr(token);
          decimals = Number(dec);
        }

        return {
          token,
          name,
          symbol,
          decimals,
          active: !!active,
          totalRaw,
          yourRaw,
          pendingJackRaw,
        };
      })
    );

    const rows = [];

    results.forEach((r, i) => {
      if (r.status === "fulfilled") rows.push(r.value);
      else console.warn("[loadPools] FAILED token:", tokenList[i], r.reason);
    });

    setPoolsLive(rows);
    showToast(`Pools loaded: ${rows.length}/${tokenList.length}`, "success");
  } catch (e) {
    console.error("loadPools error:", e);
    setPoolsLive([]);
    showToast(e?.shortMessage || e?.message || "Failed to load pools.", "error");
  } finally {
    setLoadingPools(false);
  }
}, [provider, user, jackStakeAbi, showToast, assertContractLive]);

const ensurePlsMarkerLoaded = useCallback(async () => {
  if (plsMarker) return plsMarker;

  if (!provider) throw new Error("Provider not ready yet.");
  if (!jackStakeAbi) throw new Error("JackStake ABI not loaded yet.");

  const readJackStake = new Contract(JACKSTAKE_ADDRESS, jackStakeAbi, provider);
  const marker = (await readJackStake.PLS()).toLowerCase();

  setPlsMarker(marker);

  return marker;
}, [plsMarker, provider, jackStakeAbi]);

  useEffect(() => {
    autoConnect();
  }, [autoConnect]);

useEffect(() => {
  if (provider && user) {
    loadPools();
  }
}, [provider, user, loadPools]);

  useEffect(() => {
    if (!window.ethereum) return;

    const onAccounts = async (accs) => {
      if (!accs || !accs.length) {
        setUser("");
        setSigner(null);
        showToast("Wallet disconnected.", "info");
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

  const activePools = poolsLive.filter((p) => p.active);
  const endedPools = poolsLive.filter((p) => !p.active);
  const visiblePools = poolView === "active" ? activePools : endedPools;
  const isEndedView = poolView === "ended";

  const selectedPool =
    poolsLive.find((p) => p.token?.toLowerCase() === selectedToken?.toLowerCase()) || null;

  const selectedLogo = getTokenLogo(selectedToken, plsMarker);

  const modalPools = poolsLive.filter((p) => {
    if (activePoolTab === "stake") return p.active;
    return true;
  });

  const filteredModalPools = modalPools.filter((p) => {
    const q = (searchTerm || "").toLowerCase();

    return (
      (p.symbol || "").toLowerCase().includes(q) ||
      (p.name || "").toLowerCase().includes(q)
    );
  });

  const formatAmt = (raw, decimals) => {
    try {
      const v = formatUnits(raw || 0n, decimals ?? 18);
      const [a, b] = v.split(".");

      if (!b) return a;

      return `${a}.${b.slice(0, 6)}`.replace(/\.$/, "");
    } catch {
      return "0";
    }
  };

function formatReward2(raw, decimals = 18) {
  try {
    const value = raw || 0n;

    if (value === 0n) return "0.00";

    const amountText = formatUnits(value, decimals);
    const [wholePart, decimalPart = ""] = amountText.split(".");

    const twoDecimals = `${decimalPart}00`.slice(0, 2);

    // Shows very tiny rewards without displaying 0.00
    if (wholePart === "0" && twoDecimals === "00") {
      return "<0.01";
    }

    const wholeWithCommas = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return `${wholeWithCommas}.${twoDecimals}`;
  } catch {
    return "0.00";
  }
}

  const ensureAllowance = useCallback(
    async (token, amountRaw) => {
      if (!provider || !signer) throw new Error("Wallet not connected.");
      if (!plsMarker) throw new Error("PLS marker not loaded yet.");

      if (token?.toLowerCase() === plsMarker) return;

      const erc = new Contract(token, ERC20_META_ABI, signer);
      const owner = await signer.getAddress();
      const allowance = await erc.allowance(owner, JACKSTAKE_ADDRESS);

      if (allowance >= amountRaw) return;

      showToast("Approving token…", "pending");

      const tx = await erc.approve(JACKSTAKE_ADDRESS, MaxUint256);
      await tx.wait();

      showToast("Approval confirmed.", "success");
    },
    [provider, signer, plsMarker, showToast]
  );

const onClaimJack = useCallback(
  async (p) => {
    try {
      if (!isConnected) {
        showToast("Connect wallet first.", "error");
        return;
      }

      if (!jackStake) throw new Error("Contract not ready.");

      const pending = await jackStake.pendingJack(p.token, user);

      if (pending <= 0n) {
        showToast("No JACK rewards to claim yet.", "info");
        return;
      }

      showToast("Claiming JACK…", "pending");

      const tx = await jackStake.claimJackAsReward(p.token);
      await tx.wait();

      showToast("JACK claimed successfully.", "success");

      triggerActionFx(
        "claim",
        "JACK CLAIMED",
        `${p.symbol} pool JACK rewards claimed. Jack is celebrating your diamond hands.`,
        "💎",
        p.token
      );

      await loadPools();
    } catch (e) {
      console.error(e);
      showToast(e?.shortMessage || e?.message || "Claim failed.", "error");
    }
  },
  [isConnected, jackStake, user, loadPools, showToast, triggerActionFx]
);

const onProcessDay = useCallback(async () => {
  try {
    if (!isConnected) {
      showToast("Connect wallet first.", "error");
      return;
    }

    if (!jackStake) throw new Error("Contract not ready.");

    const tokens = poolsLive.map((p) => p.token).filter(Boolean);

    if (tokens.length === 0) {
      showToast("No pools to sync yet.", "info");
      return;
    }

    showToast("Syncing JACK rewards…", "pending");

    const tx = await jackStake.updateManyExternalPools(tokens);
    await tx.wait();

    showToast("JACK rewards synced.", "success");

    await loadPools();
  } catch (e) {
    console.error(e);
    showToast(e?.shortMessage || e?.message || "Reward sync failed.", "error");
  }
}, [isConnected, jackStake, poolsLive, loadPools, showToast]);

  function openModal(isStake) {
    setActivePoolTab(isStake ? "stake" : "unstake");

    const first = poolsLive.find((p) => p.active)?.token || poolsLive[0]?.token || "";

    setSelectedToken(first);
    setSearchTerm("");
    setAmount("");
    setDropdownOpen(false);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setDropdownOpen(false);
  }

  const loadBalance = useCallback(
    async (tokenAddr) => {
      try {
        if (!provider || !signer || !user || !jackStake || !tokenAddr) {
          setUserBalance("0");
          return;
        }

        const pool = poolsLive.find((p) => p.token.toLowerCase() === tokenAddr.toLowerCase());
        const decimals = pool?.decimals ?? 18;

        const marker = await ensurePlsMarkerLoaded();

        if (activePoolTab === "unstake") {
          const staked = await jackStake.userStakeExternal(tokenAddr, user);
          setUserBalance(formatUnits(staked, decimals));
          return;
        }

        if (tokenAddr.toLowerCase() === marker) {
          const bal = await provider.getBalance(user);
          setUserBalance(formatUnits(bal, 18));
        } else {
          const erc = new Contract(tokenAddr, ERC20_META_ABI, provider);
          const bal = await erc.balanceOf(user);
          setUserBalance(formatUnits(bal, decimals));
        }
      } catch (e) {
        console.error(e);
        setUserBalance("0");
      }
    },
    [provider, signer, user, jackStake, poolsLive, activePoolTab, ensurePlsMarkerLoaded]
  );

  useEffect(() => {
    if (isModalOpen && selectedToken) loadBalance(selectedToken);
  }, [isModalOpen, selectedToken, activePoolTab, loadBalance]);

  async function confirmAction() {
    try {
      if (!isConnected) {
        showToast("Connect wallet first.", "error");
        return;
      }

      if (!jackStake) throw new Error("Contract not ready.");
      if (!selectedToken) throw new Error("Select a token.");

      if (!amount || Number(amount) <= 0) {
        showToast("Enter a valid amount.", "error");
        return;
      }

      const pool = poolsLive.find((p) => p.token.toLowerCase() === selectedToken.toLowerCase());
      const decimals = pool?.decimals ?? 18;
      const symbol = pool?.symbol || "TOKEN";

      const amountRaw = parseUnits(amount.trim(), decimals);

      if (amountRaw <= 0n) {
        showToast("Invalid amount.", "error");
        return;
      }

      const marker = await ensurePlsMarkerLoaded();

      if (activePoolTab === "stake") {
        if (selectedToken.toLowerCase() === marker) {
          showToast("Sending stake tx…", "pending");

          const tx = await jackStake.stakeExternalToken(selectedToken, amountRaw, {
            value: amountRaw,
          });

          await tx.wait();
        } else {
          await ensureAllowance(selectedToken, amountRaw);

          showToast("Sending stake tx…", "pending");

          const tx = await jackStake.stakeExternalToken(selectedToken, amountRaw);
          await tx.wait();
        }

        showToast("Stake successful.", "success");

        triggerActionFx(
          "stake",
          "STAKE CONFIRMED",
          `${amount} ${symbol} entered the burrow. Jack is hyped.`,
          "🥕",
          selectedToken
        );
      } else {
        showToast("Sending unstake tx…", "pending");

        const tx = await jackStake.unstakeExternalToken(selectedToken, amountRaw);
        await tx.wait();

        showToast("Unstake successful.", "success");

        triggerActionFx(
          "unstake",
          "UNSTAKE COMPLETE",
          `${amount} ${symbol} left safely. No withdrawal fee taken.`,
          "🐾",
          selectedToken
        );
      }

      closeModal();
      await loadPools();
    } catch (e) {
      console.error(e);
      showToast(e?.shortMessage || e?.message || "Transaction failed.", "error");
    }
  }

  const toastMeta = getToastMeta(toastKind);
  const toastIconSrc = TOAST_ICON_PLACEHOLDERS[toastKind] || "";

  return (
    <div
    className={`${styles["page-wrapper"]} ${styles["jack-bg-page"]} ${styles["diamond-page-transition"]}`}>
      <div className={styles["jack-bg-motifs"]} aria-hidden="true" />

      <main className={styles["page-shell"]}>
        <div className={styles.topBanner}>
          <span className={styles.bannerA11y}>Diamond Hands Banner</span>

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
            <h1 className={styles.bannerTitle}>Paws Down. Stack Carrots.</h1>

            <p className={styles.bannerSubtitle}>Stake ecosystem tokens to earn JACK.</p>
          </div>
        </div>

        <section className={styles["app-card"]}>
          <div className={styles["page-header-row"]}>
            <div>
              <div className={styles["page-tabs"]}>
                <button
                  className={`${styles["page-tab"]} ${poolView === "active" ? styles.active : ""}`}
                  type="button"
                  onClick={() => setPoolView("active")}
                >
                  Active Pools
                </button>

                <button
                  className={`${styles["page-tab"]} ${poolView === "ended" ? styles.active : ""}`}
                  type="button"
                  onClick={() => setPoolView("ended")}
                >
                  Ended Pools
                </button>
              </div>

              <p className={styles["page-subtitle"]}>
                {isEndedView
                  ? "Ended pools are closed for new deposits. You can only unstake and claim pending JACK."
                  : "Only tokens that were added in the contract appear here."}
              </p>
            </div>
          </div>

          <div className={styles["stake-layout"]}>
            <div className={styles.panel}>
              <div className={styles["panel-header"]}></div>

              <div key={poolView} className={styles["pool-view-wrapper"]}>
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
                      <th>Pool Share</th>
                      <th>Total Staked</th>
                      <th>Your Stake</th>
                    </tr>
                  </thead>

                  <tbody>
                    {!isConnected ? (
                      <tr>
                        <td colSpan={4}>Connect wallet to load pools from the contract.</td>
                      </tr>
                    ) : loadingPools ? (
                      <tr>
                        <td colSpan={4}>
                          {isEndedView ? "Checking ended pools…" : "Loading active pools…"}
                        </td>
                      </tr>
                    ) : visiblePools.length === 0 ? (
                      <tr>
                        <td colSpan={4}>
                          {isEndedView
                          ? "You can still unstake and claim pending JACK."
                          : "Only active staking pools from the contract appear here."}
                        </td>
                      </tr>
                    ) : (
                      visiblePools.map((p) => {
                        const total = formatAmt(p.totalRaw, p.decimals);
                        const your = formatAmt(p.yourRaw, p.decimals);
                        const share = calcPoolSharePct(p.yourRaw, p.totalRaw);
                        const logoSrc = getTokenLogo(p.token, plsMarker);
                        const rowIsActiveFx =
                          recentActionToken && p.token?.toLowerCase() === recentActionToken.toLowerCase();

                        return (
                          <tr key={p.token} className={rowIsActiveFx ? styles["row-action-flash"] : ""}>
                            <td>
                              <div className={styles["token-cell-redesign"]}>
                                <img
                                  className={styles["token-logo-redesign"]}
                                  src={logoSrc}
                                  alt={p.symbol}
                                  onError={(e) => {
                                    e.currentTarget.src = logoUNKNOWN;
                                  }}
                                />

                                <span className={styles["token-stack-redesign"]} title={p.token}>
                                  <strong>{p.name}</strong>
                                  <small>{p.symbol}</small>
                                </span>
                              </div>
                            </td>

                            <td className={styles["share-text"]}>{share}</td>

                            <td>
                              {total}
                              <span className={styles["sub-dollar"]}>$0</span>
                            </td>

                            <td>
                              {your}
                              <span className={styles["sub-dollar"]}>$0</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                <p className={styles["small-note"]}>
                  ✅ A one time <strong>5% fee</strong> of your total stake is taken for every stake you make.
                  No fee on withdrawals.
                </p>
              </div>
            </div>

            <aside className={styles["rewards-panel"]}>
              <div className={styles["rewards-header"]}>
                <div className={styles["rewards-title"]}>rewards</div>

                <button
                  type="button"
                  className={styles["reward-pill"]}
                  data-transaction="onProcessDay" onClick={onProcessDay}
                  disabled={!isConnected || loadingPools}
                  title={
                    !isConnected
                      ? "Connect wallet to sync rewards."
                      : "Sync JACK rewards by calling updateManyExternalPools()."
                  }
                >
                  {loadingPools ? "SYNCING..." : "SYNC REWARDS"}
                </button>
              </div>

              <div className={styles["reward-desc"]}>
                <p>Claim your $Jack tokens in your respective pools you have staked</p>
              </div>

              {loadingPools ? (
                <div className={styles["reward-row"]}>
                  <span className={styles["token-pill-dark"]}>
                    <span>Loading pools…</span>
                  </span>

                  <span className={styles["reward-amount"]}>—</span>

                  <button type="button" className={styles["claim-btn"]} disabled>
                    …
                  </button>
                </div>
              ) : (
                visiblePools.map((p) => {
                  const rewardRowFx =
                    recentActionToken && p.token?.toLowerCase() === recentActionToken.toLowerCase();

                  return (
                    <div
                      className={`${styles["reward-row"]} ${rewardRowFx ? styles["reward-row-flash"] : ""}`}
                      key={p.token}
                    >
                      <span className={styles["token-pill-dark"]} title={p.token}>
                        <span className={styles.rewardAmt}>
                          {formatReward2(p.pendingJackRaw, jackDecimals)}
                        </span>
                      </span>

                      <span className={styles["reward-amount"]}>
                        {isConnected ? `${p.symbol} Pool` : "—"}
                      </span>

                      <button
                        type="button"
                        className={`${styles["claim-btn"]} ${
                          !isConnected || (p.pendingJackRaw ?? 0n) <= 0n ? styles["claim-disabled"] : ""
                        }`}
                        data-transaction="Claim JACK" onClick={() => onClaimJack(p)}
                        disabled={!isConnected || (p.pendingJackRaw ?? 0n) <= 0n}
                        title={
                          !isConnected
                            ? "Connect wallet from the navbar to claim."
                            : (p.pendingJackRaw ?? 0n) <= 0n
                            ? "No JACK rewards yet."
                            : "Claim JACK"
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

      {isModalOpen && (
        <div className={`${styles.modal} ${styles.modalVisible}`}>
          <div className={styles.modalOverlay} onClick={closeModal} />

          <div className={styles.modalPanel}>
            <div className={`${styles.modalInner} ${isDropdownOpen ? styles.modalInnerDropdownOpen : ""}`}>
              <h2 className={styles.modalTitle}>
                {activePoolTab === "stake" ? "Stake" : "Unstake"} {selectedPool?.symbol || "Token"}
              </h2>

              <div className={`${styles.modalRow} ${isDropdownOpen ? styles.modalRowDropdownOpen : ""}`}>
                <div className={`${styles.amountShell} ${isDropdownOpen ? styles.amountShellDropdownOpen : ""}`}>
                  <div
                    className={styles.tokenField}
                    onClick={() => {
                      setDropdownOpen((o) => {
                        const next = !o;
                        if (next) setSearchTerm("");
                        return next;
                      });
                    }}
                  >
                    <span className={styles.tokenIconFake}>
                      <img
                        src={selectedLogo}
                        alt={selectedPool?.symbol || "Token"}
                        className={styles.modalTokenIconImg}
                        onError={(e) => {
                          e.currentTarget.src = logoUNKNOWN;
                        }}
                      />
                    </span>

                    <span className={styles.tokenFieldText}>{selectedPool?.symbol || "Select"}</span>

                    <span className={styles.tokenCaret}>▾</span>
                  </div>

                  <input
                    className={styles.modalInput}
                    type="text"
                    inputMode={isDropdownOpen ? "text" : "decimal"}
                    placeholder={isDropdownOpen ? "Search token..." : "0.0"}
                    value={isDropdownOpen ? searchTerm : amount}
                    onChange={(e) => {
                      const v = e.target.value;

                      if (isDropdownOpen) {
                        setSearchTerm(v);
                      } else {
                        const cleaned = v.replace(/[^0-9.]/g, "");
                        setAmount(cleaned);
                      }
                    }}
                  />

                  {isDropdownOpen && (
                    <div className={styles.dropdownBody}>
                      <div className={styles.dropdownBodyInner}>
                        <div className={styles.dropdownScroll}>
                          {filteredModalPools.length === 0 ? (
                            <div className={styles.searchItem}>
                              <span className={styles.searchTextGroup}>
                                <span className={styles.searchNamePrimary}>No token found</span>
                              </span>
                            </div>
                          ) : (
                            filteredModalPools.map((p) => {
                              const logoSrc = getTokenLogo(p.token, plsMarker);

                              return (
                                <div
                                  key={p.token}
                                  className={styles.searchItem}
                                  onClick={() => {
                                    setSelectedToken(p.token);
                                    setDropdownOpen(false);
                                    setSearchTerm("");
                                  }}
                                >
                                  <span className={styles.searchIconFake}>
                                    <img
                                      src={logoSrc}
                                      alt={p.symbol}
                                      className={styles.modalSearchLogo}
                                      onError={(e) => {
                                        e.currentTarget.src = logoUNKNOWN;
                                      }}
                                    />
                                  </span>

                                  <span className={styles.searchTextGroup}>
                                    <span className={styles.searchNamePrimary}>{p.name}</span>
                                    <span className={styles.searchTicker}>{p.symbol}</span>
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={`${styles.modalFooter} ${isDropdownOpen ? styles.modalFooterHidden : ""}`}>
                <span className={styles.modalBalance}>
                  {activePoolTab === "unstake" ? "Staked:" : "Balance:"}{" "}
                  <strong>{Number(userBalance || 0).toFixed(4)}</strong> {selectedPool?.symbol || ""}
                </span>

                <button className={styles.claimBtn} data-transaction="confirmAction" onClick={confirmAction}>
                  {activePoolTab === "stake" ? "Stake" : "Unstake"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {actionFx.visible && (
        <div
          key={actionFx.id}
          className={`${styles["action-fx-overlay"]} ${styles[`fx-${actionFx.type}`]}`}
        >
          <div className={styles["action-fx-burst"]}>
            {Array.from({ length: 18 }).map((_, i) => (
              <span key={i} className={styles[`burst-${(i % 8) + 1}`]} />
            ))}
          </div>

          <div className={styles["action-fx-card"]}>
            <div className={styles["action-fx-accent"]}></div>

            <div className={styles["action-fx-header"]}>
              <span className={styles["action-fx-mini-tag"]}>JACK SAYS</span>
              <span className={styles["action-fx-type-pill"]}>{getActionFxPill(actionFx.type)}</span>
            </div>

            <div className={styles["action-fx-main"]}>
              <div className={styles["action-fx-rabbit-shell"]}>
                <div className={styles["action-fx-rabbit"]}>
                  {actionFx.iconSrc ? (
                    <img
                      src={actionFx.iconSrc}
                      alt={actionFx.title}
                      className={styles["action-fx-icon-img"]}
                    />
                  ) : (
                    <span>{actionFx.emoji}</span>
                  )}
                </div>
              </div>

              <div className={styles["action-fx-copy"]}>
                <strong>{actionFx.title}</strong>
                <span>{actionFx.message}</span>
              </div>
            </div>

            <div className={styles["action-fx-footer-line"]}>
              <span className={styles["action-fx-footer-fill"]}></span>
            </div>
          </div>
        </div>
      )}

      {toastVisible && (
        <div className={`${styles.toast} ${styles[`toast-${toastKind}`]}`}>
          <div className={styles.toastBadge}>
            {toastIconSrc ? (
              <img src={toastIconSrc} alt={toastMeta.label} className={styles.toastIconImg} />
            ) : (
              <span>{toastMeta.icon}</span>
            )}
          </div>

          <div className={styles.toastTextWrap}>
            <span className={styles.toastKicker}>{toastMeta.label}</span>
            <span className={styles.toastMessage}>{toastMsg}</span>
          </div>

          <div className={styles.toastProgress}>
            <span></span>
          </div>
        </div>
      )}
    </div>
  );
}