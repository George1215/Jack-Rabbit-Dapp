// src/pages/TreasuryBurnEngine.js
import React, { useMemo, useState } from "react";
import { ethers } from "ethers";

import styles from "../styles/TreasuryBurnEngine.module.css";

import useTreasuryData, {
  fmtUnits,
  humanToUnits,
  shortAddress,
} from "../hooks/useTreasuryData";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function m(cls) {
  return styles[cls] || cls;
}

/*
  Placeholder image names.
  Put your real images in public/assets/ later and update these names.
*/
const BURN_ENGINE_ICON = "/assets/burn-engine-icon-placeholder.png";
const CURRENT_FEE_ICON = "/assets/current-fee-icon-placeholder.png";
const FEE_MODE_ICON = "/assets/fee-mode-placeholder.png";
const EXPIRY_ICON = "/assets/manual-expiry-icon-placeholder.png";
const TOTAL_BURNED_ICON = "/assets/total-burned-icon-placeholder.png";
const LOAN_OUTSTANDING_ICON = "/assets/loan-placeholder.png";
const LOAN_REPAID_ICON = "/assets/loan-repaid-placeholder.png";
const LOAN_REQUESTABLE_ICON = "/assets/loan-requestable-placeholder.png";
const LOAN_ROOM_ICON = "/assets/loan-room-placeholder.png";
const DYNAMIC_BAND_ICON = "/assets/dynamic-band-icon-placeholder.png";
const FEE_PPB_ICON = "/assets/fee-ppb-icon-placeholder.png";
const BURN_PPB_ICON = "/assets/burn-ppb-icon-placeholder.png";
const REFERENCE_ICON = "/assets/reference-icon-placeholder.png";
const SIMULATION_ICON = "/assets/simulation-icon-placeholder.png";
const TRANSFER_FEE_ICON = "/assets/transfer-fee-icon-placeholder.png";
const JACK_BURNED_ICON = "/assets/jack-burned-placeholder.png";
const TO_TREASURY_ICON = "/assets/to-treasury-placeholder.png";

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

function PanelTitleIcon({ src, alt, fallback, variant }) {
  return (
    <div
      className={cx(
        m("section-icon-badge"),
        variant === "green" ? m("pdai-icon") : "",
        variant === "treasury" ? m("treasury-icon") : ""
      )}
    >
      <SafeIcon src={src} alt={alt} />
      <span>{fallback}</span>
    </div>
  );
}

function ReadoutCard({ icon, fallback, label, value, muted, variant }) {
  return (
    <div className={cx(m("card"), m("luxury-card"), m("burn-small-card"))}>
      <div className={m("stat-card-head")}>
        <TokenMedallion
          src={icon}
          alt={label}
          fallback={fallback}
          variant={variant}
        />

        <div className={m("card-label")}>{label}</div>
      </div>

      <div className={m("card-value")}>{value}</div>
      <div className={m("card-muted")}>{muted}</div>
    </div>
  );
}

export default function TreasuryBurnEngine() {
  const { CONFIG, userAddress, globalStatus, overview, LIVE, computed } =
    useTreasuryData();

  const [simTransfer, setSimTransfer] = useState("");
  const [simFeePpb, setSimFeePpb] = useState("");
  const [simStatus, setSimStatus] = useState("");

  const burnSharePct = Number(computed.burnSharePct || 0);
  const treasurySharePct = Number(computed.treSharePct || 0);

  const loanOutstanding =
    overview.loanOutstanding ||
    overview.loanOutstandingJack ||
    overview.treasuryLoanOutstanding ||
    "0 JACK";

  const loanRepaid =
    overview.loanRepaid ||
    overview.loanRepaidJack ||
    overview.treasuryLoanRepaid ||
    "0 JACK";

  const loanRequestable =
    overview.loanRequestable ||
    overview.loanRequestableJack ||
    overview.requestableLoan ||
    overview.requestableLoanAmount ||
    overview.mintCredit ||
    "0 JACK";

  const loanRoomLeft =
    overview.loanRoomLeft ||
    overview.loanRoomRemaining ||
    overview.remainingLoanRoom ||
    overview.loanCapacityRemaining ||
    overview.loanAvailableRoom ||
    overview.extraLoanRoom ||
    overview.remainingMintCreditRoom ||
    overview.mintCreditRemaining ||
    overview.mintCredit ||
    "0 JACK";

  const referenceNowVsTarget = `${overview.treasuryJack || "0 JACK"} / ${
    overview.treasuryTarget || "0 JACK"
  }`;

  const simOut = useMemo(() => {
    try {
      if (!simTransfer.trim()) {
        return {
          fee: "–",
          burn: "–",
          treas: "–",
          net: "–",
        };
      }

      const decimals = 18;
      const symbol = overview.symbol || "JACK";
      const amountWei = humanToUnits(simTransfer, decimals);

      const feePpb = simFeePpb.trim()
        ? ethers.toBigInt(simFeePpb.trim())
        : LIVE.feeBP || 0n;

      const burnShareBP = LIVE.burnShareBP || 0n;

      const feeWei = (amountWei * feePpb) / 1_000_000_000n;
      const burnWei = (feeWei * burnShareBP) / 10_000n;
      const treWei = feeWei - burnWei;
      const netWei = amountWei - feeWei;

      return {
        fee: `${fmtUnits(feeWei, decimals, 6)} ${symbol}`,
        burn: `${fmtUnits(burnWei, decimals, 6)} ${symbol}`,
        treas: `${fmtUnits(treWei, decimals, 6)} ${symbol}`,
        net: `${fmtUnits(netWei, decimals, 6)} ${symbol}`,
      };
    } catch {
      return {
        fee: "–",
        burn: "–",
        treas: "–",
        net: "–",
      };
    }
  }, [simTransfer, simFeePpb, LIVE.feeBP, LIVE.burnShareBP, overview.symbol]);

  function runSimulation() {
    if (!simTransfer.trim()) {
      setSimStatus("❌ Enter transfer amount.");
      return;
    }

    setSimStatus(`✅ Simulated using burn share ${computed.burnPctStr}.`);
  }

  function resetToLive() {
    setSimFeePpb(String(LIVE.feeBP || 0n));
    setSimStatus("✅ Reset to live fee.");
  }

  return (
    <div className={m("jr-body")}>
      <div className={m("app-shell")}>
        <div className={m("bg-glow")} />
        <div className={m("bg-stamp")} />
        <div className={m("bg-pattern")} />

        <section className={m("section")}>
          <div className={m("section-header")}>
            <div>
              <div className={m("section-title")}>Burn Engine</div>
              <div className={m("section-subtitle")}>
                Live Treasury and JACK contract readouts
              </div>
            </div>

            <span className={m("badge-orange")}>
              Fee: <span>{computed.feePctStr}</span> • Burn Share:{" "}
              <span>{computed.burnPctStr}</span>
            </span>
          </div>

          <div
            className={cx(
              m("panel"),
              m("burn-section-frame"),
              m("burn-readouts-frame")
            )}
          >
            <div className={m("panel-title")}>
              <div className={m("panel-title-left")}>
                <PanelTitleIcon
                  src={BURN_ENGINE_ICON}
                  alt="Burn / Mint Readouts"
                  fallback="🔥"
                />

                <h3>Burn / Mint Readouts</h3>
              </div>
            </div>

            <div
              className={cx(m("card-grid"), m("burn-readout-grid"))}
              style={{ marginTop: 6 }}
            >
              <ReadoutCard
                icon={CURRENT_FEE_ICON}
                fallback="%"
                label="Current Fee"
                value={computed.feePctStr}
                muted="Live transfer fee"
              />

              <ReadoutCard
                icon={FEE_MODE_ICON}
                fallback="⚙️"
                label="Fee Mode"
                value={overview.feeMode}
                muted="Dynamic or manual override"
              />

              <ReadoutCard
                icon={EXPIRY_ICON}
                fallback="⏳"
                label="Manual BP Expiry"
                value={overview.manualExpiry}
                muted="Override expiry"
              />

              <ReadoutCard
                icon={TOTAL_BURNED_ICON}
                fallback="🔥"
                label="Total Burned"
                value={overview.burned}
                muted="Total JACK burned"
              />

              <ReadoutCard
                icon={LOAN_OUTSTANDING_ICON}
                fallback="🤝"
                label="Loan Outstanding"
                value={loanOutstanding}
                muted="Emergency JACK still owed"
              />

              <ReadoutCard
                icon={LOAN_REPAID_ICON}
                fallback="♻️"
                label="Loan Repaid"
                value={loanRepaid}
                muted="JACK repaid from future income"
              />

              <ReadoutCard
                icon={LOAN_REQUESTABLE_ICON}
                fallback="📄"
                label="Loan Requestable"
                value={loanRequestable}
                muted="Treasury can request now"
              />

              <ReadoutCard
                icon={LOAN_ROOM_ICON}
                fallback="🏦"
                label="Loan Room Left"
                value={loanRoomLeft}
                muted="More JACK Treasury can still borrow"
              />
            </div>

            <div className={m("burn-frame-status")}>
              <span>
                Fee, burn share, treasury share, mint credit, loan requestable
                amount, and remaining loan room are computed from live Treasury
                and JACK contract reads.
              </span>
            </div>
          </div>

          <div className={m("burn-visuals-grid")}>
            <div
              className={cx(
                m("jr-modern-band"),
                m("burn-section-frame"),
                m("dynamic-band-frame")
              )}
              id="band2"
            >
              <div className={m("band2-head")}>
                <div className={m("left")}>
                  <div className={m("band-heading-row")}>
                    <PanelTitleIcon
                      src={DYNAMIC_BAND_ICON}
                      alt="Dynamic Band"
                      fallback="📊"
                      variant="green"
                    />

                    <div>
                      <div className={m("kicker")}>Dynamic Band</div>
                      <div className={m("title")}>Live Burn Position</div>
                    </div>
                  </div>
                </div>

                <span className={m("pill-mini")}>
                  <span className={m("dot")} />
                  <span>{computed.mode}</span>
                </span>
              </div>

              <div className={m("band2-metrics")}>
                <div className={cx(m("metric-chip"), m("luxury-card"))}>
                  <div className={m("stat-card-head")}>
                    <TokenMedallion
                      src={FEE_PPB_ICON}
                      alt="FeePPB"
                      fallback="📈"
                      variant="green"
                    />

                    <div className={m("k")}>FeePPB</div>
                  </div>

                  <div className={m("v")}>
                    {String(LIVE.feeBP || 0n)}
                    <span className={m("unit-inline")}> ppb</span>
                  </div>

                  <div className={m("s")}>Full transfer fee precision</div>
                </div>

                <div className={cx(m("metric-chip"), m("luxury-card"))}>
                  <div className={m("stat-card-head")}>
                    <TokenMedallion
                      src={BURN_PPB_ICON}
                      alt="BurnPPB"
                      fallback="🔥"
                    />

                    <div className={m("k")}>BurnPPB</div>
                  </div>

                  <div className={m("v")}>
                    {String(computed.burnBP || 0)}
                    <span className={m("unit-inline")}> ppb</span>
                  </div>

                  <div className={m("s")}>Actual burned part</div>
                </div>

                <div className={cx(m("metric-chip"), m("luxury-card"))}>
                  <div className={m("stat-card-head")}>
                    <TokenMedallion
                      src={REFERENCE_ICON}
                      alt="Reference"
                      fallback="🎯"
                      variant="green"
                    />

                    <div className={m("k")}>Reference</div>
                  </div>

                  <div className={m("v")}>{referenceNowVsTarget}</div>
                  <div className={m("s")}>Treasury JACK / target</div>
                </div>
              </div>

              <div className={m("share-wrap")}>
                <div
                  className={m("donut")}
                  style={{
                    "--burn": burnSharePct,
                    "--treasury": treasurySharePct,
                  }}
                  aria-label={`Burn share ${burnSharePct.toFixed(
                    2
                  )}% and treasury share ${treasurySharePct.toFixed(2)}%`}
                >
                  <div className={m("donut-center")}>
                    <div className={cx(m("donut-readout"), m("burn-readout"))}>
                      <div className={m("donut-readout-value")}>
                        {burnSharePct.toFixed(2)}%
                      </div>
                      <div className={m("donut-readout-label")}>Burn</div>
                    </div>

                    <div className={m("donut-readout-divider")} />

                    <div
                      className={cx(
                        m("donut-readout"),
                        m("treasury-readout")
                      )}
                    >
                      <div className={m("donut-readout-value")}>
                        {treasurySharePct.toFixed(2)}%
                      </div>
                      <div className={m("donut-readout-label")}>Treasury</div>
                    </div>
                  </div>
                </div>

                <div className={m("share-right")}>
                  <div className={m("row")}>
                    <div>Fee split inside the transfer fee</div>
                    <div>
                      <b>{burnSharePct.toFixed(2)}% burn</b> /{" "}
                      <b>{treasurySharePct.toFixed(2)}% treasury</b>
                    </div>
                  </div>

                  <div className={m("sharebar")} aria-label="Fee split bar">
                    <div
                      className={m("burn")}
                      style={{ width: `${burnSharePct}%` }}
                    />
                    <div
                      className={m("treas")}
                      style={{ width: `${treasurySharePct}%` }}
                    />
                  </div>

                  <div className={m("legend")}>
                    <span className={m("pill")}>
                      <span className={cx(m("dot"), m("burn"))} /> Burn share
                    </span>

                    <span className={m("pill")}>
                      <span className={cx(m("dot"), m("treas"))} /> Treasury
                      share
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={cx(
                m("panel"),
                m("burn-section-frame"),
                m("simulation-frame")
              )}
            >
              <div className={m("panel-title")}>
                <div className={m("panel-title-left")}>
                  <PanelTitleIcon
                    src={SIMULATION_ICON}
                    alt="Manual Simulation"
                    fallback="🧮"
                    variant="treasury"
                  />

                  <h3>Manual Simulation (read-only)</h3>
                </div>

                <div className={m("simulation-actions")}>
                  <button
                    className={cx(m("mini-btn"), m("mini-btn-wallet"))}
                    onClick={runSimulation}
                  >
                    Simulate
                  </button>

                  <button
                    className={cx(m("mini-btn"), m("mini-btn-copy"))}
                    onClick={resetToLive}
                  >
                    Reset to live
                  </button>
                </div>
              </div>

              <div className={m("simulation-input-row")}>
                <input
                  className={m("input-pill")}
                  value={simTransfer}
                  onChange={(event) => setSimTransfer(event.target.value)}
                  placeholder="Transfer amount (JACK)"
                />

                <input
                  className={m("input-pill")}
                  value={simFeePpb}
                  onChange={(event) => setSimFeePpb(event.target.value)}
                  placeholder="FeePPB e.g. 1000000"
                />
              </div>

              <div className={m("simulation-box")}>
                <div className={m("formula-strip")}>
                  Burned = amount × FeePPB ÷ 1,000,000,000 × burnShareBP ÷
                  10,000.
                </div>

                <div
                  className={cx(m("card-grid"), m("wide"))}
                  style={{ marginTop: 10 }}
                >
                  <ReadoutCard
                    icon={TRANSFER_FEE_ICON}
                    fallback="🪙"
                    label="Per Transfer Fee"
                    value={simOut.fee}
                    muted="Fee from transfer"
                    variant="green"
                  />

                  <ReadoutCard
                    icon={JACK_BURNED_ICON}
                    fallback="🔥"
                    label="JACK Burned"
                    value={simOut.burn}
                    muted="Burned amount"
                  />

                  <ReadoutCard
                    icon={TO_TREASURY_ICON}
                    fallback="🏦"
                    label="To Treasury"
                    value={simOut.treas}
                    muted="Treasury share"
                    variant="green"
                  />
                </div>

                <div className={cx(m("card"), m("luxury-card"), m("net-card"))}>
                  <div className={m("card-label")}>User receives net</div>
                  <div className={m("card-value")}>{simOut.net}</div>
                  <div className={m("card-muted")}>After transfer fee</div>
                </div>

                <div className={m("status-bar")}>{simStatus}</div>
              </div>
            </div>
          </div>
        </section>

        <div className={m("status-bar")} style={{ marginTop: 10 }}>
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