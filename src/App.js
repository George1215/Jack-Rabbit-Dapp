// src/App.js
import React, { useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import Landing from "./pages/LandingExperience";
import { UiProvider, PreviewNotice } from "./ui/UiContext";
import SiteHeader, { SectionTabs } from "./ui/SiteHeader";
import SiteFooter from "./ui/SiteFooter";
import { PreviewPortfolioProvider } from "./ui/PreviewPortfolio";
import StakingFrame from "./ui/StakingFrame";
import Mining from "./pages/Mining";
import WeekClaims from "./pages/ClaimsExperience";
import Staking from "./pages/Staking";
import Jackies from "./pages/Jackies";
import Farms from "./pages/FarmsExperience";

import Treasury from "./pages/TreasuryExperience";




import NFTBonds from "./pages/BondMintExperience";
import Bonds from "./pages/BondPositionsExperience";



import "./App.css";
import "./ui/Experience.css";

const OriginalStory = React.lazy(() => import("./pages/Landing"));
const SwapPage = React.lazy(() => import("./pages/Landing").then(m => ({default: m.BuyJackSwapSection})));

function AnimatedRoutes() {
  const location = useLocation();
  useEffect(() => {
    const names = {stake:"External Staking",jackies:"JACK Staking",farms:"Farms",mining:"Mining",nfts:"Bond NFTs",treasury:"Treasury",swap:"Swap",story:"Illustrated Story"};
    document.title = `${names[location.pathname.split("/")[1]] || "Explore the Burrow"} · Jack Rabbit`;
  }, [location.pathname]);

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
    <div id="main-content" tabIndex={-1} className={`page-transition-shell ${transitionStage} jr-route jr-route-${displayLocation.pathname.split("/")[1] || "home"}`}>
      <React.Suspense fallback={<div className="jr-empty" role="status">Opening the burrow…</div>}>
      <Routes location={displayLocation}>
        {/* LANDING */}
        <Route path="/" element={<Landing />} />
        <Route path="/story" element={<OriginalStory />} />
        <Route path="/swap" element={<div className="jr-existing-swap"><SwapPage /></div>} />

        {/* JACK STAKE AREA */}
        <Route path="/stake/*" element={<StakingFrame><Staking /></StakingFrame>} />
        <Route path="/jackies" element={<StakingFrame><Jackies /></StakingFrame>} />
        <Route path="/jackies/*" element={<StakingFrame><Jackies /></StakingFrame>} />

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
        <Route path="/treasury/burn" element={<Treasury view="burn" />} />
        <Route path="/treasury/burn-engine" element={<Navigate to="/treasury/burn" replace />} />
        <Route path="/treasury/vault" element={<Treasury view="vault" />} />
        <Route path="/treasury/activity" element={<Treasury view="activity" />} />

        {/* WRONG TREASURY CHILD ROUTES */}
        <Route path="/treasury/*" element={<Navigate to="/treasury" replace />} />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </React.Suspense>
    </div>
  );
}

export default function App() {
  return (
    <UiProvider>
    <PreviewPortfolioProvider>
    <BrowserRouter>
      <SiteHeader />
      <PreviewNotice />
      <SectionTabs />
      <AnimatedRoutes />
      <SiteFooter />
    </BrowserRouter>
    </PreviewPortfolioProvider>
    </UiProvider>
  );
}
