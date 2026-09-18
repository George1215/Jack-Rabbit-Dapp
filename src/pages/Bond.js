import React, { useEffect, useMemo, useState } from "react";
import styles from "../styles/Bond.module.css";

import totalJackIcon from "../assets/TotalJack.png";
import jackBaseIcon from "../assets/Jackbase.png";
import settingsIcon from "../assets/settings.png";
import unlockedIcon from "../assets/unlocked.png";
import premiumIcon from "../assets/premium.png";

const MIN_BOND_DAYS = 180;
const MAX_BOND_DAYS = 1825;
const MAX_PREMIUM_PCT = 25;
const LIST_PAGE_SIZE = 5;

export const INITIAL_BONDS = [
  {
    id: "JB-1001",
    pdai: 8500,
    jack: 36125,
    twap: 4.25,
    days: 365,
    maturity: "2027-03-05",
    status: "Active",
  },
  {
    id: "JB-1002",
    pdai: 2400,
    jack: 10680,
    twap: 4.45,
    days: 180,
    maturity: "2026-08-17",
    status: "Claimable",
  },
  {
    id: "JB-1003",
    pdai: 12000,
    jack: 49800,
    twap: 4.15,
    days: 730,
    maturity: "2028-01-10",
    status: "Active",
  },
  {
    id: "JB-1004",
    pdai: 3300,
    jack: 14520,
    twap: 4.4,
    days: 365,
    maturity: "2026-03-27",
    status: "Matured",
  },
  {
    id: "JB-1005",
    pdai: 910,
    jack: 3822,
    twap: 4.2,
    days: 180,
    maturity: "2026-09-08",
    status: "Active",
  },
  {
    id: "JB-1006",
    pdai: 6200,
    jack: 27280,
    twap: 4.4,
    days: 730,
    maturity: "2028-02-14",
    status: "Active",
  },
  {
    id: "JB-1007",
    pdai: 1500,
    jack: 6300,
    twap: 4.2,
    days: 180,
    maturity: "2026-10-02",
    status: "Active",
  },
];

function formatNumber(n, digits = 2) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCompact(n, digits = 0) {
  return Number(n || 0).toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fromISODate(iso) {
  return new Date(`${iso}T00:00:00`);
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

function bondPremium(days) {
  const progress = Math.min(
    Math.max((days - MIN_BOND_DAYS) / (MAX_BOND_DAYS - MIN_BOND_DAYS), 0),
    1
  );

  return progress * MAX_PREMIUM_PCT;
}

function prettyAmount(n) {
  return Number.isInteger(Number(n)) ? formatCompact(n) : formatNumber(n);
}

function getTotalJackFromBase(baseJack, premiumPct) {
  const base = Number(baseJack || 0);
  const premium = Number(premiumPct || 0);

  return Math.round(base + base * (premium / 100));
}

function bondProgressPercent(bond) {
  const today = getToday();
  const maturity = fromISODate(bond.maturity);
  const start = addDays(maturity, -bond.days);
  const elapsed = Math.ceil((today - start) / 86400000);
  const progress = (elapsed / Math.max(bond.days, 1)) * 100;

  return Math.max(0, Math.min(100, progress));
}

function bondStageText(progress, status) {
  const key = String(status || "").toLowerCase();

  if (key === "matured" || key === "claimable") return "Unlocked";
  if (progress >= 75) return "Nearly ending";
  if (progress >= 40) return "In progress";

  return "Early stage";
}

function bondActionLabel(status) {
  const key = String(status || "").toLowerCase();

  return key === "matured" || key === "claimable" ? "Claim JACK" : "View Bond";
}

export default function Bonds() {
  const [currentView, setCurrentView] = useState("cards");
  const [search, setSearch] = useState("");
  const [bonds] = useState(INITIAL_BONDS);
  const [openTermMenuId, setOpenTermMenuId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!document.querySelector('script[data-jack-model-viewer="true"]')) {
      const script = document.createElement("script");
      script.type = "module";
      script.src =
        "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
      script.dataset.jackModelViewer = "true";
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const closeDropdown = () => {
      setOpenTermMenuId(null);
    };

    window.addEventListener("click", closeDropdown);

    return () => {
      window.removeEventListener("click", closeDropdown);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setOpenTermMenuId(null);
  }, [search, currentView]);

  const filteredBonds = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return bonds;

    return bonds.filter(
      (bond) =>
        bond.id.toLowerCase().includes(q) ||
        bond.status.toLowerCase().includes(q)
    );
  }, [bonds, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredBonds.length / LIST_PAGE_SIZE)
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const listBonds = useMemo(() => {
    const start = (safeCurrentPage - 1) * LIST_PAGE_SIZE;
    const end = start + LIST_PAGE_SIZE;

    return filteredBonds.slice(start, end);
  }, [filteredBonds, safeCurrentPage]);

  const listEmptySlots = Math.max(0, LIST_PAGE_SIZE - listBonds.length);

  const goToPage = (page) => {
    const nextPage = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(nextPage);
    setOpenTermMenuId(null);
  };

  const handleCardPointerMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();

    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    const clampX = Math.max(0, Math.min(1, px));
    const clampY = Math.max(0, Math.min(1, py));

    const relX = clampX - 0.5;
    const relY = clampY - 0.5;

    const maxTilt = 7;
    const rotateY = relX * maxTilt * 2;
    const rotateX = -relY * maxTilt * 2;

    const shadowX = -rotateY * 1.55;
    const shadowY = rotateX * 1.15 + 18;
    const shadowBlur = 24 + Math.abs(relX) * 10 + Math.abs(relY) * 10;
    const shadowAlpha = 0.12 + (Math.abs(relX) + Math.abs(relY)) * 0.1;
    const glowAlpha = 0.025 + (Math.abs(relX) + Math.abs(relY)) * 0.025;

    card.style.setProperty("--rx", `${rotateX.toFixed(2)}deg`);
    card.style.setProperty("--ry", `${rotateY.toFixed(2)}deg`);
    card.style.setProperty("--shadow-x", `${shadowX.toFixed(2)}px`);
    card.style.setProperty("--shadow-y", `${shadowY.toFixed(2)}px`);
    card.style.setProperty("--shadow-blur", `${shadowBlur.toFixed(2)}px`);
    card.style.setProperty("--shadow-alpha", shadowAlpha.toFixed(3));
    card.style.setProperty("--mx", `${(clampX * 100).toFixed(2)}%`);
    card.style.setProperty("--my", `${(clampY * 100).toFixed(2)}%`);
    card.style.setProperty("--glow-alpha", glowAlpha.toFixed(3));
  };

  const handleCardPointerLeave = (e) => {
    const card = e.currentTarget;

    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
    card.style.setProperty("--shadow-x", "0px");
    card.style.setProperty("--shadow-y", "16px");
    card.style.setProperty("--shadow-blur", "26px");
    card.style.setProperty("--shadow-alpha", "0.18");
    card.style.setProperty("--mx", "50%");
    card.style.setProperty("--my", "50%");
    card.style.setProperty("--glow-alpha", "0.04");
  };

  const toggleTermMenu = (e, bondId) => {
    e.stopPropagation();

    setOpenTermMenuId((currentId) => {
      return currentId === bondId ? null : bondId;
    });
  };

  const handleSendJackNft = (e, bond) => {
    e.stopPropagation();
    setOpenTermMenuId(null);

    console.log("Send / Transfer JACK NFT clicked:", {
      bondId: bond.id,
      status: bond.status,
      maturity: bond.maturity,
    });
  };

  const handleBondAction = (bond) => {
    console.log("Bond action clicked:", {
      bondId: bond.id,
      action: bondActionLabel(bond.status),
      status: bond.status,
    });
  };

  return (
    <main className={`${styles.page} nft-bonds-page nft-bonds-only-page`}>
      <div className="bond-only-wrap">
        <div className="panel right-panel bond-only-panel">
          <div className="panel-inner">
            <div className="bonds-top">
              <h2 className="bonds-title">My Bond Positions</h2>

              <div className="toolbar">
                <div className="seg">
                  <button
                    type="button"
                    className={currentView === "cards" ? "active" : ""}
                    onClick={() => setCurrentView("cards")}
                  >
                    Cards
                  </button>

                  <button
                    type="button"
                    className={currentView === "list" ? "active" : ""}
                    onClick={() => setCurrentView("list")}
                  >
                    List
                  </button>
                </div>

                <div className="search">
                  <input
                    type="text"
                    placeholder="Search bond ID or status"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div
              className={`cards-view ${
                currentView !== "cards" ? "ghost" : ""
              }`}
            >
              {filteredBonds.length === 0 ? (
                <div className="empty-state">No bond positions found.</div>
              ) : (
                filteredBonds.map((bond) => {
                  const progress = bondProgressPercent(bond);
                  const daysLeft = Math.max(
                    0,
                    diffDaysFromToday(bond.maturity)
                  );
                  const premium = bondPremium(bond.days);
                  const jackBase = Number(bond.jack || 0);
                  const totalJack = getTotalJackFromBase(jackBase, premium);
                  const stage = bondStageText(progress, bond.status);
                  const actionLabel = bondActionLabel(bond.status);
                  const isTermMenuOpen = openTermMenuId === bond.id;

                  return (
                    <div
                      className="card-shell"
                      key={bond.id}
                      onPointerEnter={handleCardPointerMove}
                      onPointerMove={handleCardPointerMove}
                      onPointerLeave={handleCardPointerLeave}
                    >
                      <div className="glass-top">
                        <div className="topline">
                          <div className="bond-id">{bond.id}</div>

                          <div
                            className="term-menu-wrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className={`term-chip term-chip-button term-settings-button ${
                                isTermMenuOpen ? "open" : ""
                              }`}
                              aria-label={`Open transfer menu for ${bond.id}`}
                              title="Transfer NFT"
                              aria-haspopup="menu"
                              aria-expanded={isTermMenuOpen}
                              onClick={(e) => toggleTermMenu(e, bond.id)}
                            >
                              <img
                                className="term-settings-icon-img"
                                src={settingsIcon}
                                alt=""
                                aria-hidden="true"
                              />
                            </button>

                            {isTermMenuOpen && (
                              <div className="term-menu" role="menu">
                                <button
                                  type="button"
                                  className="term-menu-item"
                                  role="menuitem"
                                  onClick={(e) => handleSendJackNft(e, bond)}
                                >
                                  Send / Transfer NFT
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="glass-hero-row">
                          <div className="glass-left">
                            <div className="big-number">
                              {Math.round(progress)}%
                            </div>

                            <div className="principal">
                              {prettyAmount(bond.pdai)} pDAI
                            </div>
                          </div>

                          <div className="twap-badge">
                            <span>TWAP at bond</span>
                            <strong>{formatNumber(bond.twap, 4)}</strong>
                          </div>
                        </div>

                        <div className="glb-stage stage-right">
                          <model-viewer
                            src="/JackbondsNFT.glb"
                            alt="Jack Bonds NFT"
                            camera-controls=""
                            touch-action="pan-y"
                            auto-rotate=""
                            rotation-per-second="8deg"
                            shadow-intensity="1"
                            exposure="1.05"
                            environment-image="neutral"
                            disable-pan=""
                          />
                        </div>
                      </div>

                      <div className="rows">
                        <div className="row">
                          <span className="row-label">
                            <img
                              className="row-icon"
                              src={jackBaseIcon}
                              alt=""
                              aria-hidden="true"
                            />
                            JACK Base
                          </span>
                          <strong>{prettyAmount(jackBase)} JACK</strong>
                        </div>

                        <div className="row">
                          <span className="row-label">
                            <img
                              className="row-icon"
                              src={premiumIcon}
                              alt=""
                              aria-hidden="true"
                            />
                            Premium
                          </span>
                          <strong className="premium">
                            +{formatNumber(premium)}%
                          </strong>
                        </div>

                        <div className="row total-row">
                          <span className="row-label">
                            <img
                              className="row-icon"
                              src={totalJackIcon}
                              alt=""
                              aria-hidden="true"
                            />
                            Total JACK
                          </span>
                          <strong>{prettyAmount(totalJack)} JACK</strong>
                        </div>
                      </div>

                      <div className="footrow">
                        <span className="stage-label">
                          <img
                            className="foot-icon"
                            src={unlockedIcon}
                            alt=""
                            aria-hidden="true"
                          />
                          {stage}
                        </span>

                        <span>
                          {daysLeft === 0 ? "Unlocked" : `${daysLeft} days left`}
                        </span>
                      </div>

                      <div className="track">
                        <i
                          className="fill"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleBondAction(bond)}
                      >
                        {actionLabel}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div
              className={`table-view ${
                currentView !== "list" ? "ghost" : ""
              }`}
            >
              <div className="table-head">
                <div>Bond ID</div>
                <div>pDAI</div>
                <div>TWAP at Bond</div>
                <div>JACK Base</div>
                <div>Premium</div>
                <div>Total Jack</div>
                <div>Duration</div>
                <div>Claim</div>
                <div>Transfer</div>
              </div>

              <div className="table-body-fixed">
                {listBonds.length === 0 ? (
                  <div className="table-row empty-table-row">
                    <div>No matching bond positions.</div>
                  </div>
                ) : (
                  <>
                    {listBonds.map((bond) => {
                      const premium = bondPremium(bond.days);
                      const jackBase = Number(bond.jack || 0);
                      const totalJack = getTotalJackFromBase(jackBase, premium);
                      const daysLeft = Math.max(
                        0,
                        diffDaysFromToday(bond.maturity)
                      );
                      const actionLabel = bondActionLabel(bond.status);
                      const isTermMenuOpen = openTermMenuId === bond.id;

                      return (
                        <div className="table-row" key={bond.id}>
                          <div>
                            <strong>{bond.id}</strong>
                          </div>

                          <div>{formatNumber(bond.pdai)}</div>
                          <div>{formatNumber(bond.twap, 4)}</div>
                          <div>{prettyAmount(jackBase)} JACK</div>

                          <div>
                            <strong className="premium table-premium">
                              +{formatNumber(premium)}%
                            </strong>
                          </div>

                          <div>{prettyAmount(totalJack)} JACK</div>

                          <div>
                            {daysLeft === 0
                              ? "Unlocked"
                              : `${daysLeft} days left`}
                          </div>

                          <div>
                            <button
                              type="button"
                              className={`table-action-btn ${
                                actionLabel === "Claim JACK"
                                  ? "claimable-action"
                                  : "view-action"
                              }`}
                              onClick={() => handleBondAction(bond)}
                            >
                              {actionLabel}
                            </button>
                          </div>

                          <div>
                            <div
                              className="table-settings-wrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className={`table-settings-btn ${
                                  isTermMenuOpen ? "open" : ""
                                }`}
                                aria-label={`Open transfer menu for ${bond.id}`}
                                title="Transfer NFT"
                                aria-haspopup="menu"
                                aria-expanded={isTermMenuOpen}
                                onClick={(e) => toggleTermMenu(e, bond.id)}
                              >
                                <img
                                  className="table-settings-icon"
                                  src={settingsIcon}
                                  alt=""
                                  aria-hidden="true"
                                />
                              </button>

                              {isTermMenuOpen && (
                                <div
                                  className="term-menu table-term-menu"
                                  role="menu"
                                >
                                  <button
                                    type="button"
                                    className="term-menu-item"
                                    role="menuitem"
                                    onClick={(e) => handleSendJackNft(e, bond)}
                                  >
                                    Send / Transfer NFT
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {Array.from({ length: listEmptySlots }).map((_, index) => (
                      <div
                        className="table-row table-placeholder-row"
                        key={`table-placeholder-${index}`}
                        aria-hidden="true"
                      >
                        <div>&nbsp;</div>
                        <div>&nbsp;</div>
                        <div>&nbsp;</div>
                        <div>&nbsp;</div>
                        <div>&nbsp;</div>
                        <div>&nbsp;</div>
                        <div>&nbsp;</div>
                        <div>&nbsp;</div>
                        <div>&nbsp;</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {currentView === "list" && filteredBonds.length > 0 && (
              <div className="pagination-bar compact-pagination">
                <button
                  type="button"
                  className="pager-arrow"
                  disabled={safeCurrentPage === 1}
                  onClick={() => goToPage(safeCurrentPage - 1)}
                  aria-label="Previous page"
                >
                  ‹
                </button>

                <div
                  className="pager-count"
                  aria-label={`Page ${safeCurrentPage} of ${totalPages}`}
                >
                  <span className="pager-current">{safeCurrentPage}</span>
                  <span className="pager-slash">/</span>
                  <span className="pager-total">{totalPages}</span>
                </div>

                <button
                  type="button"
                  className="pager-arrow"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() => goToPage(safeCurrentPage + 1)}
                  aria-label="Next page"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}