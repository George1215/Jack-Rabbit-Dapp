// src/pages/Treasury.js
import React, { useMemo, useState } from "react";
import styles from "../styles/TreasuryOverview.module.css";
import useTreasuryData, { shortAddress } from "../hooks/useTreasuryData";
import treasuryBackground from "../assets/jack-treasury-background.png";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function m(cls) {
  return styles[cls] || cls;
}

/*
  Main Treasury background.
  Save the image as:
  src/assets/jack-treasury-background.png
*/
const TREASURY_BACKGROUND_IMAGE = treasuryBackground;

/*
  Placeholder image names.
  Put your real images in public/assets/ later and update these names.
*/
const TOKEN_FEE_ICON = "/assets/token-fee-icon-placeholder.png";
const JACK_TOKEN_IMAGE = "/assets/jack-token-placeholder.png";
const MAX_SUPPLY_IMAGE = "/assets/max-supply-icon-placeholder.png";
const CIRCULATING_SUPPLY_IMAGE =
  "/assets/circulating-supply-icon-placeholder.png";
const PDAI_ICON = "/assets/pdai-icon-placeholder.png";
const PDAI_SUPPLY_IMAGE = "/assets/pdai-supply-icon-placeholder.png";
const PDAI_BALANCE_IMAGE = "/assets/pdai-balance-icon-placeholder.png";
const TREASURY_ICON = "/assets/treasury-icon-placeholder.png";
const JACK_BALANCE_IMAGE = "/assets/treasury-jack-balance-placeholder.png";
const JACK_INCOME_IMAGE = "/assets/jack-income-placeholder.png";
const LOAN_IMAGE = "/assets/loan-placeholder.png";
const PDAI_INCOME_IMAGE = "/assets/pdai-income-placeholder.png";
const FEE_MODE_IMAGE = "/assets/fee-mode-placeholder.png";

const PDAI_TOKEN_FALLBACK = "0x72F99D6a755609ab03Ce601E4674C059420901B9";

function SafeIcon({ src, alt }) {
  return (
    <img
      className={m("section-icon-img")}
      src={src}
      alt={alt}
      onError={(event) => {
        event.currentTarget.style.display = "none";
      }}
    />
  );
}

function TokenMedallion({ src, alt, fallback, variant }) {
  return (
    <div
      className={cx(
        m("token-medallion"),
        variant === "green" ? m("green-medallion") : ""
      )}
    >
      <SafeIcon src={src} alt={alt} />
      <span>{fallback}</span>
    </div>
  );
}

export default function Treasury() {
  const { CONFIG, userAddress, globalStatus, overview } = useTreasuryData();

  const [jackActionStatus, setJackActionStatus] = useState("");
  const [pdaiActionStatus, setPdaiActionStatus] = useState("");

  const jackAddress = useMemo(() => {
    return overview.jackTokenAddress || CONFIG.JACK_TOKEN;
  }, [overview.jackTokenAddress, CONFIG.JACK_TOKEN]);

  const pdaiAddress = useMemo(() => {
    return overview.pdaiAddress || CONFIG.PDAI_TOKEN || PDAI_TOKEN_FALLBACK;
  }, [overview.pdaiAddress, CONFIG.PDAI_TOKEN]);

  const treasuryTotalAssetValue = useMemo(() => {
    return (
      overview.treasuryTotalAssetValue ||
      overview.totalTreasuryAssetValue ||
      overview.treasuryValueUsd ||
      "$0.00"
    );
  }, [
    overview.treasuryTotalAssetValue,
    overview.totalTreasuryAssetValue,
    overview.treasuryValueUsd,
  ]);

  const treasuryPhase = useMemo(() => {
    if (overview.treasuryPhase) return overview.treasuryPhase;
    if (overview.isPegPhase || overview.pegPhaseActive) return "Peg Phase";
    return "Accumulation Phase";
  }, [overview.treasuryPhase, overview.isPegPhase, overview.pegPhaseActive]);

  const treasuryPhaseNote = useMemo(() => {
    const lowerPhase = String(treasuryPhase || "").toLowerCase();

    if (lowerPhase.includes("peg")) {
      return "Peg support and floor runner operations are active.";
    }

    return "Treasury is building reserves until the target is reached.";
  }, [treasuryPhase]);

  async function copyAddress(address, label, setStatus) {
    try {
      if (!address || address === "–") {
        setStatus(`❌ ${label} address not available.`);
        return;
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(address);
      } else {
        const tempInput = document.createElement("textarea");
        tempInput.value = address;
        tempInput.style.position = "fixed";
        tempInput.style.left = "-9999px";
        document.body.appendChild(tempInput);
        tempInput.focus();
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
      }

      setStatus(`✅ ${label} contract address copied.`);
    } catch (error) {
      console.error(error);
      setStatus(`❌ Could not copy ${label} address.`);
    }
  }

  async function addTokenToWallet({
    address,
    symbol,
    decimals,
    image,
    label,
    setStatus,
  }) {
    try {
      if (!window.ethereum) {
        setStatus("❌ Wallet not found.");
        return;
      }

      if (!address || address === "–") {
        setStatus(`❌ ${label} address not available.`);
        return;
      }

      const wasAdded = await window.ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address,
            symbol,
            decimals: Number(decimals || 18),
            image: `${window.location.origin}${image}`,
          },
        },
      });

      setStatus(
        wasAdded
          ? `✅ ${label} token added to wallet.`
          : "Wallet add request closed."
      );
    } catch (error) {
      console.error(error);
      setStatus(`❌ Could not add ${label} to wallet.`);
    }
  }

  return (
    <div
      className={m("jr-body")}
      style={{
        "--treasury-bg-image": `url(${TREASURY_BACKGROUND_IMAGE})`,
      }}
    >
      <div className={m("app-shell")}>
        <div className={m("bg-glow")} />
        <div className={m("bg-stamp")} />
        <div className={m("bg-pattern")} />

        <section className={m("section")}>
          <div className={m("overview-hero")}>
            <div className={m("overview-hero-icon")}>
              <SafeIcon src={TREASURY_ICON} alt="Treasury" />
              <span>🏛️</span>
            </div>

            <div className={m("overview-hero-copy")}>
              <div className={m("section-title")}>Global Overview</div>
              <div className={m("section-subtitle")}>
                JACK token health + Treasury accounting live readings
              </div>
            </div>

            <div className={m("hero-control-stack")}>
              <div className={m("overview-actions")}>
                <span
                  className={cx(
                    m("badge-orange"),
                    m("phase-pill"),
                    treasuryPhase.toLowerCase().includes("peg")
                      ? m("peg-phase")
                      : m("accumulation-phase")
                  )}
                  title={treasuryPhaseNote}
                >
                  <span className={m("phase-label")}>Phase:</span>
                  <span className={m("phase-value")}>{treasuryPhase}</span>
                </span>
              </div>

              <div className={m("phase-note")}>{treasuryPhaseNote}</div>
            </div>
          </div>

          <div className={cx(m("panel"), m("luxury-panel"), m("token-panel"))}>
            <div className={m("section-header")}>
              <div className={m("section-heading-left")}>
                <div className={m("section-icon-badge")}>
                  <SafeIcon src={TOKEN_FEE_ICON} alt="Token + Treasury Value" />
                  <span>💎</span>
                </div>

                <div>
                  <div className={m("section-title")}>
                    Token + Treasury Value
                  </div>
                  <div className={m("section-subtitle")}>
                    Core token readouts and Treasury value estimate
                  </div>
                </div>
              </div>

              <div
                className={cx(
                  m("badge-teal"),
                  m("luxury-pill"),
                  m("treasury-value-pill")
                )}
                data-tooltip="JACK + pDAI + holdings + pending swaps + LPs"
              >
                <span className={m("treasury-value-label")}>
                  Treasury Total Asset Value
                </span>
                <span className={m("treasury-value-colon")}>:</span>
                <span className={m("treasury-value-amount")}>
                  {treasuryTotalAssetValue}
                </span>
              </div>
            </div>

            <div
              className={cx(
                m("card-grid"),
                m("token-main-grid"),
                m("token-main-grid-compact")
              )}
            >
              <div
                className={cx(
                  m("card"),
                  m("luxury-card"),
                  m("token-address-card"),
                  m("jack-card")
                )}
              >
                <div className={m("compact-token-head")}>
                  <TokenMedallion
                    src={JACK_TOKEN_IMAGE}
                    alt="JACK token"
                    fallback="🐇"
                  />

                  <div className={m("compact-token-copy")}>
                    <div className={m("card-value")}>{overview.name}</div>
                    <div className={m("card-muted")}>{overview.symbol}</div>
                  </div>
                </div>

                <div className={m("token-address-compact")}>
                  <div className={m("token-address-copyline")}>
                    <span>Contract Address</span>
                    <code>{jackAddress}</code>
                  </div>

                  <div className={m("token-compact-actions")}>
                    <button
                      className={cx(m("mini-btn"), m("mini-btn-copy"))}
                      onClick={() =>
                        copyAddress(jackAddress, "JACK", setJackActionStatus)
                      }
                      title="Copy JACK contract address"
                    >
                      Copy
                    </button>

                    <button
                      className={cx(m("mini-btn"), m("mini-btn-wallet"))}
                      onClick={() =>
                        addTokenToWallet({
                          address: jackAddress,
                          symbol: overview.symbol || "JACK",
                          decimals: overview.decimals || 18,
                          image: JACK_TOKEN_IMAGE,
                          label: "JACK",
                          setStatus: setJackActionStatus,
                        })
                      }
                      title="Add JACK token to wallet"
                    >
                      Add Token
                    </button>
                  </div>
                </div>

                {jackActionStatus ? (
                  <div className={m("token-action-status")}>
                    {jackActionStatus}
                  </div>
                ) : null}
              </div>

              <div
                className={cx(
                  m("card"),
                  m("luxury-card"),
                  m("token-small-card")
                )}
              >
                <div className={m("stat-card-head")}>
                  <TokenMedallion
                    src={MAX_SUPPLY_IMAGE}
                    alt="Max Supply"
                    fallback="🪙"
                  />

                  <div className={m("card-label")}>Max Supply</div>
                </div>

                <div className={m("card-value")}>{overview.supply}</div>
                <div className={m("card-muted")}>
                  The maximum number of JACK tokens that can exist.
                </div>
              </div>

              <div
                className={cx(
                  m("card"),
                  m("luxury-card"),
                  m("token-small-card")
                )}
              >
                <div className={m("stat-card-head")}>
                  <TokenMedallion
                    src={CIRCULATING_SUPPLY_IMAGE}
                    alt="Circulating Supply"
                    fallback="🔄"
                  />

                  <div className={m("card-label")}>Circulating Supply</div>
                </div>

                <div className={m("card-value")}>{overview.circulating}</div>
                <div className={m("card-muted")}>
                  The JACK supply currently remaining after burned tokens.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={m("section")}>
          <div className={cx(m("panel"), m("luxury-panel"), m("pdai-panel"))}>
            <div className={m("section-header")}>
              <div className={m("section-heading-left")}>
                <div className={cx(m("section-icon-badge"), m("pdai-icon"))}>
                  <SafeIcon src={PDAI_ICON} alt="pDAI" />
                  <span>🛡️</span>
                </div>

                <div>
                  <div className={m("section-title")}>pDAI Reserve Center</div>
                  <div className={m("section-subtitle")}>
                    Protected pDAI token readouts
                  </div>
                </div>
              </div>
            </div>

            <div
              className={cx(
                m("card-grid"),
                m("pdai-main-grid"),
                m("pdai-main-grid-compact")
              )}
            >
              <div
                className={cx(
                  m("card"),
                  m("luxury-card"),
                  m("token-address-card"),
                  m("pdai-token-card")
                )}
              >
                <div className={m("compact-token-head")}>
                  <TokenMedallion
                    src={PDAI_ICON}
                    alt="pDAI token"
                    fallback="💵"
                    variant="green"
                  />

                  <div className={m("compact-token-copy")}>
                    <div className={m("card-value")}>
                      {overview.pdaiSymbol || "pDAI"}
                    </div>
                    <div className={m("card-muted")}>PulseChain DAI token</div>
                  </div>
                </div>

                <div className={m("token-address-compact")}>
                  <div className={m("token-address-copyline")}>
                    <span>pDAI Contract Address</span>
                    <code>{pdaiAddress}</code>
                  </div>

                  <div className={m("token-compact-actions")}>
                    <button
                      className={cx(m("mini-btn"), m("mini-btn-copy"))}
                      onClick={() =>
                        copyAddress(pdaiAddress, "pDAI", setPdaiActionStatus)
                      }
                      title="Copy pDAI contract address"
                    >
                      Copy
                    </button>

                    <button
                      className={cx(m("mini-btn"), m("mini-btn-wallet"))}
                      onClick={() =>
                        addTokenToWallet({
                          address: pdaiAddress,
                          symbol: overview.pdaiSymbol || "pDAI",
                          decimals: overview.pdaiDecimals || 18,
                          image: PDAI_ICON,
                          label: "pDAI",
                          setStatus: setPdaiActionStatus,
                        })
                      }
                      title="Add pDAI token to wallet"
                    >
                      Add Token
                    </button>
                  </div>
                </div>

                {pdaiActionStatus ? (
                  <div className={m("token-action-status")}>
                    {pdaiActionStatus}
                  </div>
                ) : null}
              </div>

              <div
                className={cx(
                  m("card"),
                  m("luxury-card"),
                  m("token-small-card"),
                  m("pdai-small-card")
                )}
              >
                <div className={m("stat-card-head")}>
                  <TokenMedallion
                    src={PDAI_SUPPLY_IMAGE}
                    alt="Total pDAI Supply"
                    fallback="📊"
                    variant="green"
                  />

                  <div className={m("card-label")}>Total pDAI Supply</div>
                </div>

                <div className={m("card-value")}>
                  {overview.pdaiTotalSupply}
                </div>
                <div className={m("card-muted")}>
                  Total amount of pDAI currently created on PulseChain.
                </div>
              </div>

              <div
                className={cx(
                  m("card"),
                  m("luxury-card"),
                  m("token-small-card"),
                  m("pdai-small-card")
                )}
              >
                <div className={m("stat-card-head")}>
                  <TokenMedallion
                    src={PDAI_BALANCE_IMAGE}
                    alt="Treasury pDAI Balance"
                    fallback="🏦"
                    variant="green"
                  />

                  <div className={m("card-label")}>Treasury pDAI Balance</div>
                </div>

                <div className={m("card-value")}>
                  {overview.pdaiTreasuryBalance}
                </div>
                <div className={m("card-muted")}>
                  Actual pDAI held by the Treasury wallet.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={m("section")}>
          <div
            className={cx(m("panel"), m("luxury-panel"), m("snapshot-panel"))}
          >
            <div className={m("section-header")}>
              <div className={m("section-heading-left")}>
                <div className={cx(m("section-icon-badge"), m("treasury-icon"))}>
                  <SafeIcon src={TREASURY_ICON} alt="Treasury snapshot" />
                  <span>🏦</span>
                </div>

                <div>
                  <div className={m("section-title")}>Treasury Snapshot</div>
                  <div className={m("section-subtitle")}>
                    Key JACK, pDAI, loan, and fee status readouts
                  </div>
                </div>
              </div>

              <span
                className={cx(
                  m("badge-teal"),
                  m("luxury-pill"),
                  m("snapshot-income-pill")
                )}
              >
                <span className={m("snapshot-income-title")}>
                  24H Treasury Inflow
                </span>
                <span className={m("snapshot-income-value")}>
                  JACK: <b>{overview.todayNet}</b>
                </span>
                <span className={m("snapshot-income-divider")}>•</span>
                <span className={m("snapshot-income-value")}>
                  pDAI: <b>{overview.pdaiTodayIncome}</b>
                </span>
              </span>
            </div>

            <div className={cx(m("card-grid"), m("wide"))}>
              <div className={cx(m("card"), m("luxury-card"))}>
                <div className={m("stat-card-head")}>
                  <TokenMedallion
                    src={JACK_BALANCE_IMAGE}
                    alt="Treasury JACK Balance"
                    fallback="🏦"
                  />

                  <div className={m("card-label")}>Treasury JACK Balance</div>
                </div>

                <div className={m("card-value")}>{overview.treasuryJack}</div>
                <div className={m("card-muted")}>
                  Amount of JACK currently held by the Treasury.
                </div>
              </div>

              <div className={cx(m("card"), m("luxury-card"))}>
                <div className={m("stat-card-head")}>
                  <TokenMedallion
                    src={JACK_INCOME_IMAGE}
                    alt="JACK Income"
                    fallback="📈"
                  />

                  <div className={m("card-label")}>JACK Income (5Y)</div>
                </div>

                <div className={m("card-value")}>{overview.jackIncome5Y}</div>
                <div className={m("card-muted")}>
                  Rolling five-year JACK income tracked by Treasury.
                </div>
              </div>

              <div className={cx(m("card"), m("luxury-card"))}>
                <div className={m("stat-card-head")}>
                  <TokenMedallion
                    src={LOAN_IMAGE}
                    alt="Loan Outstanding"
                    fallback="🤝"
                  />

                  <div className={m("card-label")}>Loan Outstanding</div>
                </div>

                <div className={m("card-value")}>
                  {overview.loanOutstanding}
                </div>
                <div className={m("card-muted")}>
                  Emergency JACK loan amount still unpaid.
                </div>
              </div>
            </div>

            <div
              className={cx(m("card-grid"), m("wide"))}
              style={{ marginTop: 10 }}
            >
              <div
                className={cx(
                  m("card"),
                  m("luxury-card"),
                  m("pdai-small-card")
                )}
              >
                <div className={m("stat-card-head")}>
                  <TokenMedallion
                    src={PDAI_BALANCE_IMAGE}
                    alt="Treasury pDAI Balance"
                    fallback="🏦"
                    variant="green"
                  />

                  <div className={m("card-label")}>Treasury pDAI Balance</div>
                </div>

                <div className={m("card-value")}>
                  {overview.pdaiTreasuryBalance}
                </div>
                <div className={m("card-muted")}>
                  Actual pDAI held by the Treasury wallet.
                </div>
              </div>

              <div
                className={cx(
                  m("card"),
                  m("luxury-card"),
                  m("pdai-small-card")
                )}
              >
                <div className={m("stat-card-head")}>
                  <TokenMedallion
                    src={PDAI_INCOME_IMAGE}
                    alt="pDAI Income"
                    fallback="📊"
                    variant="green"
                  />

                  <div className={m("card-label")}>pDAI Income (5Y)</div>
                </div>

                <div className={m("card-value")}>{overview.pdaiIncome5Y}</div>
                <div className={m("card-muted")}>
                  Rolling five-year pDAI income tracked by Treasury.
                </div>
              </div>

              <div className={cx(m("card"), m("luxury-card"))}>
                <div className={m("stat-card-head")}>
                  <TokenMedallion
                    src={FEE_MODE_IMAGE}
                    alt="Fee Mode"
                    fallback="⚙️"
                  />

                  <div className={m("card-label")}>Fee Mode</div>
                </div>

                <div className={m("card-value")}>{overview.feeMode}</div>
                <div className={m("card-muted")}>
                  Shows whether fee control is dynamic or manually overridden.
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className={cx(m("status-bar"), m("luxury-status"))}>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span>{globalStatus}</span>

            <span className={m("muted")}>
              Wallet:{" "}
              <b>{userAddress ? shortAddress(userAddress) : "Not connected"}</b>
            </span>

            <span className={m("muted")}>
              Network: <b>{CONFIG.NETWORK_LABEL}</b>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}