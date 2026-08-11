// src/App.js
import React, { useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import Landing from "./pages/Landing";
import Mining from "./pages/Mining";
import WeekClaims from "./pages/WeekClaims";
import Staking from "./pages/Staking";
import Jackies from "./pages/Jackies";
import Farms from "./pages/farms";

import Treasury from "./pages/Treasury";
import TreasuryBurnEngine from "./pages/TreasuryBurnEngine";
import TreasuryVault from "./pages/TreasuryVault";
import TreasuryActivity from "./pages/TreasuryActivity";

import NFTBonds from "./pages/NFTBonds";
import Bonds from "./pages/Bond";

import Navbar from "./components/Navbar";
import FloatingTabs from "./components/FloatingTabs";

import "./App.css";

function AnimatedRoutes() {
  const location = useLocation();

  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState("fadeIn");

  const timeoutRef = useRef(null);

  useEffect(() => {
    const sameRoute =
      location.pathname === displayLocation.pathname &&
      location.search === displayLocation.search &&
      location.hash === displayLocation.hash;

    if (sameRoute) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setTransitionStage("fadeOut");

    timeoutRef.current = setTimeout(() => {
      setDisplayLocation(location);

      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });

      setTransitionStage("fadeIn");
    }, 260);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [location, displayLocation]);

  return (
    <div className={`page-transition-shell ${transitionStage}`}>
      <Routes location={displayLocation}>
        {/* LANDING */}
        <Route path="/" element={<Landing />} />

        {/* JACK STAKE AREA */}
        <Route path="/stake/*" element={<Staking />} />
        <Route path="/jackies" element={<Jackies />} />
        <Route path="/jackies/*" element={<Jackies />} />

        {/* OLD /DIAMOND PATH SUPPORT */}
        <Route path="/diamond" element={<Navigate to="/stake" replace />} />
        <Route path="/diamond/*" element={<Navigate to="/stake" replace />} />

        {/* FARMS */}
        <Route path="/farms" element={<Farms />} />
        <Route path="/farms/*" element={<Farms />} />

        {/* OLD FARM ALIAS SUPPORT */}
        <Route path="/farm" element={<Navigate to="/farms" replace />} />
        <Route path="/farm/*" element={<Navigate to="/farms" replace />} />

        {/* MINING */}
        <Route path="/mining" element={<Mining />} />
        <Route path="/mining/claims" element={<WeekClaims />} />

        {/* NFT MINT PAGE */}
        <Route path="/nfts" element={<NFTBonds />} />
        <Route path="/nfts/mint" element={<NFTBonds />} />

        {/* NFT BOND POSITIONS PAGE */}
        <Route path="/nfts/bond" element={<Bonds />} />
        <Route path="/nfts/bonds" element={<Bonds />} />

        {/* OLD NFT ROUTE SUPPORT */}
        <Route path="/nft-bonds" element={<Navigate to="/nfts" replace />} />
        <Route path="/nft-bonds/mint" element={<Navigate to="/nfts" replace />} />
        <Route path="/nft-bonds/bond" element={<Navigate to="/nfts/bonds" replace />} />
        <Route path="/nft-bonds/bonds" element={<Navigate to="/nfts/bonds" replace />} />

        {/* EXTRA NFT ALIASES */}
        <Route path="/nft" element={<Navigate to="/nfts" replace />} />
        <Route path="/nft/mint" element={<Navigate to="/nfts" replace />} />
        <Route path="/nft/bond" element={<Navigate to="/nfts/bonds" replace />} />
        <Route path="/nft/bonds" element={<Navigate to="/nfts/bonds" replace />} />

        {/* WRONG NFT CHILD ROUTES */}
        <Route path="/nfts/*" element={<Navigate to="/nfts" replace />} />

        {/* TREASURY PAGES */}
        <Route path="/treasury" element={<Treasury />} />
        <Route path="/treasury/overview" element={<Navigate to="/treasury" replace />} />
        <Route path="/treasury/burn" element={<TreasuryBurnEngine />} />
        <Route path="/treasury/burn-engine" element={<Navigate to="/treasury/burn" replace />} />
        <Route path="/treasury/vault" element={<TreasuryVault />} />
        <Route path="/treasury/activity" element={<TreasuryActivity />} />

        {/* WRONG TREASURY CHILD ROUTES */}
        <Route path="/treasury/*" element={<Navigate to="/treasury" replace />} />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Navbar priceUsd={0.0001} />

      <FloatingTabs />

      <AnimatedRoutes />
    </BrowserRouter>
  );
}