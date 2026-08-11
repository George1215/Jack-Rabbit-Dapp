// src/pages/TreasuryVault.js

import React from "react";

import styles from "../styles/TreasuryVault.module.css";

import useTreasuryData, { shortAddress } from "../hooks/useTreasuryData";

/* =========================================================
   REAL PROJECT TOKEN IMAGES
========================================================= */

import logoJACK from "../assets/jacklogo.png";
import logoPLS from "../assets/pls.svg";
import logoPLSX from "../assets/plsx.svg";
import logoHEX from "../assets/hex.svg";
import logoINC from "../assets/inc.svg";
import logoPRVX from "../assets/prvx.png";
import logoPDAI from "../assets/pdai.svg";
import logoATROPA from "../assets/atropa.svg";
import logoTEDDY from "../assets/teddy.png";
import logoUNKNOWN from "../assets/unknown.png";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function m(cls) {
  return styles[cls] || cls;
}

/* =========================================================
   KNOWN TOKEN ADDRESSES
========================================================= */

const TOKEN_LOGOS_BY_ADDRESS = {
  /* PLSX */
  "0x8a810ea8b121d08342e9e7696f4a9915cbe494b7": logoPLSX,

  /* HEX */
  "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39": logoHEX,

  /* INC */
  "0x6efafcb715f385c71d8af763e8478feea6fadf63": logoINC,

  /* ATROPA */
  "0x8f618a17f59b4b2bd9ab0fbcde0d7d2f66bfee3a": logoATROPA,

  /* pDAI */
  "0x72f99d6a755609ab03ce601e4674c059420901b9": logoPDAI,

  /* TEDDY */
  "0xe510cc9bafaaec0ce01995ed2b257422da32aac5": logoTEDDY,
};

/* =========================================================
   TOKEN SYMBOL IMAGE MAP
========================================================= */

const TOKEN_LOGOS_BY_SYMBOL = {
  JACK: logoJACK,
  PLS: logoPLS,
  WPLS: logoPLS,
  PLSX: logoPLSX,
  HEX: logoHEX,
  INC: logoINC,
  PRVX: logoPRVX,
  PDAI: logoPDAI,
  ATROPA: logoATROPA,
  TEDDY: logoTEDDY,
};

/* =========================================================
   TOKEN NAME MAP

   These names are used only when the hook has not returned
   an ERC20 token name.
========================================================= */

const TOKEN_NAMES_BY_SYMBOL = {
  JACK: "Jack Rabbit",
  PLS: "PulseChain",
  WPLS: "Wrapped Pulse",
  PLSX: "PulseX",
  HEX: "HEX",
  INC: "Incentive Token",
  PRVX: "PRVX",
  PDAI: "PulseChain DAI",
  ATROPA: "Atropa",
  TEDDY: "Teddy Bear",
};

/* =========================================================
   INLINE IMAGE PRESENTATION

   This deliberately overrides the old orange medallion
   presentation without requiring a CSS update.

   Result:
   - no border
   - no orange background
   - round token image
   - subtle shadow
========================================================= */

const TOKEN_IMAGE_WRAPPER_STYLE = {
  width: "36px",
  height: "36px",
  minWidth: "46px",
  flex: "0 0 46px",
  display: "grid",
  placeItems: "center",
  position: "relative",
  overflow: "visible",
  border: "none",
  borderRadius: "50%",
  background: "transparent",
  boxShadow: "none",
  padding: 0,
};

const TOKEN_IMAGE_STYLE = {
  width: "36px",
  height: "36px",
  display: "block",
  objectFit: "cover",
  objectPosition: "center",
  border: "none",
  outline: "none",
  borderRadius: "50%",
  background: "transparent",
  boxShadow:
    "0 7px 0 rgba(92, 48, 24, 0.20), 0 10px 16px rgba(61, 28, 11, 0.18)",
};

/* =========================================================
   TOKEN HELPERS
========================================================= */

function normalizeAddress(address) {
  const value = String(address || "").trim().toLowerCase();

  if (!value.startsWith("0x") || value.length !== 42) {
    return "";
  }

  return value;
}

function normalizeSymbol(symbol) {
  return String(symbol || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^PDAI$/, "PDAI");
}

function getPairSymbols(value) {
  const text = String(value || "").toUpperCase();

  return text
    .replace(/LP TOKEN/g, "")
    .replace(/LIQUIDITY TOKEN/g, "")
    .replace(/LIQUIDITY POSITION/g, "")
    .replace(/\bLP\b/g, "")
    .split(/[^A-Z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getTokenSymbolFromRow(row, isLp = false) {
  const directSymbol = normalizeSymbol(row?.symbol);

  if (directSymbol) {
    return directSymbol;
  }

  if (isLp) {
    const parts = getPairSymbols(row?.name);

    if (parts.length) {
      return parts.join("-");
    }
  }

  return isLp ? "LP" : "TOKEN";
}

function getTokenNameFromRow(row, symbol, isLp = false) {
  const rowName = String(row?.name || "").trim();

  if (
    rowName &&
    rowName.toLowerCase() !== "erc-20 token" &&
    rowName.toLowerCase() !== "tracked token" &&
    rowName.toLowerCase() !== "treasury holding token"
  ) {
    return rowName;
  }

  if (isLp) {
    return rowName || `${symbol} Liquidity Position`;
  }

  return TOKEN_NAMES_BY_SYMBOL[symbol] || rowName || symbol || "Token";
}

function getLogoFromLpSymbol(row) {
  const parts = [
    ...getPairSymbols(row?.symbol),
    ...getPairSymbols(row?.name),
  ];

  /*
    Prefer the non-JACK token for a JACK paired LP.
    Example:
    JACK-HEX LP will use the HEX image.
  */
  const pairedToken = parts.find(
    (part) => part !== "JACK" && TOKEN_LOGOS_BY_SYMBOL[part]
  );

  if (pairedToken) {
    return TOKEN_LOGOS_BY_SYMBOL[pairedToken];
  }

  const anyKnownToken = parts.find(
    (part) => TOKEN_LOGOS_BY_SYMBOL[part]
  );

  if (anyKnownToken) {
    return TOKEN_LOGOS_BY_SYMBOL[anyKnownToken];
  }

  return logoUNKNOWN;
}

function getTokenLogo(row, isLp = false) {
  const normalizedAddress = normalizeAddress(row?.addr || row?.address);

  /*
    Address matching is the strongest match for ERC20 assets.
  */
  if (
    normalizedAddress &&
    TOKEN_LOGOS_BY_ADDRESS[normalizedAddress]
  ) {
    return TOKEN_LOGOS_BY_ADDRESS[normalizedAddress];
  }

  const symbol = getTokenSymbolFromRow(row, isLp);

  /*
    Handle the native PLS holding row.
    It may not have a normal ERC20 contract address.
  */
  if (
    symbol === "PLS" ||
    String(row?.addr || "")
      .toLowerCase()
      .includes("pls (native)") ||
    String(row?.name || "")
      .toLowerCase()
      .includes("pulsechain")
  ) {
    return logoPLS;
  }

  if (TOKEN_LOGOS_BY_SYMBOL[symbol]) {
    return TOKEN_LOGOS_BY_SYMBOL[symbol];
  }

  if (isLp) {
    return getLogoFromLpSymbol(row);
  }

  return logoUNKNOWN;
}

/* =========================================================
   DISPLAY-AMOUNT HELPERS
========================================================= */

function parseDisplayAmount(value) {
  const text = String(value ?? "")
    .replace(/,/g, "")
    .trim();

  if (!text || text === "–") {
    return null;
  }

  const match = text.match(/-?\d+(\.\d+)?/);

  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);

  return Number.isFinite(parsed) ? parsed : null;
}

function decimalsFrom(value) {
  const text = String(value ?? "");
  const match = text.match(/\.(\d+)/);

  if (!match) {
    return 0;
  }

  return Math.min(
    match[1].replace(/0+$/, "").length,
    6
  );
}

function cleanNumber(value, maxDp = 6) {
  if (!Number.isFinite(value)) {
    return "–";
  }

  const fixed = value.toFixed(maxDp);
  const trimmed = fixed.replace(/\.?0+$/, "");

  const [whole, fraction] = trimmed.split(".");

  const withCommas = whole.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ","
  );

  return fraction
    ? `${withCommas}.${fraction}`
    : withCommas;
}

function withSymbol(value, symbol) {
  const raw = String(value ?? "–").trim();

  if (!raw || raw === "–") {
    return "–";
  }

  const safeSymbol = String(symbol || "").trim();

  if (
    safeSymbol &&
    raw.toLowerCase().includes(safeSymbol.toLowerCase())
  ) {
    return raw;
  }

  return `${raw} ${safeSymbol}`.trim();
}

function diffAmount(
  leftValue,
  rightValue,
  symbol,
  options = {}
) {
  const left = parseDisplayAmount(leftValue);
  const right = parseDisplayAmount(rightValue);

  if (left === null || right === null) {
    return withSymbol("0", symbol);
  }

  const dp = Math.max(
    decimalsFrom(leftValue),
    decimalsFrom(rightValue),
    0
  );

  const rawDiff = left - right;

  const diff = options.absolute
    ? Math.abs(rawDiff)
    : rawDiff;

  const cleaned = cleanNumber(
    diff,
    Math.max(dp, 2)
  );

  return withSymbol(cleaned, symbol);
}

function lockedPendingAmount(row) {
  return diffAmount(
    row.actual,
    row.usable,
    row.symbol
  );
}

function syncGapAmount(row) {
  return diffAmount(
    row.usable,
    row.tracked,
    row.symbol
  );
}

/* =========================================================
   TOKEN PRESENTATION
========================================================= */

function TokenIcon({ row, isLp = false }) {
  const symbol = getTokenSymbolFromRow(row, isLp);
  const name = getTokenNameFromRow(row, symbol, isLp);
  const logo = getTokenLogo(row, isLp);

  return (
    <div
      className={cx(
        m("tokenIconWrap"),
        isLp ? m("lpTokenIconWrap") : ""
      )}
      style={TOKEN_IMAGE_WRAPPER_STYLE}
    >
      <img
        className={m("tokenIconImg")}
        src={logo}
        alt={`${name} token`}
        title={`${name} (${symbol})`}
        loading="lazy"
        decoding="async"
        style={TOKEN_IMAGE_STYLE}
        onError={(event) => {
          /*
            Prevent an endless error loop if the fallback image
            itself cannot be loaded.
          */
          event.currentTarget.onerror = null;
          event.currentTarget.src = logoUNKNOWN;
        }}
      />
    </div>
  );
}

function TokenIdentity({ row, isLp = false }) {
  const symbol = getTokenSymbolFromRow(row, isLp);
  const name = getTokenNameFromRow(row, symbol, isLp);

  return (
    <div className={m("tokenIdentity")}>
      <TokenIcon row={row} isLp={isLp} />

      <div className={m("tokenText")}>
        <div
          className={m("tokenName")}
          title={name}
        >
          {name}
        </div>

        <div className={m("tokenSymbol")}>
          {symbol}
        </div>
      </div>
    </div>
  );
}

function AddressPill({ value }) {
  return (
    <span className={m("addressPill")}>
      {value || "–"}
    </span>
  );
}

function AmountCell({
  value,
  symbol,
  hint,
  strong = false,
}) {
  return (
    <div className={m("amountCell")}>
      <span
        className={cx(
          m("amountText"),
          strong ? m("amountStrong") : ""
        )}
      >
        {withSymbol(value, symbol)}
      </span>

      {hint ? (
        <div className={m("cellHint")}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function TreasuryVault() {
  const {
    CONFIG,
    userAddress,
    globalStatus,
    holdingsRows,
    lpRows,
    holdingsStatus,
    lpStatus,
    refreshVault,
  } = useTreasuryData();

  return (
    <div className={m("jr-body")}>
      <div className={m("app-shell")}>
        <div className={m("bg-glow")} />
        <div className={m("bg-stamp")} />
        <div className={m("bg-pattern")} />

        <section className={m("section")}>
          <div className={m("section-header")}>
            <div>
              <div className={m("section-title")}>
                Vault
              </div>

              <div className={m("section-subtitle")}>
                Holding tokens and protocol-owned LP holdings
              </div>
            </div>

            <span className={m("badge-teal")}>
              Tracked holdings update via{" "}
              <code>syncHoldings()</code>
            </span>
          </div>

          <div className={m("vaultColumns")}>
            {/* =================================================
                HOLDING TOKENS
            ================================================= */}

            <div
              className={cx(
                m("panel"),
                m("vaultFrame"),
                m("holdingsFrame")
              )}
            >
              <div className={m("panel-title")}>
                <div className={m("panelTitleLeft")}>
                  <div className={m("sectionIconBadge")}>
                    <span>💎</span>
                  </div>

                  <div>
                    <h3>Holding Tokens</h3>

                    <p className={m("panelSubtext")}>
                      Actual wallet balance, sync gap, and
                      available holding-token liquidity.
                    </p>
                  </div>
                </div>

                <div className={m("vaultActions")}>
                  <button
                    type="button"
                    className={cx(
                      m("btn"),
                      m("btn-teal")
                    )}
                    onClick={refreshVault}
                  >
                    Refresh
                  </button>

                  <button
                    type="button"
                    className={cx(
                      m("btn"),
                      m("btn-green")
                    )}
                    disabled
                  >
                    Sync Holdings
                  </button>
                </div>
              </div>

              <div className={m("table-wrapper")}>
                <table
                  className={cx(
                    m("table"),
                    m("holdingsTable")
                  )}
                >
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Wallet Balance</th>
                      <th>Locked / Pending</th>
                      <th>Sync Gap</th>
                      <th>Last Synced</th>
                      <th>Available</th>
                    </tr>
                  </thead>

                  <tbody>
                    {!holdingsRows.length ? (
                      <tr>
                        <td
                          colSpan="6"
                          className={m("muted")}
                        >
                          Connect + configure addresses to load
                          Treasury holding tokens.
                        </td>
                      </tr>
                    ) : (
                      holdingsRows.map((row, index) => {
                        const symbol =
                          getTokenSymbolFromRow(row);

                        const lockedPending =
                          row.lockedPending ||
                          row.locked ||
                          lockedPendingAmount(row);

                        const syncGap =
                          row.syncGap ||
                          syncGapAmount(row);

                        return (
                          <tr
                            key={
                              row.addr ||
                              row.address ||
                              `${symbol}-${index}`
                            }
                          >
                            <td>
                              <TokenIdentity row={row} />

                              <div
                                className={m(
                                  "tokenContractLine"
                                )}
                              >
                                <span>Contract</span>

                                <AddressPill
                                  value={
                                    row.addrShort ||
                                    shortAddress(
                                      row.addr ||
                                        row.address
                                    ) ||
                                    "PLS (native)"
                                  }
                                />
                              </div>
                            </td>

                            <td>
                              <AmountCell
                                value={row.actual}
                                symbol={symbol}
                                hint="Live token balance in Treasury"
                              />
                            </td>

                            <td>
                              <AmountCell
                                value={lockedPending}
                                symbol={symbol}
                                hint="Pending swap or protected pDAI amount"
                              />
                            </td>

                            <td>
                              <AmountCell
                                value={syncGap}
                                symbol={symbol}
                                hint="Available minus last synced"
                                strong
                              />
                            </td>

                            <td>
                              <AmountCell
                                value={row.tracked}
                                symbol={symbol}
                                hint="trackedHoldings[token]"
                              />
                            </td>

                            <td>
                              <AmountCell
                                value={row.usable}
                                symbol={symbol}
                                hint="getUsableHoldingBalance(token)"
                                strong
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className={m("vaultStatus")}>
                {holdingsStatus}
              </div>
            </div>

            {/* =================================================
                LP TOKENS
            ================================================= */}

            <div
              className={cx(
                m("panel"),
                m("vaultFrame"),
                m("lpFrame")
              )}
            >
              <div className={m("panel-title")}>
                <div className={m("panelTitleLeft")}>
                  <div
                    className={cx(
                      m("sectionIconBadge"),
                      m("lpIconBadge")
                    )}
                  >
                    <span>🌱</span>
                  </div>

                  <div>
                    <h3>LP Tokens</h3>

                    <p className={m("panelSubtext")}>
                      Protocol-owned liquidity positions listed
                      and held by Treasury.
                    </p>
                  </div>
                </div>
              </div>

              <div className={m("table-wrapper")}>
                <table
                  className={cx(
                    m("table"),
                    m("lpTable")
                  )}
                >
                  <thead>
                    <tr>
                      <th>LP Position</th>
                      <th>LP Contract</th>
                      <th>Treasury LP Balance</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {!lpRows.length ? (
                      <tr>
                        <td
                          colSpan="4"
                          className={m("muted")}
                        >
                          Will show JackTreasury.getLpTokens() +
                          LP token balanceOf(Treasury).
                        </td>
                      </tr>
                    ) : (
                      lpRows.map((row, index) => {
                        const symbol =
                          getTokenSymbolFromRow(row, true);

                        return (
                          <tr
                            key={
                              row.addr ||
                              row.address ||
                              `${symbol}-${index}`
                            }
                          >
                            <td>
                              <TokenIdentity
                                row={row}
                                isLp
                              />
                            </td>

                            <td>
                              <AddressPill
                                value={
                                  row.addrShort ||
                                  shortAddress(
                                    row.addr ||
                                      row.address
                                  )
                                }
                              />
                            </td>

                            <td>
                              <AmountCell
                                value={row.bal}
                                symbol={symbol}
                                hint="LP token balance held by Treasury"
                                strong
                              />
                            </td>

                            <td>
                              <span
                                className={m("statusPill")}
                              >
                                Listed LP
                              </span>

                              <div
                                className={m("cellHint")}
                              >
                                Protocol-owned
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className={m("vaultHint")}>
                LP tokens do not use holding-token sync
                accounting in the current Treasury contract.
                They are listed with{" "}
                <b>getLpTokens()</b> and displayed using the
                Treasury LP token balance.
              </div>

              <div className={m("vaultStatus")}>
                {lpStatus}
              </div>
            </div>
          </div>

          {/* ===================================================
              COLUMN EXPLANATIONS
          =================================================== */}

          <div className={m("noteGrid")}>
            <div className={m("noteCard")}>
              <b>Wallet Balance</b>

              <span>
                The real live token amount currently inside the
                Treasury wallet.
              </span>
            </div>

            <div className={m("noteCard")}>
              <b>Locked / Pending</b>

              <span>
                Amount unavailable as a normal holding token
                because of a pending swap or protected pDAI.
              </span>
            </div>

            <div className={m("noteCard")}>
              <b>Sync Gap</b>

              <span>
                The difference between the current available
                balance and the last synced accounting amount.
              </span>
            </div>

            <div className={m("noteCard")}>
              <b>Available</b>

              <span>
                The amount returned by
                getUsableHoldingBalance(token), which Treasury
                can use as a holding token.
              </span>
            </div>
          </div>
        </section>

        <div
          className={m("status-bar")}
          style={{ marginTop: 10 }}
        >
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
              <b>
                {userAddress
                  ? shortAddress(userAddress)
                  : "Not connected"}
              </b>
            </span>

            <span className={m("muted")}>
              Network:{" "}
              <b>{CONFIG.NETWORK_LABEL}</b>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}