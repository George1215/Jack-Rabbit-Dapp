// src/components/FloatingTabs.js
import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import styles from "../styles/FloatingTabs.module.css";

export default function FloatingTabs() {
  const { pathname } = useLocation();

  const isStakeArea =
    pathname === "/stake" ||
    pathname.startsWith("/stake/") ||
    pathname === "/jackies" ||
    pathname.startsWith("/jackies/") ||
    pathname === "/diamond" ||
    pathname.startsWith("/diamond/");

  // 1) Jack Stake floating tabs
  if (isStakeArea) {
    const stakeTabs = [
      {
        to: "/stake",
        label: "External Stakers",
      },
      {
        to: "/jackies",
        label: "Jack Stakers",
      },
    ];

    const activeIndex = pathname.startsWith("/jackies") ? 1 : 0;

    return (
      <div className={`${styles.treasuryStrip} ${styles.stakeStrip}`}>
        <div
          className={`${styles.treasuryTabsRow} ${styles.stakeTabsRow}`}
          style={{
            "--tab-count": stakeTabs.length,
            "--indicator-index": activeIndex,
          }}
        >
          {stakeTabs.map((tab, index) => (
            <Link
              key={tab.to}
              to={tab.to}
              className={[
                styles.treasuryTab,
                index === activeIndex ? styles.treasuryTabActive : "",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          ))}

          <span className={styles.tabIndicator} />
        </div>
      </div>
    );
  }

  // 2) Mining page
  if (pathname.startsWith("/mining")) {
    const miningTabs = [
      { to: "/mining", label: "Mining Hub", end: true },
      { to: "/mining/claims", label: "Week Claims" },
    ];

    const activeIndex = miningTabs.findIndex((tab) => {
      if (tab.end) return pathname === tab.to;
      return pathname.startsWith(tab.to);
    });

    return (
      <div className={`${styles.treasuryStrip} ${styles.miningStrip}`}>
        <div
          className={styles.treasuryTabsRow}
          style={{
            "--tab-count": miningTabs.length,
            "--indicator-index": Math.max(activeIndex, 0),
          }}
        >
          {miningTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                [
                  styles.treasuryTab,
                  isActive ? styles.treasuryTabActive : "",
                ].join(" ")
              }
            >
              {tab.label}
            </NavLink>
          ))}

          <span className={styles.tabIndicator} />
        </div>
      </div>
    );
  }

  // 3) NFT page
  // Mint must go to /nfts
  // Bonds must go to /nfts/bonds
  if (pathname === "/nfts" || pathname.startsWith("/nfts/")) {
    const isBondsTab =
      pathname === "/nfts/bonds" || pathname.startsWith("/nfts/bonds/");

    const isMintTab = !isBondsTab;

    return (
      <div className={`${styles.treasuryStrip} ${styles.nftStrip}`}>
        <div className={styles.nftTitleTabsRow}>
          <Link
            to="/nfts"
            className={[
              styles.nftTitleTab,
              isMintTab ? styles.nftTitleTabActive : "",
            ].join(" ")}
          >
            Mint
          </Link>

          <Link
            to="/nfts/bonds"
            className={[
              styles.nftTitleTab,
              isBondsTab ? styles.nftTitleTabActive : "",
            ].join(" ")}
          >
            Bonds
          </Link>
        </div>
      </div>
    );
  }

  // 4) Treasury page
  if (pathname.startsWith("/treasury")) {
    const treasuryTabs = [
      { to: "/treasury", label: "Overview", end: true },
      { to: "/treasury/burn", label: "Burn Engine" },
      { to: "/treasury/vault", label: "Vault" },
      { to: "/treasury/activity", label: "Activity" },
    ];

    const activeIndex = treasuryTabs.findIndex((tab) => {
      if (tab.end) return pathname === tab.to;
      return pathname.startsWith(tab.to);
    });

    return (
      <div className={`${styles.treasuryStrip} ${styles.treasuryPageStrip}`}>
        <div
          className={styles.treasuryTabsRow}
          style={{
            "--tab-count": treasuryTabs.length,
            "--indicator-index": Math.max(activeIndex, 0),
          }}
        >
          {treasuryTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                [
                  styles.treasuryTab,
                  isActive ? styles.treasuryTabActive : "",
                ].join(" ")
              }
            >
              {tab.label}
            </NavLink>
          ))}

          <span className={styles.tabIndicator} />
        </div>
      </div>
    );
  }

  return null;
}