// src/pages/farms.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "../styles/farms.module.css";

import jackIcon from "../assets/jacklogo.png";
import plsIcon from "../assets/pls.svg";
import plsxIcon from "../assets/plsx.svg";
import hexIcon from "../assets/hex.svg";
import incIcon from "../assets/inc.svg";
import prvxIcon from "../assets/prvx.png";
import pdaiIcon from "../assets/pdai.svg";
import atropaIcon from "../assets/atropa.svg";
import teddyIcon from "../assets/teddy.png";
import carrotIcon from "../assets/cartoon_carrot_with_green_leaves.png";

const STAGE_WIDTH = 1672;
const STAGE_HEIGHT = 1460;

export const TOKEN_META = {
  jack: {
    label: "JACK",
    icon: jackIcon,
    fallback: "J",
    theme: "jackTheme",
  },
  pls: {
    label: "PLS",
    icon: plsIcon,
    fallback: "P",
    theme: "plsTheme",
  },
  plsx: {
    label: "PLSX",
    icon: plsxIcon,
    fallback: "X",
    theme: "plsxTheme",
  },
  hex: {
    label: "HEX",
    icon: hexIcon,
    fallback: "H",
    theme: "hexTheme",
  },
  inc: {
    label: "INC",
    icon: incIcon,
    fallback: "I",
    theme: "incTheme",
  },
  prvx: {
    label: "PRVX",
    icon: prvxIcon,
    fallback: "V",
    theme: "prvxTheme",
  },
  pdai: {
    label: "pDAI",
    icon: pdaiIcon,
    fallback: "Ð",
    theme: "pdaiTheme",
  },
  atropa: {
    label: "ATROPA",
    icon: atropaIcon,
    fallback: "A",
    theme: "atropaTheme",
  },
  teddy: {
    label: "TEDDY",
    icon: teddyIcon,
    fallback: "T",
    theme: "teddyTheme",
  },
};

export const INITIAL_FARMS = [
  {
    id: "jack-pls",
    pair: "JACK-PLS",
    token: "pls",
    earnToken: "PLS",
    earnClass: "purple",
    poolValue: "$245.8K",
    apr: "68.42%",
    jackEarned: 12.34,
    pairEarned: 45.67,
    poolShare: 0,
    stakedLp: 0,
    balance: 12.45,
    usdRate: 19.74,
    badge: "HOT",
  },
  {
    id: "jack-plsx",
    pair: "JACK-PLSX",
    token: "plsx",
    earnToken: "PLSX",
    earnClass: "green",
    poolValue: "$233.6K",
    apr: "62.17%",
    jackEarned: 8.91,
    pairEarned: 32.18,
    poolShare: 0,
    stakedLp: 0,
    balance: 18.32,
    usdRate: 12.75,
    badge: "",
  },
  {
    id: "jack-hex",
    pair: "JACK-HEX",
    token: "hex",
    earnToken: "HEX",
    earnClass: "pink",
    poolValue: "$221.4K",
    apr: "59.88%",
    jackEarned: 7.42,
    pairEarned: 19.63,
    poolShare: 0,
    stakedLp: 0,
    balance: 10.75,
    usdRate: 16.35,
    badge: "",
  },
  {
    id: "jack-inc",
    pair: "JACK-INC",
    token: "inc",
    earnToken: "INC",
    earnClass: "gold",
    poolValue: "$205.9K",
    apr: "57.24%",
    jackEarned: 6.98,
    pairEarned: 14.8,
    poolShare: 0,
    stakedLp: 0,
    balance: 9.4,
    usdRate: 14.2,
    badge: "",
  },
  {
    id: "jack-prvx",
    pair: "JACK-PRVX",
    token: "prvx",
    earnToken: "PRVX",
    earnClass: "cyan",
    poolValue: "$188.7K",
    apr: "54.73%",
    jackEarned: 6.12,
    pairEarned: 21.45,
    poolShare: 0,
    stakedLp: 0,
    balance: 8.66,
    usdRate: 13.18,
    badge: "",
  },
  {
    id: "jack-pdai",
    pair: "JACK-pDAI",
    token: "pdai",
    earnToken: "pDAI",
    earnClass: "gold",
    poolValue: "$198.2K",
    apr: "55.91%",
    jackEarned: 6.78,
    pairEarned: 127.45,
    poolShare: 0,
    stakedLp: 0,
    balance: 8.91,
    usdRate: 22.24,
    badge: "",
  },
  {
    id: "jack-atropa",
    pair: "JACK-ATROPA",
    token: "atropa",
    earnToken: "ATROPA",
    earnClass: "purple",
    poolValue: "$176.4K",
    apr: "49.35%",
    jackEarned: 4.92,
    pairEarned: 18.12,
    poolShare: 0,
    stakedLp: 0,
    balance: 7.25,
    usdRate: 12.1,
    badge: "",
  },
  {
    id: "jack-teddy",
    pair: "JACK-TEDDY",
    token: "teddy",
    earnToken: "TEDDY",
    earnClass: "orange",
    poolValue: "$154.1K",
    apr: "45.08%",
    jackEarned: 3.87,
    pairEarned: 26.73,
    poolShare: 0,
    stakedLp: 0,
    balance: 6.8,
    usdRate: 10.6,
    badge: "NEW",
  },
];

function Carrot({ size = "" }) {
  return (
    <span
      className={[
        styles.carrot,
        size === "small" ? styles.carrotSmall : "",
        size === "big" ? styles.carrotBig : "",
      ].join(" ")}
    >
      <img src={carrotIcon} alt="" aria-hidden="true" />
    </span>
  );
}

function TokenImage({ tokenKey, modal = false }) {
  const [broken, setBroken] = useState(false);
  const token = TOKEN_META[tokenKey] || TOKEN_META.jack;

  return (
    <span
      className={[
        modal ? styles.modalToken : styles.token,
        styles[token.theme],
      ].join(" ")}
      title={token.label}
    >
      {!broken ? (
        <img
          src={token.icon}
          alt={`${token.label} token`}
          onError={() => setBroken(true)}
        />
      ) : (
        <span className={styles.tokenFallback}>{token.fallback}</span>
      )}
    </span>
  );
}

function AmountIcon({ type, tokenKey }) {
  const token =
    type === "jack" ? TOKEN_META.jack : TOKEN_META[tokenKey] || TOKEN_META.pls;

  return (
    <span className={styles.rewardAmountIcon}>
      <img
        src={token.icon}
        alt=""
        aria-hidden="true"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    </span>
  );
}

function UnstakeIcon() {
  return (
    <svg
      className={styles.unstakeSvgIcon}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M32 8v28"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M20 26l12 12 12-12"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 40v9c0 4 3 7 7 7h18c4 0 7-3 7-7v-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FarmCard({ farm, onClaim, onStake }) {
  const hasStake = Number(farm.stakedLp || 0) > 0;

  return (
    <article className={styles.farmCard}>
      <span className={styles.cornerCarrot}>
        <Carrot />
      </span>

      {farm.badge && (
        <span className={styles.hotBadge}>
          <Carrot size="small" />
          {farm.badge}
        </span>
      )}

      <div className={styles.pairHead}>
        <div className={styles.pairIcons}>
          <TokenImage tokenKey="jack" />
          <TokenImage tokenKey={farm.token} />
        </div>

        <h3 className={styles.pairTitle}>{farm.pair}</h3>
      </div>

      <div className={styles.stats}>
        <div className={styles.statRow}>
          <span>Pool Value</span>
          <strong>{farm.poolValue}</strong>
        </div>

        <div className={styles.statRow}>
          <span>APR</span>
          <strong className={styles.green}>{farm.apr}</strong>
        </div>

        <div className={styles.statRow}>
          <span>Earn</span>
          <strong>
            <span className={styles.orange}>JACK</span> +{" "}
            <span className={styles[farm.earnClass]}>{farm.earnToken}</span>
          </strong>
        </div>

        <div className={styles.dashLine} />

        <div className={styles.rewardsArea}>
          <div className={styles.rewardsStack}>
            <div className={styles.rewardItem}>
              <span className={styles.rewardLabel}>JACK Earned</span>

              <div className={styles.rewardAmountLine}>
                <AmountIcon type="jack" />
                <strong>{farm.jackEarned.toFixed(2)}</strong>
              </div>
            </div>

            <div className={styles.rewardItem}>
              <span className={styles.rewardLabel}>
                {farm.earnToken} Earned
              </span>

              <div className={styles.rewardAmountLine}>
                <AmountIcon type="pair" tokenKey={farm.token} />
                <strong>{farm.pairEarned.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            className={styles.claimBtn}
            onClick={() => onClaim(farm.id)}
          >
            Claim <Carrot />
          </button>
        </div>
      </div>

      <div className={styles.bottomActionArea}>
        <div
          className={[
            styles.poolShareBox,
            !hasStake ? styles.poolShareBoxHidden : "",
          ].join(" ")}
        >
          <span className={styles.poolShareLabel}>Pool Share</span>

          <div className={styles.poolShareAmountLine}>
            <span className={styles.poolPieIcon} />
            <strong>{farm.poolShare.toFixed(2)}%</strong>
          </div>
        </div>

        <button
          type="button"
          className={styles.stakePanelButton}
          onClick={() => onStake(farm.id)}
        >
          <span className={`${styles.panelCorner} ${styles.panelCornerTop}`} />
          <span className={styles.stakePanelText}>Stake</span>
          <span
            className={`${styles.panelCorner} ${styles.panelCornerBottom}`}
          />
        </button>
      </div>
    </article>
  );
}

export default function Farms() {
  const pageRef = useRef(null);
  const toastTimerRef = useRef(null);

  const [stageStyle, setStageStyle] = useState({
    transform: "scale(1)",
    left: 0,
    top: 0,
  });

  const [shellHeight, setShellHeight] = useState(STAGE_HEIGHT);
  const [farms, setFarms] = useState(INITIAL_FARMS);
  const [activeFarmId, setActiveFarmId] = useState("jack-pls");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("stake");
  const [amount, setAmount] = useState("");
  const [toast, setToast] = useState({
    show: false,
    title: "Action complete",
    text: "Simulation updated",
  });

  const activeFarm = useMemo(() => {
    return farms.find((farm) => farm.id === activeFarmId) || farms[0];
  }, [farms, activeFarmId]);

  const isStakeMode = modalMode === "stake";
  const availableAmount = isStakeMode ? activeFarm.balance : activeFarm.stakedLp;
  const actionLabel = isStakeMode ? "Stake LP" : "Unstake LP";

  const usdPreview = useMemo(() => {
    const value = Number(amount || 0);

    if (!value) return "~0.00 USD";

    return `~${(value * activeFarm.usdRate).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} USD`;
  }, [amount, activeFarm]);

  useEffect(() => {
    const fitStage = () => {
      if (!pageRef.current) return;

      const rect = pageRef.current.getBoundingClientRect();
      const scale = Math.min(rect.width / STAGE_WIDTH, 1);

      setStageStyle({
        transform: `scale(${scale})`,
        left: `${(rect.width - STAGE_WIDTH * scale) / 2}px`,
        top: "0px",
      });

      setShellHeight(STAGE_HEIGHT * scale);
    };

    fitStage();

    const resizeObserver = new ResizeObserver(fitStage);

    if (pageRef.current) {
      resizeObserver.observe(pageRef.current);
    }

    window.addEventListener("resize", fitStage);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", fitStage);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (title, text) => {
    setToast({
      show: true,
      title,
      text,
    });

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = setTimeout(() => {
      setToast((current) => ({
        ...current,
        show: false,
      }));
    }, 2200);
  };

  const openStakeModal = (farmId) => {
    const farm = farms.find((item) => item.id === farmId);

    if (!farm) return;

    setActiveFarmId(farmId);
    setModalMode("stake");
    setAmount("");
    setModalOpen(true);
  };

  const closeStakeModal = () => {
    setModalOpen(false);
    setAmount("");
  };

  const switchModalMode = (mode) => {
    setModalMode(mode);
    setAmount("");
  };

  const handleClaim = (farmId) => {
    const farm = farms.find((item) => item.id === farmId);

    if (!farm) return;

    setFarms((currentFarms) =>
      currentFarms.map((item) =>
        item.id === farmId
          ? {
              ...item,
              jackEarned: 0,
              pairEarned: 0,
            }
          : item
      )
    );

    showToast(
      "Rewards claimed",
      `${farm.pair} claimed ${farm.jackEarned.toFixed(2)} JACK + ${farm.pairEarned.toFixed(
        2
      )} ${farm.earnToken}`
    );
  };

  const handleMax = () => {
    setAmount(Number(availableAmount || 0).toFixed(2));
  };

  const handleModalAction = () => {
    const value = Number(amount || 0);

    if (!value || value <= 0) {
      showToast("Enter LP amount", "Type an amount or click MAX first");
      return;
    }

    if (value > Number(availableAmount || 0)) {
      showToast(
        isStakeMode ? "Not enough LP balance" : "Not enough staked LP",
        `Maximum available: ${Number(availableAmount || 0).toFixed(2)}`
      );
      return;
    }

    if (isStakeMode) {
      setFarms((currentFarms) =>
        currentFarms.map((farm) => {
          if (farm.id !== activeFarm.id) return farm;

          const nextStaked = Number(farm.stakedLp || 0) + value;
          const nextShare = Math.max(0.01, nextStaked * 0.026);

          return {
            ...farm,
            balance: Math.max(0, farm.balance - value),
            stakedLp: nextStaked,
            poolShare: nextShare,
            jackEarned: farm.jackEarned + value * 0.18,
          };
        })
      );

      setAmount("");
      showToast("LP staked", `${activeFarm.pair} staked successfully.`);
      return;
    }

    setFarms((currentFarms) =>
      currentFarms.map((farm) => {
        if (farm.id !== activeFarm.id) return farm;

        const nextStaked = Math.max(0, Number(farm.stakedLp || 0) - value);
        const nextShare =
          nextStaked > 0 ? Math.max(0.01, nextStaked * 0.026) : 0;

        return {
          ...farm,
          balance: farm.balance + value,
          stakedLp: nextStaked,
          poolShare: nextShare,
        };
      })
    );

    setAmount("");
    showToast("LP unstaked", `${activeFarm.pair} LP unstaked successfully.`);
  };

  return (
    <main className={styles.farmsPage} ref={pageRef}>
      <div className={styles.stageShell} style={{ height: shellHeight }}>
        <div className={styles.stage} style={stageStyle}>
          <section className={styles.hero}>
            <h1>
              Stake LP. <span>Earn JACK.</span>
            </h1>

            <p>
              Provide liquidity and earn great rewards
              <br />
              with Jack Rabbit Farms!
            </p>

            <div className={styles.moon} />
            <div className={`${styles.cloud} ${styles.cloudOne}`} />
            <div className={`${styles.cloud} ${styles.cloudTwo}`} />
            <div className={styles.fence} />

            <span className={styles.heroCarrot}>
              <Carrot />
            </span>

            <div className={styles.wateringCan}>
              <div className={styles.canBody} />
              <div className={styles.canSpout} />
              <span className={`${styles.drop} ${styles.d1}`} />
              <span className={`${styles.drop} ${styles.d2}`} />
              <span className={`${styles.drop} ${styles.d3}`} />
              <span className={`${styles.drop} ${styles.d4}`} />
            </div>

            <div className={styles.rabbit}>
              <div className={`${styles.ear} ${styles.earLeft}`} />
              <div className={`${styles.ear} ${styles.earRight}`} />
              <div className={styles.hat} />
              <div className={styles.head}>
                <span className={`${styles.eye} ${styles.eyeLeft}`} />
                <span className={`${styles.eye} ${styles.eyeRight}`} />
                <span className={styles.nose} />
                <span className={styles.smile} />
              </div>
              <div className={styles.body} />
              <div className={styles.coinHeld}>
                <TokenImage tokenKey="jack" />
              </div>
            </div>

            <div className={styles.sign}>
              <span>GROW</span>
              <strong>JACK!</strong>
            </div>

            <div className={styles.ground} />
          </section>

          <section className={styles.sectionTitle}>
            <div className={styles.titleLine}>
              <span className={styles.titleCarrot}>
                <Carrot size="big" />
              </span>

              <h1>
                Jack <span>Farms</span>
              </h1>

              <span className={styles.spark}>✦</span>
            </div>

            <p>Stake LP tokens to earn JACK rewards across the ecosystem</p>
          </section>

          <section className={styles.farmGrid}>
            {farms.map((farm) => (
              <FarmCard
                key={farm.id}
                farm={farm}
                onClaim={handleClaim}
                onStake={openStakeModal}
              />
            ))}
          </section>
        </div>
      </div>

      {modalOpen && (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeStakeModal();
            }
          }}
        >
          <section className={styles.stakeModal}>
            <div className={styles.modalLeft}>
              <span className={styles.modalCarrot}>
                <Carrot />
              </span>

              <div className={styles.modalModeSwitch}>
                <button
                  type="button"
                  className={isStakeMode ? styles.modalModeActive : ""}
                  onClick={() => switchModalMode("stake")}
                >
                  <span className={styles.modalModeContent}>
                    <span className={styles.modalModeImage}>
                      <img src={carrotIcon} alt="" aria-hidden="true" />
                    </span>
                    <span>Stake</span>
                  </span>
                </button>

                <button
                  type="button"
                  className={!isStakeMode ? styles.modalModeActive : ""}
                  onClick={() => switchModalMode("unstake")}
                >
                  <span className={styles.modalModeContent}>
                    <span className={styles.modalModeImage}>
                      <UnstakeIcon />
                    </span>
                    <span>Unstake</span>
                  </span>
                </button>
              </div>

              <h2>
                {isStakeMode ? "Stake" : "Unstake"} <span>LP</span>
                <small>✦</small>
              </h2>

              <div className={styles.inputCard}>
                <div className={styles.amountBox}>
                  <input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />

                  <button type="button" onClick={handleMax}>
                    MAX
                  </button>
                </div>

                <div className={styles.amountMeta}>
                  <span>{usdPreview}</span>
                  <span>
                    {isStakeMode ? "Balance" : "Staked"}:{" "}
                    {Number(availableAmount || 0).toFixed(2)}
                  </span>
                </div>

                <button
                  type="button"
                  className={styles.modalStakeBtn}
                  onClick={handleModalAction}
                >
                  {actionLabel} <Carrot />
                </button>
              </div>
            </div>

            <div className={styles.modalDivider} />

            <div className={styles.modalRight}>
              <h2 className={styles.modalPairOnlyTitle}>
                LP <span>Pair</span> <small>✦</small>
              </h2>

              <div className={styles.modalLogoStack}>
                <div className={styles.modalLogoBack}>
                  <TokenImage tokenKey="jack" modal />
                </div>

                <div className={styles.modalLogoFront}>
                  <TokenImage tokenKey={activeFarm.token} modal />
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      <div className={[styles.toast, toast.show ? styles.toastShow : ""].join(" ")}>
        <Carrot />

        <div>
          <strong>{toast.title}</strong>
          <small>{toast.text}</small>
        </div>
      </div>
    </main>
  );
}