// src/pages/TreasuryActivity.js

import React, { useMemo, useState } from "react";

import styles from "../styles/TreasuryActivity.module.css";

import useTreasuryData, { shortAddress } from "../hooks/useTreasuryData";
import treasuryBackground from "../assets/jack-treasury-background.png";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function m(cls) {
  return styles[cls] || cls;
}

const TREASURY_BACKGROUND_IMAGE = treasuryBackground;

/*
  Removed:
  - Protocols
  - JACK Token
  - Admin
  as requested from screenshot 1
*/
const ACTIVITY_FILTERS = [
  { id: "all", label: "All Activity" },
  { id: "income", label: "Incoming" },
  { id: "outflow", label: "Outgoing" },
  { id: "swap", label: "Swaps" },
  { id: "loan", label: "Loans" },
  { id: "vault", label: "Vault" },
];

/*
  This map guarantees that the same event always uses the same icon,
  label, category, and visual treatment.
*/
const EVENT_META = {
  /* Treasury token intake and swap events */
  ReceiveTokenAdded: {
    icon: "➕",
    label: "Receive Token Added",
    category: "admin",
    tone: "admin",
  },
  ReceiveTokenRemoved: {
    icon: "➖",
    label: "Receive Token Removed",
    category: "admin",
    tone: "admin",
  },
  PendingSwapStored: {
    icon: "⏳",
    label: "Pending Swap Stored",
    category: "swap",
    tone: "swap",
    direction: "in",
  },
  ReceiveTokenSentToProtocol: {
    icon: "📤",
    label: "Receive Token Sent",
    category: "protocol",
    tone: "outflow",
    direction: "out",
  },
  ReceiveTokenRequestSkipped: {
    icon: "⏸️",
    label: "Receive Token Request Skipped",
    category: "protocol",
    tone: "warning",
  },
  SwapPathSet: {
    icon: "🛣️",
    label: "Swap Path Updated",
    category: "swap",
    tone: "swap",
  },
  TokenSwapped: {
    icon: "🔄",
    label: "Token Swapped To JACK",
    category: "swap",
    tone: "swap",
  },

  /* pDAI activity */
  PdaiSet: {
    icon: "⚙️",
    label: "pDAI Address Updated",
    category: "admin",
    tone: "admin",
  },
  PdaiIncomeReceived: {
    icon: "💵",
    label: "pDAI Income Received",
    category: "income",
    tone: "pdai",
    direction: "in",
  },
  PdaiReserveDeposited: {
    icon: "🏦",
    label: "pDAI Reserve Deposited",
    category: "income",
    tone: "pdai",
    direction: "in",
  },
  PdaiReserveSent: {
    icon: "📤",
    label: "pDAI Reserve Sent",
    category: "outflow",
    tone: "outflow",
    direction: "out",
  },
  PdaiIncomeRecorded: {
    icon: "📊",
    label: "pDAI Income Recorded",
    category: "income",
    tone: "pdai",
    direction: "in",
  },
  PdaiReserveDepositRecorded: {
    icon: "🧾",
    label: "pDAI Reserve Recorded",
    category: "income",
    tone: "pdai",
    direction: "in",
  },
  PdaiPegReturnRecorded: {
    icon: "↩️",
    label: "pDAI Peg Return Recorded",
    category: "income",
    tone: "pdai",
    direction: "in",
  },

  /* JACK activity */
  JackIncomeRecorded: {
    icon: "🪙",
    label: "JACK Income Recorded",
    category: "income",
    tone: "income",
    direction: "in",
  },
  PushedFeeRecorded: {
    icon: "🥕",
    label: "Treasury Fee Recorded",
    category: "income",
    tone: "income",
    direction: "in",
  },
  JackReserveDeposited: {
    icon: "🏦",
    label: "JACK Reserve Deposited",
    category: "income",
    tone: "income",
    direction: "in",
  },
  JackPegReturnRecorded: {
    icon: "↩️",
    label: "JACK Peg Return Recorded",
    category: "income",
    tone: "income",
    direction: "in",
  },
  PegReturnReceived: {
    icon: "↩️",
    label: "Peg Return Received",
    category: "income",
    tone: "income",
    direction: "in",
  },
  PushedFeeReclassifiedAsPegReturn: {
    icon: "🔁",
    label: "Fee Reclassified As Peg Return",
    category: "income",
    tone: "income",
  },

  /* Holding-token activity */
  HoldingTokenAdded: {
    icon: "💎",
    label: "Holding Token Added",
    category: "vault",
    tone: "vault",
  },
  HoldingTokenRemoved: {
    icon: "🗑️",
    label: "Holding Token Removed",
    category: "vault",
    tone: "warning",
  },
  HoldingTokenDeposited: {
    icon: "📥",
    label: "Holding Token Deposited",
    category: "vault",
    tone: "vault",
    direction: "in",
  },
  HoldingsSynced: {
    icon: "🔃",
    label: "Holdings Synchronized",
    category: "vault",
    tone: "vault",
  },
  HoldingSentToProtocol: {
    icon: "📤",
    label: "Holding Sent To Protocol",
    category: "protocol",
    tone: "outflow",
    direction: "out",
  },

  /* LP activity */
  LpTokenAdded: {
    icon: "🌱",
    label: "LP Token Added",
    category: "vault",
    tone: "lp",
  },
  LpTokenRemoved: {
    icon: "✂️",
    label: "LP Token Removed",
    category: "vault",
    tone: "warning",
  },
  LpTokenDeposited: {
    icon: "📥",
    label: "LP Token Deposited",
    category: "vault",
    tone: "lp",
    direction: "in",
  },
  LpSentToProtocol: {
    icon: "📤",
    label: "LP Sent To Protocol",
    category: "protocol",
    tone: "outflow",
    direction: "out",
  },
  LpRequestSkipped: {
    icon: "⏸️",
    label: "LP Request Skipped",
    category: "protocol",
    tone: "warning",
  },

  /* Treasury JACK request and loan activity */
  JackRequestSkipped: {
    icon: "⏸️",
    label: "JACK Request Skipped",
    category: "protocol",
    tone: "warning",
  },
  JackRequestPartial: {
    icon: "📦",
    label: "Partial JACK Delivery",
    category: "protocol",
    tone: "protocol",
    direction: "out",
  },
  LoanRepaid: {
    icon: "♻️",
    label: "Treasury Loan Repaid",
    category: "loan",
    tone: "loan",
  },

  /* Protocol permissions */
  ProtocolAuthorized: {
    icon: "✅",
    label: "Protocol Authorized",
    category: "protocol",
    tone: "protocol",
  },
  ProtocolRevoked: {
    icon: "🚫",
    label: "Protocol Revoked",
    category: "protocol",
    tone: "warning",
  },

  /* JACK token events */
  Burn: {
    icon: "🔥",
    label: "JACK Burned",
    category: "token",
    tone: "burn",
  },
  FeeOverrideActivated: {
    icon: "⚙️",
    label: "Fee Override Activated",
    category: "token",
    tone: "token",
  },
  FeeOverrideExpired: {
    icon: "⌛",
    label: "Fee Override Expired",
    category: "token",
    tone: "token",
  },
  TreasuryUpdated: {
    icon: "🏛️",
    label: "Token Treasury Updated",
    category: "token",
    tone: "token",
  },
  DynamicFeeConfigUpdated: {
    icon: "📈",
    label: "Dynamic Fee Configuration Updated",
    category: "token",
    tone: "token",
  },

  /* Administration */
  OwnershipTransferred: {
    icon: "👑",
    label: "Ownership Transferred",
    category: "admin",
    tone: "admin",
  },
  Paused: {
    icon: "⏸️",
    label: "Treasury Paused",
    category: "admin",
    tone: "warning",
  },
  Unpaused: {
    icon: "▶️",
    label: "Treasury Unpaused",
    category: "admin",
    tone: "admin",
  },
};

function humanizeEventName(value) {
  const clean = String(value || "UnknownEvent")
    .replace(/\(.*$/, "")
    .replace(/_/g, " ")
    .trim();

  return clean.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function normalizeEventName(value) {
  return String(value || "UnknownEvent")
    .replace(/\(.*$/, "")
    .trim();
}

function inferEventMeta(row) {
  const eventName = normalizeEventName(row?.ev);

  if (EVENT_META[eventName]) {
    return EVENT_META[eventName];
  }

  const lower = eventName.toLowerCase();

  if (
    lower.includes("sent") ||
    lower.includes("withdraw") ||
    lower.includes("outflow")
  ) {
    return {
      icon: "📤",
      label: humanizeEventName(eventName),
      category: "outflow",
      tone: "outflow",
      direction: "out",
    };
  }

  if (
    lower.includes("income") ||
    lower.includes("received") ||
    lower.includes("deposit")
  ) {
    return {
      icon: "📥",
      label: humanizeEventName(eventName),
      category: "income",
      tone: "income",
      direction: "in",
    };
  }

  if (lower.includes("swap")) {
    return {
      icon: "🔄",
      label: humanizeEventName(eventName),
      category: "swap",
      tone: "swap",
    };
  }

  if (lower.includes("loan")) {
    return {
      icon: "🤝",
      label: humanizeEventName(eventName),
      category: "loan",
      tone: "loan",
    };
  }

  if (lower.includes("protocol") || lower.includes("request")) {
    return {
      icon: "🤝",
      label: humanizeEventName(eventName),
      category: "protocol",
      tone: "protocol",
    };
  }

  if (
    lower.includes("holding") ||
    lower.includes("sync") ||
    lower.includes("lp")
  ) {
    return {
      icon: "🏦",
      label: humanizeEventName(eventName),
      category: "vault",
      tone: "vault",
    };
  }

  if (
    lower.includes("burn") ||
    lower.includes("fee") ||
    lower.includes("mint")
  ) {
    return {
      icon: "🔥",
      label: humanizeEventName(eventName),
      category: "token",
      tone: "token",
    };
  }

  return {
    icon: "📜",
    label: humanizeEventName(eventName),
    category: "admin",
    tone: "neutral",
  };
}

function formatBlockNumber(value) {
  const block = Number(value);

  if (!Number.isFinite(block)) {
    return value || "–";
  }

  return block.toLocaleString();
}

function getContractTone(contractName) {
  const lower = String(contractName || "").toLowerCase();

  if (lower.includes("jacktoken") || lower.includes("jack token")) {
    return "jack";
  }

  if (lower.includes("farm")) {
    return "farm";
  }

  if (lower.includes("stake")) {
    return "stake";
  }

  if (lower.includes("mining") || lower.includes("miner")) {
    return "mining";
  }

  if (lower.includes("barrow")) {
    return "barrow";
  }

  return "treasury";
}

function EventIcon({ meta }) {
  return (
    <div className={cx(m("eventIcon"), m(`tone-${meta.tone}`))}>
      <span>{meta.icon}</span>
    </div>
  );
}

function ContractPill({ name }) {
  const tone = getContractTone(name);

  return (
    <span className={cx(m("contractPill"), m(`contract-${tone}`))}>
      {name || "Treasury"}
    </span>
  );
}

export default function TreasuryActivity() {
  const {
    CONFIG,
    userAddress,
    globalStatus,
    eventsRows,
    eventsStatus,
    loadEvents,
    readProvider,
    configReady,
  } = useTreasuryData();

  const [activeFilter, setActiveFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

  const normalizedRows = useMemo(() => {
    return (eventsRows || []).map((row, index) => {
      const meta = inferEventMeta(row);

      return {
        ...row,
        meta,
        rowKey: `${row.block || "block"}-${row.ev || "event"}-${index}`,
      };
    });
  }, [eventsRows]);

  const filteredRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return normalizedRows.filter((row) => {
      const filterMatches =
        activeFilter === "all" || row.meta.category === activeFilter;

      if (!filterMatches) return false;
      if (!query) return true;

      const searchable = [
        row.meta.label,
        row.meta.category,
        row.c,
        row.ev,
        row.d,
        row.block,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [activeFilter, normalizedRows, searchText]);

  const activitySummary = useMemo(() => {
    return normalizedRows.reduce(
      (summary, row) => {
        summary.total += 1;

        if (row.meta.direction === "in") {
          summary.incoming += 1;
        }

        if (row.meta.direction === "out") {
          summary.outgoing += 1;
        }

        if (row.meta.category === "protocol") {
          summary.protocol += 1;
        }

        return summary;
      },
      {
        total: 0,
        incoming: 0,
        outgoing: 0,
        protocol: 0,
      }
    );
  }, [normalizedRows]);

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
          <div className={m("section-header")}>
            <div>
              <div className={m("section-title")}>Activity</div>
              <div className={m("section-subtitle")}>
                Treasury, JACK token, and protocol interaction history
              </div>
            </div>

            <span className={m("badge-orange")}>
              Last {CONFIG.EVENT_LOOKBACK_BLOCKS || 2000} blocks
            </span>
          </div>

          <div className={cx(m("panel"), m("activityFrame"))}>
            <div className={m("panel-title")}>
              <div className={m("panelTitleLeft")}>
                <div className={m("sectionIconBadge")}>
                  <span>📜</span>
                </div>

                <div>
                  <h3>Treasury Activity Ledger</h3>
                  <p className={m("panelSubtext")}>
                    Incoming assets, outgoing requests, swaps, loans, vault
                    updates, and protocol actions.
                  </p>
                </div>
              </div>

              <button
                className={cx(m("btn"), m("btn-teal"))}
                onClick={loadEvents}
                disabled={!readProvider || !configReady}
              >
                Load Events
              </button>
            </div>

            <div className={m("activitySummaryGrid")}>
              <div className={m("activitySummaryCard")}>
                <div className={m("activitySummaryInner")}>
                  <div className={cx(m("summaryIcon"), m("summaryAll"))}>
                    <span>📜</span>
                  </div>

                  <div>
                    <div className={m("summaryLabel")}>Events Loaded</div>
                    <div className={m("summaryValue")}>
                      {activitySummary.total}
                    </div>
                  </div>
                </div>
              </div>

              <div className={m("activitySummaryCard")}>
                <div className={m("activitySummaryInner")}>
                  <div className={cx(m("summaryIcon"), m("summaryIncoming"))}>
                    <span>📥</span>
                  </div>

                  <div>
                    <div className={m("summaryLabel")}>Incoming</div>
                    <div className={m("summaryValue")}>
                      {activitySummary.incoming}
                    </div>
                  </div>
                </div>
              </div>

              <div className={m("activitySummaryCard")}>
                <div className={m("activitySummaryInner")}>
                  <div className={cx(m("summaryIcon"), m("summaryOutgoing"))}>
                    <span>📤</span>
                  </div>

                  <div>
                    <div className={m("summaryLabel")}>Outgoing</div>
                    <div className={m("summaryValue")}>
                      {activitySummary.outgoing}
                    </div>
                  </div>
                </div>
              </div>

              <div className={m("activitySummaryCard")}>
                <div className={m("activitySummaryInner")}>
                  <div className={cx(m("summaryIcon"), m("summaryProtocol"))}>
                    <span>🤝</span>
                  </div>

                  <div>
                    <div className={m("summaryLabel")}>Protocol Actions</div>
                    <div className={m("summaryValue")}>
                      {activitySummary.protocol}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={m("activityToolbar")}>
              <div className={m("filterList")}>
                {ACTIVITY_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    className={cx(
                      m("filterButton"),
                      activeFilter === filter.id
                        ? m("filterButtonActive")
                        : ""
                    )}
                    onClick={() => setActiveFilter(filter.id)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <input
                className={m("activitySearch")}
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search event, contract, block..."
                aria-label="Search Treasury activity"
              />
            </div>

            <div className={m("tableLuxuryFrame")}>
              <div className={m("table-wrapper")}>
                <table className={m("table")}>
                  <thead>
                    <tr>
                      <th>Activity</th>
                      <th>Source Contract</th>
                      <th>Event Details</th>
                      <th>Block</th>
                    </tr>
                  </thead>

                  <tbody>
                    {!filteredRows.length ? (
                      <tr>
                        <td colSpan="4">
                          <div className={m("emptyState")}>
                            <div className={m("emptyStateIcon")}>📭</div>

                            <div>
                              <b>No activity found</b>
                              <span>
                                Load events or change the selected activity
                                filter.
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => (
                        <tr key={row.rowKey}>
                          <td>
                            <div className={m("eventIdentity")}>
                              <EventIcon meta={row.meta} />

                              <div className={m("eventText")}>
                                <div className={m("eventName")}>
                                  {row.meta.label}
                                </div>

                                <span
                                  className={cx(
                                    m("categoryPill"),
                                    m(`category-${row.meta.category}`)
                                  )}
                                >
                                  {row.meta.category}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <ContractPill name={row.c} />
                          </td>

                          <td>
                            <div className={m("detailsText")}>
                              {row.d || "No additional event details."}
                            </div>
                          </td>

                          <td>
                            <span className={m("blockPill")}>
                              #{formatBlockNumber(row.block)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={m("activityCoverageNote")}>
              <span className={m("coverageIcon")}>ℹ️</span>

              <span>
                This ledger displays emitted contract events. Direct calls that
                emit no event cannot be reconstructed from blockchain logs.
              </span>
            </div>

            <div className={m("activityStatus")}>{eventsStatus}</div>
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