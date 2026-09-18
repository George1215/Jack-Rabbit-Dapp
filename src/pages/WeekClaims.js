// src/pages/WeekClaims.js
import React, { useEffect, useMemo, useState } from "react";
import styles from "../styles/WeekClaims.module.css";

// IMPORTANT:
// Replace mining-bg.png with the exact background image used in Mining Hub.
import miningBg from "../assets/minergems.png";

// Top main banner image
import minersBanner from "../assets/mining_adventure_with_a_cheerful_rabbit.png";

// Panel ribbon images
import liveMinersRibbon from "../assets/live_miners_game_banner_design.png";
import readyToClaimRibbon from "../assets/ready_to_claim_reward_banner.png";

// Bottom sack images
import liveSackImage from "../assets/bunny_loot_sack_and_golden_coins.png";
import claimSackImage from "../assets/golden_treasure_and_bunny_emblems.png";

// Corner images
import leafCorner from "../assets/leaf_corner.png";
import wheatCorner from "../assets/golden_wheat_corner.png";

// Mode icons
import organicModeIcon from "../assets/organic_leaf_icon_transparent.png";
import treasuryModeIcon from "../assets/treasury_bag_icon_transparent.png";

// Point star icon
import pointStarIcon from "../assets/cartoon_star_real_transparent.png";

// New field icons
import calendarIcon from "../assets/calendar_icon_real_transparent.png";
import jackTokenIcon from "../assets/jack_token_icon_real_transparent.png";
import clockIcon from "../assets/clock_icon_real_transparent.png";

const MINERS_PER_PAGE = 10;

export const liveMiners = [
  {
    id: "#1247",
    week: "Week #3",
    mode: "Organic",
    totalPoints: "92,400",
    points: "1,250",
    reward: "342.18",
    timeAccrued: "2d 14h 32m",
  },
  {
    id: "#1246",
    week: "Week #3",
    mode: "Treasury",
    totalPoints: "80,200",
    points: "620",
    reward: "168.75",
    timeAccrued: "4d 09h 18m",
  },
  {
    id: "#1245",
    week: "Week #2",
    mode: "Organic",
    totalPoints: "54,700",
    points: "210",
    reward: "58.03",
    timeAccrued: "1d 02h 47m",
  },
  {
    id: "#1244",
    week: "Week #1",
    mode: "Treasury",
    totalPoints: "31,400",
    points: "540",
    reward: "141.23",
    timeAccrued: "3d 21h 11m",
  },
  {
    id: "#1243",
    week: "Week #1",
    mode: "Organic",
    totalPoints: "28,900",
    points: "410",
    reward: "108.44",
    timeAccrued: "2d 08h 10m",
  },
  {
    id: "#1242",
    week: "Week #1",
    mode: "Treasury",
    totalPoints: "27,250",
    points: "390",
    reward: "96.12",
    timeAccrued: "1d 19h 42m",
  },
  {
    id: "#1241",
    week: "Week #1",
    mode: "Organic",
    totalPoints: "25,100",
    points: "330",
    reward: "84.07",
    timeAccrued: "1d 11h 07m",
  },
  {
    id: "#1240",
    week: "Week #1",
    mode: "Treasury",
    totalPoints: "23,770",
    points: "290",
    reward: "75.80",
    timeAccrued: "18h 32m",
  },
  {
    id: "#1239",
    week: "Week #1",
    mode: "Organic",
    totalPoints: "21,600",
    points: "245",
    reward: "63.50",
    timeAccrued: "13h 21m",
  },
  {
    id: "#1238",
    week: "Week #1",
    mode: "Treasury",
    totalPoints: "19,450",
    points: "205",
    reward: "49.90",
    timeAccrued: "9h 44m",
  },
  {
    id: "#1237",
    week: "Week #1",
    mode: "Organic",
    totalPoints: "18,200",
    points: "175",
    reward: "40.20",
    timeAccrued: "7h 03m",
  },
  {
    id: "#1236",
    week: "Week #1",
    mode: "Treasury",
    totalPoints: "16,900",
    points: "155",
    reward: "36.70",
    timeAccrued: "5h 19m",
  },
  {
    id: "#1235",
    week: "Week #1",
    mode: "Organic",
    totalPoints: "14,700",
    points: "130",
    reward: "28.40",
    timeAccrued: "3h 28m",
  },
  {
    id: "#1234",
    week: "Week #1",
    mode: "Treasury",
    totalPoints: "12,500",
    points: "100",
    reward: "22.10",
    timeAccrued: "2h 08m",
  },
  {
    id: "#1233",
    week: "Week #1",
    mode: "Organic",
    totalPoints: "10,900",
    points: "85",
    reward: "18.32",
    timeAccrued: "1h 42m",
  },
];

export const claimMiners = [
  {
    id: "#1235",
    week: "Week #1",
    mode: "Organic",
    totalPoints: "92,400",
    points: "1,850",
    rewardPool: "150.00",
    reward: "75.24 JACK",
  },
  {
    id: "#1234",
    week: "Week #1",
    mode: "Treasury",
    totalPoints: "80,200",
    points: "1,125",
    rewardPool: "100.00",
    reward: "42.18 JACK",
  },
  {
    id: "#1233",
    week: "Week #1",
    mode: "Organic",
    totalPoints: "54,700",
    points: "780",
    rewardPool: "75.00",
    reward: "31.82 JACK",
  },
  {
    id: "#1232",
    week: "Week #1",
    mode: "Treasury",
    totalPoints: "31,400",
    points: "315",
    rewardPool: "50.00",
    reward: "15.00 JACK",
  },
  {
    id: "#1231",
    week: "Week #1",
    mode: "Organic",
    totalPoints: "28,900",
    points: "260",
    rewardPool: "45.00",
    reward: "12.20 JACK",
  },
  {
    id: "#1230",
    week: "Week #1",
    mode: "Treasury",
    totalPoints: "27,250",
    points: "240",
    rewardPool: "42.00",
    reward: "11.10 JACK",
  },
  {
    id: "#1229",
    week: "Week #1",
    mode: "Organic",
    totalPoints: "25,100",
    points: "210",
    rewardPool: "39.00",
    reward: "10.05 JACK",
  },
  {
    id: "#1228",
    week: "Week #1",
    mode: "Treasury",
    totalPoints: "23,770",
    points: "190",
    rewardPool: "34.00",
    reward: "8.90 JACK",
  },
  {
    id: "#1227",
    week: "Week #1",
    mode: "Organic",
    totalPoints: "21,600",
    points: "175",
    rewardPool: "30.00",
    reward: "7.84 JACK",
  },
  {
    id: "#1226",
    week: "Week #1",
    mode: "Treasury",
    totalPoints: "19,450",
    points: "145",
    rewardPool: "27.00",
    reward: "6.70 JACK",
  },
  {
    id: "#1225",
    week: "Week #1",
    mode: "Organic",
    totalPoints: "18,200",
    points: "130",
    rewardPool: "24.00",
    reward: "5.94 JACK",
  },
  {
    id: "#1224",
    week: "Week #1",
    mode: "Treasury",
    totalPoints: "16,900",
    points: "110",
    rewardPool: "21.00",
    reward: "4.82 JACK",
  },
  {
    id: "#1223",
    week: "Week #1",
    mode: "Organic",
    totalPoints: "14,700",
    points: "95",
    rewardPool: "18.00",
    reward: "3.71 JACK",
  },
  {
    id: "#1222",
    week: "Week #1",
    mode: "Treasury",
    totalPoints: "12,500",
    points: "80",
    rewardPool: "15.00",
    reward: "2.98 JACK",
  },
  {
    id: "#1221",
    week: "Week #1",
    mode: "Organic",
    totalPoints: "10,900",
    points: "65",
    rewardPool: "12.00",
    reward: "2.20 JACK",
  },
];

function getModeIcon(mode) {
  return mode?.toLowerCase() === "treasury" ? treasuryModeIcon : organicModeIcon;
}

function paginate(items, page) {
  const start = page * MINERS_PER_PAGE;
  return items.slice(start, start + MINERS_PER_PAGE);
}

function MinerCornerDecor() {
  return (
    <>
      <img
        className={`${styles.cardCornerOrnament} ${styles.cornerLeaf} ${styles.leafTopLeft}`}
        src={leafCorner}
        alt=""
        aria-hidden="true"
      />

      <img
        className={`${styles.cardCornerOrnament} ${styles.cornerLeaf} ${styles.leafBottomLeft}`}
        src={leafCorner}
        alt=""
        aria-hidden="true"
      />

      <img
        className={`${styles.cardCornerOrnament} ${styles.cornerWheat} ${styles.wheatTopRight}`}
        src={wheatCorner}
        alt=""
        aria-hidden="true"
      />

      <img
        className={`${styles.cardCornerOrnament} ${styles.cornerWheat} ${styles.wheatBottomRight}`}
        src={wheatCorner}
        alt=""
        aria-hidden="true"
      />
    </>
  );
}

function ModeValue({ mode }) {
  return (
    <span className={styles.value}>
      <img
        className={styles.modeIconImage}
        src={getModeIcon(mode)}
        alt=""
        aria-hidden="true"
      />
      {mode}
    </span>
  );
}

function PointValue({ children }) {
  return (
    <span className={styles.value}>
      <img
        className={styles.pointStarIcon}
        src={pointStarIcon}
        alt=""
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

function WeekValue({ children }) {
  return (
    <span className={styles.value}>
      <img
        className={styles.calendarIconImage}
        src={calendarIcon}
        alt=""
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

function JackValue({ children }) {
  return (
    <span className={styles.value}>
      <img
        className={styles.jackTokenIconImage}
        src={jackTokenIcon}
        alt=""
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

function TimeValue({ children }) {
  return (
    <span className={styles.value}>
      <img
        className={styles.clockIconImage}
        src={clockIcon}
        alt=""
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

function Pager({ page, totalItems, onPrev, onNext }) {
  const totalPages = Math.ceil(totalItems / MINERS_PER_PAGE);

  if (totalPages <= 1) return null;

  return (
    <div className={styles.pager}>
      <button
        className={styles.pageBtn}
        type="button"
        onClick={onPrev}
        disabled={page === 0}
      >
        ◀ Prev
      </button>

      <span className={styles.pageInfo}>
        <span className={styles.pageGem}>💎</span>
        Page {page + 1} / {totalPages}
        <span className={styles.pageGem}>💎</span>
      </span>

      <button
        className={styles.pageBtn}
        type="button"
        onClick={onNext}
        disabled={page + 1 >= totalPages}
      >
        Next ▶
      </button>
    </div>
  );
}

export default function WeekClaims() {
  const [livePage, setLivePage] = useState(0);
  const [claimPage, setClaimPage] = useState(0);

  const visibleLiveMiners = useMemo(
    () => paginate(liveMiners, livePage),
    [livePage]
  );

  const visibleClaimMiners = useMemo(
    () => paginate(claimMiners, claimPage),
    [claimPage]
  );

  const liveTotalPages = Math.ceil(liveMiners.length / MINERS_PER_PAGE);
  const claimTotalPages = Math.ceil(claimMiners.length / MINERS_PER_PAGE);

  useEffect(() => {
    document.documentElement.classList.add("weekClaimsBgActive");

    return () => {
      document.documentElement.classList.remove("weekClaimsBgActive");
    };
  }, []);

  return (
    <main
      className={styles.weekClaimsPage}
      style={{ "--week-claims-bg": `url(${miningBg})` }}
    >
      <section className={styles.claimsShell}>
        <header className={styles.topTitle} aria-label="Miners banner">
          <img
            className={styles.titleBannerImg}
            src={minersBanner}
            alt="Miners"
          />
        </header>

        <section className={styles.board}>
          <div className={styles.claimsLayout}>
            <section
              className={`${styles.panel} ${styles.livePanel}`}
              aria-label="Live Miners"
            >
              <div className={styles.panelDecor}></div>

              <div className={styles.panelContent}>
                <div className={`${styles.panelRibbon} ${styles.liveRibbon}`}>
                  <img
                    className={styles.panelRibbonImg}
                    src={liveMinersRibbon}
                    alt="Live Miners"
                  />
                </div>

                <div className={styles.minerListArea}>
                  <div className={styles.minerStack}>
                    {visibleLiveMiners.map((miner) => (
                      <article
                        className={`${styles.minerCard} ${styles.liveCard}`}
                        key={miner.id}
                      >
                        <MinerCornerDecor />

                        <div className={styles.cardTop}>
                          <h2 className={styles.minerName}>✦ Miner {miner.id}</h2>
                          <span className={styles.statusPill}>Live</span>
                        </div>

                        <div className={styles.liveMinerLayout}>
                          <div className={styles.liveTopRow}>
                            <div className={styles.dataItem}>
                              <span className={styles.label}>Week</span>
                              <WeekValue>{miner.week}</WeekValue>
                            </div>

                            <div className={styles.dataItem}>
                              <span className={styles.label}>Mode</span>
                              <ModeValue mode={miner.mode} />
                            </div>
                          </div>

                          <div className={styles.liveRowDivider}></div>

                          <div className={styles.liveBottomRow}>
                            <div className={styles.dataItem}>
                              <span className={styles.label}>Total Points</span>
                              <PointValue>{miner.totalPoints}</PointValue>
                            </div>

                            <div className={styles.dataItem}>
                              <span className={styles.label}>Your Points</span>
                              <PointValue>{miner.points}</PointValue>
                            </div>

                            <div className={styles.dataItem}>
                              <span className={styles.label}>Est. Reward</span>
                              <JackValue>{miner.reward}</JackValue>
                            </div>

                            <div className={styles.dataItem}>
                              <span className={styles.label}>Time Accrued</span>
                              <TimeValue>{miner.timeAccrued}</TimeValue>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <Pager
                  page={livePage}
                  totalItems={liveMiners.length}
                  onPrev={() => setLivePage((page) => Math.max(page - 1, 0))}
                  onNext={() =>
                    setLivePage((page) => Math.min(page + 1, liveTotalPages - 1))
                  }
                />

                <div className={`${styles.totalRow} ${styles.liveTotalRow}`}>
                  <img
                    className={styles.totalSackImage}
                    src={liveSackImage}
                    alt="Estimated JACK sack"
                  />

                  <div className={styles.totalCopy}>
                    <div className={styles.small}>Total Estimated</div>
                    <div className={styles.big}>
                      710.19 <span>JACK</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section
              className={`${styles.panel} ${styles.claimPanel}`}
              aria-label="Ready to Claim Miners"
            >
              <div className={styles.panelDecor}></div>

              <div className={styles.panelContent}>
                <div className={`${styles.panelRibbon} ${styles.claimRibbon}`}>
                  <img
                    className={styles.panelRibbonImg}
                    src={readyToClaimRibbon}
                    alt="Ready To Claim"
                  />
                </div>

                <div className={styles.minerListArea}>
                  <div className={styles.minerStack}>
                    {visibleClaimMiners.map((miner) => (
                      <article
                        className={`${styles.minerCard} ${styles.claimCard}`}
                        key={miner.id}
                      >
                        <MinerCornerDecor />

                        <div className={styles.cardTop}>
                          <h2 className={styles.minerName}>✦ Miner {miner.id}</h2>
                          <button className={styles.claimBtn} type="button">
                            Claim
                          </button>
                        </div>

                        <div className={styles.claimMinerLayout}>
                          <div className={styles.claimTopRow}>
                            <div className={styles.dataItem}>
                              <span className={styles.label}>Week</span>
                              <WeekValue>{miner.week}</WeekValue>
                            </div>

                            <div className={styles.dataItem}>
                              <span className={styles.label}>Mode</span>
                              <ModeValue mode={miner.mode} />
                            </div>
                          </div>

                          <div className={styles.claimRowDivider}></div>

                          <div className={styles.claimBottomRow}>
                            <div className={styles.dataItem}>
                              <span className={styles.label}>Total Points</span>
                              <PointValue>{miner.totalPoints}</PointValue>
                            </div>

                            <div className={styles.dataItem}>
                              <span className={styles.label}>Your Points</span>
                              <PointValue>{miner.points}</PointValue>
                            </div>

                            <div className={styles.dataItem}>
                              <span className={styles.label}>Reward Pool</span>
                              <JackValue>{miner.rewardPool}</JackValue>
                            </div>

                            <div className={styles.dataItem}>
                              <span className={styles.label}>Your Reward</span>
                              <JackValue>{miner.reward}</JackValue>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <Pager
                  page={claimPage}
                  totalItems={claimMiners.length}
                  onPrev={() => setClaimPage((page) => Math.max(page - 1, 0))}
                  onNext={() =>
                    setClaimPage((page) =>
                      Math.min(page + 1, claimTotalPages - 1)
                    )
                  }
                />

                <div className={`${styles.totalRow} ${styles.claimTotalRow}`}>
                  <img
                    className={styles.totalSackImage}
                    src={claimSackImage}
                    alt="Claimable JACK sack"
                  />

                  <div className={styles.totalCopy}>
                    <div className={styles.small}>Total Claimable</div>
                    <div className={styles.big}>
                      149.24 <span>JACK</span>
                    </div>
                  </div>

                  <button className={styles.claimAllBtn} type="button">
                    👑 Claim All
                  </button>
                </div>
              </div>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}