// src/pages/NFTBonds.js
import React, { useEffect, useMemo, useState } from "react";
import styles from "../styles/NFTBonds.module.css";

import pdaiJackSackImg from "../assets/pdai_jack_sack.png";
import pdaiCoinStackImg from "../assets/pdai_coin_stack.png";
import pdaiTargetImg from "../assets/pdai_target.png";
import jackPawImg from "../assets/jack_paw.png";
import rabbitHoleImg from "../assets/rabbithole.png";
import jackFallingRabbitHoleImg from "../assets/jackfallingrabbithole.png";
import bondBottomTreasureImg from "../assets/treasure_trove_of_pdai_and_gems.png";
import bondsPageBgImg from "../assets/golden_treasure_portal_with_gems_and_coins.png";

const MIN_BOND_DAYS = 180;
const MAX_BOND_DAYS = 1825;
const MAX_PREMIUM_PCT = 25;

export const RISKY_BONDS = [
  {
    id: "JB-0077",
    owner: "0x7F...92B",
    pdai: 4000,
    unclaimedJack: 310000,
    matured: "2026-06-15",
    graceEnded: "2026-06-30",
    daysExpired: 12,
  },
  {
    id: "JB-0083",
    owner: "0x31...AC8",
    pdai: 9500,
    unclaimedJack: 680000,
    matured: "2026-06-20",
    graceEnded: "2026-07-05",
    daysExpired: 5,
  },
  {
    id: "JB-0091",
    owner: "0xFA...182",
    pdai: 1200,
    unclaimedJack: 88000,
    matured: "2026-06-24",
    graceEnded: "2026-07-09",
    daysExpired: 1,
  },
];

function formatNumber(n, digits = 2) {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCompact(n, digits = 0) {
  return Number(n).toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromISODate(iso) {
  return new Date(`${iso}T00:00:00`);
}

function formatDisplayDate(iso) {
  const d = fromISODate(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function getToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function diffDaysFromToday(dateString) {
  if (!dateString) return 0;

  const today = getToday();
  const selected = fromISODate(dateString);
  const diff = Math.ceil((selected - today) / 86400000);

  return Math.max(diff, 0);
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function JackBarrowBanner() {
  return (
    <section
      className="jackbarrow-banner mint-side-banner"
      aria-label="JackBarrow Bonds banner"
    >
      <div className="jackbarrow-banner-inner">
        <div className="jackbarrow-banner-right">
          <div className="jackbarrow-fall-scene" aria-hidden="true">
            <img className="jackbarrow-hole-img" src={rabbitHoleImg} alt="" />

            <img
              className="jackbarrow-falling-jack-img"
              src={jackFallingRabbitHoleImg}
              alt=""
            />
          </div>
        </div>

        <svg
          className="jackbarrow-curve-svg"
          viewBox="0 0 190 682"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient
              id="jackCurveGoldGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#fff1b7" />
              <stop offset="28%" stopColor="#ffe999" />
              <stop offset="58%" stopColor="#ffc84d" />
              <stop offset="82%" stopColor="#ee9814" />
              <stop offset="100%" stopColor="#bd5d00" />
            </linearGradient>

            <linearGradient
              id="jackCurveCreamGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#fff9e5" />
              <stop offset="34%" stopColor="#fff4d6" />
              <stop offset="68%" stopColor="#fff0c4" />
              <stop offset="100%" stopColor="#f9dc8a" />
            </linearGradient>
          </defs>

          <path
            className="jackbarrow-curve-gold-outer"
            d="M 0 0 H 103 C 181 112, 181 570, 103 682 H 0 Z"
          />

          <path
            className="jackbarrow-curve-cream-body"
            d="M 0 8 H 83 C 158 120, 158 562, 83 674 H 0 Z"
          />

          <path
            className="jackbarrow-curve-gold-edge-dark"
            d="M 100 3 C 181 114, 181 568, 100 679"
          />

          <path
            className="jackbarrow-curve-gold-edge"
            d="M 91 6 C 167 120, 167 562, 91 676"
          />

          <path
            className="jackbarrow-curve-gold-highlight"
            d="M 82 13 C 146 132, 146 550, 82 669"
          />

          <path
            className="jackbarrow-curve-cream-highlight"
            d="M 68 28 C 119 145, 119 537, 68 654"
          />
        </svg>

        <div className="jackbarrow-curve-blend" aria-hidden="true" />

        <div className="jackbarrow-banner-left">
          <div className="jackbarrow-banner-copy">
            <div className="jackbarrow-title">
              <span className="jackbarrow-title-top">Down the</span>
              <span className="jackbarrow-title-middle">pDAI</span>
              <span className="jackbarrow-title-bottom">Rabbit Hole</span>
            </div>

            <div className="jackbarrow-divider" aria-hidden="true">
              <span className="jackbarrow-divider-line" />
              <span className="jackbarrow-divider-carrot">🥕</span>
              <span className="jackbarrow-divider-line" />
            </div>

            <div className="jackbarrow-subtitle-box">
              <p className="jackbarrow-subtitle">
                Bond <strong>pDAI</strong> at TWAP, wait longer for better{" "}
                <strong>JACK</strong> rewards, and help fuel the burrow’s push
                toward the <strong>$1 peg</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function NFTBonds() {
  const twap = 4.25;

  const [availableJack, setAvailableJack] = useState(500000000);
  const [walletPdaiBalance, setWalletPdaiBalance] = useState(82450);
  const [pdaiAmount, setPdaiAmount] = useState("1000");
  const [approved, setApproved] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const today = useMemo(() => getToday(), []);
  const minDate = useMemo(() => addDays(today, MIN_BOND_DAYS), [today]);
  const maxDate = useMemo(() => addDays(today, MAX_BOND_DAYS), [today]);
  const defaultDate = useMemo(() => addDays(today, 365), [today]);

  const [selectedISO, setSelectedISO] = useState(() => toISODate(defaultDate));
  const [viewYear, setViewYear] = useState(defaultDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(defaultDate.getMonth());

  useEffect(() => {
    const close = () => setCalendarOpen(false);

    window.addEventListener("click", close);

    return () => window.removeEventListener("click", close);
  }, []);

  const pdai = Math.max(0, Number(pdaiAmount) || 0);
  const jack = pdai * twap;
  const ratio = availableJack > 0 ? (jack / availableJack) * 100 : 0;
  const usedRatio = Math.min(ratio, 100);
  const days = diffDaysFromToday(selectedISO);

  const premiumProgress = Math.min(
    Math.max((days - MIN_BOND_DAYS) / (MAX_BOND_DAYS - MIN_BOND_DAYS), 0),
    1
  );

  const premiumPct = premiumProgress * MAX_PREMIUM_PCT;
  const feePct = 0.5 + premiumProgress * 2;

  const meterState = useMemo(() => {
    if (days < MIN_BOND_DAYS) return { text: "Minimum 6 months", cls: "bad" };
    if (days > MAX_BOND_DAYS) return { text: "Maximum 5 years", cls: "bad" };
    if (jack === 0) return { text: "Enter amount", cls: "warn" };

    if (pdai > walletPdaiBalance) {
      return { text: "Above wallet balance", cls: "bad" };
    }

    if (jack > availableJack) return { text: "Too high", cls: "bad" };
    if (ratio > 85) return { text: "Near limit", cls: "warn" };

    return { text: "Ready", cls: "ok" };
  }, [availableJack, days, jack, pdai, ratio, walletPdaiBalance]);

  const calendarDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    const mondayIndex = (first.getDay() + 6) % 7;
    const selected = fromISODate(selectedISO);
    const items = [];

    for (let i = 0; i < mondayIndex; i += 1) {
      items.push({ type: "blank", key: `blank-${i}` });
    }

    for (let dayNo = 1; dayNo <= last.getDate(); dayNo += 1) {
      const date = new Date(viewYear, viewMonth, dayNo);
      const iso = toISODate(date);
      const disabled = date < minDate || date > maxDate;

      items.push({
        type: "day",
        key: iso,
        dayNo,
        iso,
        disabled,
        selected: sameDay(date, selected),
      });
    }

    return items;
  }, [maxDate, minDate, selectedISO, viewMonth, viewYear]);

  const calendarMonthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    undefined,
    {
      month: "long",
      year: "numeric",
    }
  );

  const handleAmountChange = (e) => {
    setPdaiAmount(e.target.value);
    setApproved(false);
  };

  const handleUseMax = () => {
    const maxByJack = availableJack / twap;
    const usableMax = Math.min(maxByJack, walletPdaiBalance);

    setPdaiAmount(usableMax.toFixed(2));
    setApproved(false);
  };

  const handleApprove = () => {
    if (!pdai) {
      window.alert("Enter a pDAI amount.");
      return;
    }

    if (days < MIN_BOND_DAYS || days > MAX_BOND_DAYS) {
      window.alert("Pick an unlock date between 6 months and 5 years.");
      return;
    }

    if (pdai > walletPdaiBalance) {
      window.alert("pDAI amount exceeds your wallet balance.");
      return;
    }

    if (jack > availableJack) {
      window.alert("Requested JACK exceeds available JACK.");
      return;
    }

    setApproved(true);
  };

  const handleDeposit = () => {
    if (!approved) {
      window.alert("Approve pDAI first.");
      return;
    }

    if (!pdai || days < MIN_BOND_DAYS || days > MAX_BOND_DAYS) {
      window.alert("Enter a valid bond amount and date.");
      return;
    }

    if (pdai > walletPdaiBalance || jack > availableJack) {
      window.alert("Bond exceeds available limits.");
      return;
    }

    setAvailableJack((prev) => Math.max(0, prev - jack));
    setWalletPdaiBalance((prev) => Math.max(0, prev - pdai));
    setPdaiAmount("");
    setApproved(false);

    window.alert("Bond deposit created. Open the Bonds tab to view positions.");
  };

  const handleSweepExpiredBond = (bond) => {
    console.log("Sweep expired bond clicked:", {
      bondId: bond.id,
      owner: bond.owner,
      unclaimedJack: bond.unclaimedJack,
      graceEnded: bond.graceEnded,
    });

    window.alert(
      `Sweep expired bond ${bond.id}. This will call sweepExpiredBond(tokenId).`
    );
  };

  const handleSelectDate = (iso) => {
    setSelectedISO(iso);
    setApproved(false);
    setCalendarOpen(false);
  };

  const handlePrevMonth = (e) => {
    e.stopPropagation();

    const nextDate = new Date(viewYear, viewMonth - 1, 1);

    setViewYear(nextDate.getFullYear());
    setViewMonth(nextDate.getMonth());
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();

    const nextDate = new Date(viewYear, viewMonth + 1, 1);

    setViewYear(nextDate.getFullYear());
    setViewMonth(nextDate.getMonth());
  };

  return (
    <main
      className={`${styles.page} nft-bonds-page mint-sticky-page`}
      style={{ "--bonds-page-bg": `url(${bondsPageBgImg})` }}
    >
      <div className="wrap mint-wrap">
        <section className="layout mint-layout">
          <div className="create-panel-shell sticky-create-panel">
            <div className="panel create-panel">
              <div className="panel-inner stack create-panel-inner">
                <div className="create-hero-head">
                  <div className="create-hero-icon" aria-hidden="true">
                    🥕
                  </div>

                  <div className="create-title-line">
                    <h2>Create Bond</h2>
                    <span className="create-info-icon">i</span>
                  </div>
                </div>

                <div className="bond-balance-card">
                  <div className="bond-balance-row">
                    <div className="bond-balance-label">
                      <span
                        className="mini-row-icon carrot-mini"
                        aria-hidden="true"
                      >
                        🥕
                      </span>
                      <span>Available JACK</span>
                    </div>

                    <strong>{formatCompact(availableJack)} JACK</strong>
                  </div>

                  <div className="bond-balance-row">
                    <div className="bond-balance-label">
                      <span
                        className="mini-row-icon gem-mini"
                        aria-hidden="true"
                      >
                        💎
                      </span>
                      <span>Wallet Balance</span>
                    </div>

                    <strong>{formatNumber(walletPdaiBalance)} pDAI</strong>
                  </div>
                </div>

                <div className="form-divider" />

                <div className="field amount-field">
                  <div className="amount-title-row">
                    <span>Amount (JACK)</span>

                    <div className="pill amount-twap-pill">
                      TWAP <strong>{formatNumber(twap, 4)}</strong>
                    </div>
                  </div>

                  <div className="input-wrap amount-input-wrap">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pdaiAmount}
                      onChange={handleAmountChange}
                      placeholder="0"
                    />

                    <div className="amount-usd">≈ ${formatNumber(pdai)}</div>

                    <button
                      type="button"
                      className="max-btn-inside"
                      onClick={handleUseMax}
                    >
                      Use Max
                    </button>
                  </div>
                </div>

                <div className="field">
                  <div className="date-head">
                    <span>Duration</span>
                    <span className="mini-pill duration-pill">
                      max 1825 days
                    </span>
                  </div>

                  <div
                    className="calendar-field"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      className="hidden-native-date"
                      type="date"
                      min={toISODate(minDate)}
                      max={toISODate(maxDate)}
                      value={selectedISO}
                      readOnly
                    />

                    <button
                      type="button"
                      className="calendar-trigger"
                      onClick={() => setCalendarOpen((open) => !open)}
                    >
                      <div className="calendar-left">
                        <div className="calendar-chip" aria-hidden="true">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="3" y="5" width="18" height="16" rx="2" />
                            <path d="M16 3v4M8 3v4M3 10h18" />
                          </svg>
                        </div>

                        <div className="calendar-value">
                          <strong>{formatDisplayDate(selectedISO)}</strong>
                          <span>{days} days selected</span>
                        </div>
                      </div>

                      <div className="calendar-right" aria-hidden="true">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                    </button>

                    <div
                      className={`calendar-popover ${
                        calendarOpen ? "open" : ""
                      }`}
                    >
                      <div className="calendar-toolbar">
                        <strong>{calendarMonthLabel}</strong>

                        <div className="cal-navs">
                          <button
                            type="button"
                            className="cal-nav"
                            onClick={handlePrevMonth}
                          >
                            ‹
                          </button>

                          <button
                            type="button"
                            className="cal-nav"
                            onClick={handleNextMonth}
                          >
                            ›
                          </button>
                        </div>
                      </div>

                      <div className="cal-weekdays">
                        <div>Mo</div>
                        <div>Tu</div>
                        <div>We</div>
                        <div>Th</div>
                        <div>Fr</div>
                        <div>Sa</div>
                        <div>Su</div>
                      </div>

                      <div className="cal-days">
                        {calendarDays.map((item) =>
                          item.type === "blank" ? (
                            <button
                              key={item.key}
                              type="button"
                              className="cal-day blank"
                            />
                          ) : (
                            <button
                              key={item.key}
                              type="button"
                              className={`cal-day${
                                item.selected ? " selected" : ""
                              }${item.disabled ? " disabled" : ""}`}
                              disabled={item.disabled}
                              onClick={() => handleSelectDate(item.iso)}
                            >
                              {item.dayNo}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="receive-card">
                  <span className="receive-label">You Will Receive</span>
                  <strong className="receive-amount">
                    {formatNumber(jack)} JACK
                  </strong>

                  <div className="receive-divider" />

                  <div className="receive-stats">
                    <div>
                      <span>Premium</span>
                      <strong className="premium-green">
                        +{formatNumber(premiumPct)}%
                      </strong>
                      <small>Fee: {formatNumber(feePct)}%</small>
                    </div>

                    <div>
                      <span>Duration</span>
                      <strong>{days} days</strong>
                    </div>
                  </div>
                </div>

                <div className="meter-block">
                  <div className="meter">
                    <i style={{ width: `${usedRatio}%` }} />
                  </div>

                  <div className="meter-meta">
                    <span>{formatNumber(ratio)}% of available JACK</span>
                    <span className={`status ${meterState.cls}`}>
                      {meterState.text}
                    </span>
                  </div>
                </div>

                <div className="actions bond-actions">
                  <button
                    className={`btn btn-approve ${approved ? "approved" : ""}`}
                    onClick={handleApprove}
                  >
                    <span className="action-icon shield-icon" aria-hidden="true">
                      🛡️
                    </span>
                    {approved ? "Approved" : "Approve pDAI"}
                  </button>

                  <button
                    className="btn btn-deposit"
                    disabled={!approved}
                    onClick={handleDeposit}
                  >
                    <span className="action-icon deposit-icon" aria-hidden="true">
                      🏗️
                    </span>
                    Deposit Bond
                  </button>
                </div>
              </div>
            </div>

            <div className="create-panel-bottom-art" aria-hidden="true">
              <img
                className="create-panel-treasure-img"
                src={bondBottomTreasureImg}
                alt=""
              />
            </div>
          </div>

          <div className="right-stack mint-right-scroll">
            <JackBarrowBanner />

            <div className="capacity-plaque capacity-table-frame">
              <div className="capacity-table">
                <div className="capacity-table-cell pdai-accepted-cell">
                  <h3>pDAI Accepted</h3>

                  <div className="capacity-main-value dark">82,450.00</div>
                  <div className="capacity-unit">pDAI</div>

                  <img
                    className="capacity-sack-img"
                    src={pdaiJackSackImg}
                    alt="pDAI and JACK sack"
                  />
                </div>

                <div className="capacity-table-cell small-image-cell">
                  <h3>
                    Treasury
                    <br />
                    Reserves
                  </h3>

                  <div className="capacity-main-value">12.4M</div>
                  <div className="capacity-unit">pDAI</div>

                  <img
                    className="capacity-coin-img"
                    src={pdaiCoinStackImg}
                    alt="Treasury reserves"
                  />
                </div>

                <div className="capacity-table-cell small-image-cell">
                  <h3>
                    Max pDAI
                    <br />
                    That Fits
                  </h3>

                  <div className="capacity-main-value">1.0B</div>
                  <div className="capacity-unit">pDAI</div>

                  <img
                    className="capacity-coin-img"
                    src={pdaiCoinStackImg}
                    alt="Max pDAI that fits"
                  />
                </div>

                <div className="capacity-table-cell small-image-cell">
                  <h3>
                    pDAI
                    <br />
                    Target
                  </h3>

                  <div className="capacity-main-value">40.0B</div>
                  <div className="capacity-unit">pDAI</div>

                  <img
                    className="capacity-target-img"
                    src={pdaiTargetImg}
                    alt="pDAI target"
                  />
                </div>

                <div className="capacity-table-cell progress-table-cell">
                  <h3>Target Progress</h3>

                  <div className="capacity-progress-number">40%</div>

                  <div className="capacity-progress-bar">
                    <span />
                  </div>

                  <div className="capacity-progress-list">
                    <div>
                      <i className="reserve-dot" />
                      <span>Reserves</span>
                      <strong>12.4M pDAI</strong>
                      <em>(31%)</em>
                    </div>

                    <div>
                      <i className="fits-dot" />
                      <span>Fits Now</span>
                      <strong>1.0B pDAI</strong>
                      <em>(1%)</em>
                    </div>

                    <div>
                      <i className="target-dot" />
                      <span>Target</span>
                      <strong>40.0B pDAI</strong>
                      <em>(100%)</em>
                    </div>
                  </div>
                </div>

                <div className="capacity-table-cell jack-table-cell">
                  <div className="jack-table-top">
                    <div>
                      <h3>JACK Promised</h3>

                      <div className="jack-promised-value">
                        8.5M <span>JACK</span>
                      </div>
                    </div>

                    <img
                      className="jack-paw-img"
                      src={jackPawImg}
                      alt="Jack paw"
                    />
                  </div>

                  <div className="jack-status-row">
                    <div>
                      <span>Cap Status</span>
                      <strong>ABOVE</strong>
                    </div>

                    <div>
                      <span>Cap Zone</span>
                      <strong>8.5M / 1.0M</strong>
                    </div>
                  </div>

                  <div className="jack-button-row">
                    <button type="button">
                      Idle JACK <strong>8.5M</strong>
                    </button>

                    <button type="button">
                      Request Cap <strong>1.0M</strong>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <section className="risky-bonds-section" aria-label="Risky expired bonds">
  <div className="risky-bonds-head">
    <div>
      <span className="risky-bonds-kicker">Expired Bond Cleanup</span>
      <h3>Risky Bonds</h3>
      <p>
        Only expired bonds that passed their claim grace period appear here.
        These can be swept and burned to release unclaimed JACK back into Barrow accounting.
      </p>
    </div>

    <div className="risky-bonds-count-card">
      <strong>{RISKY_BONDS.length}</strong>
      <span>To Burn</span>
    </div>
  </div>

  <div className="risky-bonds-table">
    <div className="risky-bonds-table-head">
      <div>Bond ID</div>
      <div>Owner</div>
      <div>Unclaimed JACK</div>
      <div>Expired</div>
      <div>Action</div>
    </div>

    {RISKY_BONDS.map((bond) => (
      <div className="risky-bonds-table-row" key={bond.id}>
        <div><strong>{bond.id}</strong></div>
        <div>{bond.owner}</div>
        <div>{formatCompact(bond.unclaimedJack)} JACK</div>
        <div>{bond.daysExpired} days ago</div>
        <div>
          <button
            type="button"
            className="risky-bonds-table-btn"
            onClick={() => handleSweepExpiredBond(bond)}
          >
            Sweep
          </button>
        </div>
      </div>
    ))}
  </div>
</section>

            <div className="mint-scroll-spacer" />
          </div>
        </section>
      </div>
    </main>
  );
}