// src/components/Navbar.js
import React, { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import styles from "../styles/Navbar.module.css";

import jackLogo from "../assets/jacklogo.png";
import logoName from "../assets/logoname.png";

import stakeTabIcon from "../assets/stake-tab.png";
import miningTabIcon from "../assets/mining-tab.png";
import treasuryTabIcon from "../assets/treasury-tab.png";

import WalletButton from "./WalletButton";
import pawIcon from "../assets/paw.png";

export default function Navbar({ priceUsd }) {
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const Item = ({ to, label, icon, emoji }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [styles.navItem, isActive ? styles.active : ""].join(" ")
      }
    >
      {icon ? (
        <img src={icon} alt="" className={styles.navIcon} />
      ) : (
        <span className={styles.navEmojiIcon} aria-hidden="true">
          {emoji}
        </span>
      )}

      <span>{label}</span>
    </NavLink>
  );

  const price =
    typeof priceUsd === "number"
      ? `$${priceUsd.toFixed(4)}`
      : priceUsd || "$0.0000";

  // Hide the main app navbar on landing page only
  if (pathname === "/") return null;

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}>
      <div className={styles.topBar}>
        <div className={styles.left}>
          <NavLink
            to="/stake"
            className={styles.brand}
            aria-label="Jack Rabbit Home"
          >
            <img src={jackLogo} className={styles.logo} alt="Jack Rabbit logo" />
            <img src={logoName} className={styles.logoName} alt="Jack Rabbit" />
          </NavLink>

          <nav className={styles.nav}>
            <Item to="/stake" label="Stake" icon={stakeTabIcon} />
            <Item to="/farms" label="Farms" emoji="🌱" />
            <Item to="/mining" label="Mining" icon={miningTabIcon} />
            <Item to="/nfts" label="BondNFT's" icon={pawIcon} />
            <Item to="/treasury" label="Treasury" icon={treasuryTabIcon} />
          </nav>
        </div>

        <div className={styles.right}>
          <span className={styles.price}>{price}</span>
          <WalletButton className={styles.walletBtn} />
        </div>
      </div>
    </header>
  );
}