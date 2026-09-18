// src/pages/Landing.js
import React, { useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import styles from "../styles/Landing.module.css";
import { switchOrAddPulseNetwork } from "../components/WalletButton";

import jacklogo from "../assets/jacklogo.png";
import slogan from "../assets/catchme.png";
import mascot from "../assets/jacklaughing.gif";
import jackCitySkyline from "../assets/jack-city-skyline.png";
import fancyJack from "../assets/fancyJack.png";
import jackTwoLevelBg from "../assets/jack-two-level-bg.png";

// Legend comic scene assets
import scene1 from "../assets/scene1.gif";
import scene2 from "../assets/scene2.png";
import scene3a from "../assets/scene3a.gif";
import scene3b from "../assets/scene3b.gif";
import scene4 from "../assets/scene4.png";
import scene5 from "../assets/scene5.png";
import scene6 from "../assets/scene6.png";
import scene6b from "../assets/scene6b.png";
import scene6c from "../assets/scene6c.png";
import scene7 from "../assets/scene7.png";
import scene8 from "../assets/scene8.png";

// How Jack Runs assets
import jackriding from "../assets/Jackriding.png";
import howJackRunsTitle from "../assets/howjackruns.png";

// Jack falling assets
import jackMint from "../assets/jackfall-mint.png";
import jackStake from "../assets/jackfall-stake.png";
import jackBurn from "../assets/jackfall-burn.png";
import jackReward from "../assets/jackfall-reward.png";
import jackMoon from "../assets/jackfall-moon.png";
import jackUmbrella from "../assets/jack-umbrella.png";

// Meme strip
import memeStrip1 from "../assets/meme-strip-1.png";
import memeStrip2 from "../assets/meme-strip-2.png";
import memeStrip3 from "../assets/meme-strip-3.png";
import memeStrip4 from "../assets/meme-strip-4.png";
import memeStrip5 from "../assets/meme-strip-5.png";

// How Jack Runs card cover images
import jackCardDapp from "../assets/jack-card-dapp.png";
import jackCardFees from "../assets/jack-card-fees.png";
import jackCardMission from "../assets/jack-card-mission.png";
import jackCardMine from "../assets/jack-card-mine.png";
import jackCardTreasury from "../assets/jack-card-treasury.png";
import jackCardPdai from "../assets/jack-card-pdai.png";

// Mission token icons
import logoPLS from "../assets/pls.svg";
import logoPLSX from "../assets/plsx.svg";
import logoHEX from "../assets/hex.svg";
import logoINC from "../assets/inc.svg";
import logoATROPA from "../assets/atropa.svg";
import logoPDAI from "../assets/pdai.svg";
import logoTEDDY from "../assets/teddy.png";

//Footer
import clouds1 from "../assets/clouds1.png";




const MANIFESTO_PAGE_ONE_TEXT = `JACK is a protocol that turns ecosystem participation into protocol value. It is built to work as a pDAI peg engine, a value accumulator, and a community-powered system driven by real DApp activity.

Every interaction inside the ecosystem helps create movement. That activity collects value, pushes it back into the protocol, and strengthens the system instead of letting value leak away. The more the DApps are used, the more JACK has a reason to grow. JACK is designed to be a long-term home for the community, a place where believers can find purpose and rewards for their participation, and where the ecosystem can thrive together.`;

const MANIFESTO_PAGE_TWO_TEXT = `On one side, JACK accumulates and generates value. On the other, it supports pDAI and gives more purpose to the mission tokens connected to the ecosystem by encouraging holders to stay active, participate, and earn.

At its heart, JACK is also a salute to the ones who did not fold — the believers who stayed, held the line, and kept the mission alive. Jack token is a reward that spirit and to create a sustainable, community-driven ecosystem where everyone has a reason to stay and contribute.;`;

const JACK_RUN_CARDS = [
  {
    id: "dapp-activity",
    number: "01",
    tag: "Start",
    title: "DApp Activity",
    subtitle: "Use the ecosystem",
    insideTag: "Start",
    insideTitle: "DApp Activity",
    body:
      "Users burn, transfer, stake, mine, bond, and interact across the JACK ecosystem.",
    note:
      "Activity is the starting point. Every action gives the value loop something real to feed on.",
    backTitle: "JACK Action",
    backText: "Activity starts the engine.",
    image: jackCardDapp,
  },
  {
    id: "fees-burns",
    number: "02",
    tag: "Flow",
    title: "Fees & Burns",
    subtitle: "Every move feeds value",
    insideTag: "Burn",
    insideTitle: "Fees & Burns",
    body:
      "Transfers create fees, burns reduce pressure, and every move adds energy to the system.",
    note:
      "Movement creates fee flow, burn pressure, and protocol energy instead of staying idle.",
    backTitle: "Fee Flow",
    backText: "Burns and transfers create motion.",
    image: jackCardFees,
  },
  {
    id: "mission-tokens",
    number: "03",
    tag: "Stake",
    title: "Mission Tokens",
    subtitle: "Stake and participate",
    insideTag: "Stake",
    insideTitle: "Stake Mission Tokens",
    body:
      "Holders stake related ecosystem tokens, stay active, and earn while strengthening mission alignment.",
    note:
      "Staking gives connected tokens more purpose and gives holders a reason to participate.",
    backTitle: "Mission Tokens",
    backText: "Participation gives tokens purpose.",
    image: jackCardMission,
  },
  {
    id: "mine-jack",
    number: "04",
    tag: "Mine",
    title: "Mine JACK",
    subtitle: "Earn through activity",
    insideTag: "Mine",
    insideTitle: "Mine JACK",
    body:
      "Mining turns ecosystem participation into JACK rewards and pulls more community activity into the loop.",
    note:
      "Mining makes participation feel alive while giving users another way to earn JACK.",
    backTitle: "Mining",
    backText: "Activity turns into JACK rewards.",
    image: jackCardMine,
  },
  {
    id: "treasury",
    number: "05",
    tag: "Vault",
    title: "Treasury",
    subtitle: "Accounting brain",
    insideTag: "Vault",
    insideTitle: "Treasury Accounting",
    body:
      "The Treasury tracks reserves, holdings, and incoming value, forming the accounting brain of the protocol.",
    note:
      "The Treasury tracks value, accounts for reserves, and coordinates how the loop grows.",
    backTitle: "Treasury",
    backText: "Value is tracked and coordinated.",
    image: jackCardTreasury,
  },
  {
    id: "pdai-support",
    number: "06",
    tag: "pDAI",
    title: "pDAI Support",
    subtitle: "The bigger mission",
    insideTag: "pDAI",
    insideTitle: "JACK → pDAI Support",
    body:
      "As value accumulates and JACK strengthens, the protocol gains more ability to support pDAI over time.",
    note:
      "Activity builds value, value strengthens JACK, and stronger JACK improves future pDAI support.",
    backTitle: "Peg Mission",
    backText: "Stronger JACK helps pDAI.",
    image: jackCardPdai,
  },
];

const SKY_CLOUDS = [
  { size: "large", style: "skyCloud1" },
  { size: "normal", style: "skyCloud2" },
  { size: "small", style: "skyCloud3" },
  { size: "tiny", style: "skyCloud4" },
  { size: "large", style: "skyCloud5" },
  { size: "normal", style: "skyCloud6" },
  { size: "small", style: "skyCloud7" },
  { size: "tiny", style: "skyCloud8" },
  { size: "small", style: "skyCloud9" },
  { size: "normal", style: "skyCloud10" },
  { size: "tiny", style: "skyCloud11" },
  { size: "small", style: "skyCloud12" },
];

const MEME_STRIP_IMAGES = [
  memeStrip1,
  memeStrip2,
  memeStrip3,
  memeStrip4,
  memeStrip5,
];

const LEGEND_STATIC_IMAGE_MS = 2 * 60 * 1000; // 2 minutes for PNG/JPG/WEBP images

const LEGEND_COMIC_PANELS = [
  {
    id: "scene1",
    clipId: "scene1Clip",
    points: "0,0 410,0 560,560 0,690",
    x: 0,
    y: 0,
    width: 560,
    height: 690,

    imageWidth: 100,
    zoom: 0.9,
    panX: 15,
    panY: 180,
    rotate: 0,
    frameBg: "#e8edf2",

    images: [scene1],
  },
  {
    id: "scene2",
    clipId: "scene2Clip",
    points: "411,0 1010,0 880,520 559,554",
    x: 411,
    y: 0,
    width: 599,
    height: 554,

    imageWidth: 100,
    zoom: 0.83,
    panX: 0,
    panY: 50,
    rotate: -3,
    frameBg: "#e8edf2",

    images: [scene2],
  },
  {
    id: "scene3",
    clipId: "scene3Clip",
    points: "1011,8 1440,0 1440,690 879,518",
    x: 879,
    y: 0,
    width: 561,
    height: 690,

    imageWidth: 100,
    zoom: 1.3,
    panX: 0,
    panY: 20,
    rotate: 13,
    frameBg: "#e8edf2",
    // GIF fallback only if duration reading fails
    frameDurationMs: 2 * 60 * 1000,

    images: [scene3a, scene3b],
  },
  {
    id: "scene4",
    clipId: "scene4Clip",
    points: "0,695 560,560 560,940 0,1080",
    x: 0,
    y: 560,
    width: 560,
    height: 520,

    imageWidth: 100,
    zoom: 1,
    panX: 30,
    panY: 1,
    rotate: -9,
    frameBg: "#e8edf2",

    images: [scene4],
  },
  {
    id: "scene5",
    clipId: "scene5Clip",
    points: "659,543 880,520 1031,565 1025,945 821,949 560,940 560,560",
    x: 560,
    y: 520,
    width: 471,
    height: 429,

    imageWidth: 100,
    zoom: 1.6,
    panX: 0,
    panY: 0,
    rotate: 0,
    frameBg: "#e8edf2",

    images: [scene5],
  },
  {
    id: "scene6",
    clipId: "scene6Clip",
    points: "1035,565 1440,690 1440,986 1027,950",
    x: 1027,
    y: 565,
    width: 413,
    height: 421,

    imageWidth: 100,
    zoom: 1,
    panX: 0,
    panY: 0,
    rotate: 0,
    frameBg: "#e8edf2",

    // PNG/static image timing
frameDurationMs: 2 * 60 * 1000,

    images: [scene6, scene6b, scene6c],
  },
  {
    id: "scene7",
    clipId: "scene7Clip",
    points: "0,1085 560,940 562,1320 350,1320 0,1320",
    x: 0,
    y: 940,
    width: 562,
    height: 380,

    imageWidth: 100,
    zoom: 0.51,
    panX: 30,
    panY: 1,
    rotate: -18,
    frameBg: "#e8edf2",

    images: [scene7],
  },
  {
    id: "scene8",
    clipId: "scene8Clip",
    points: "561,941 808,948 1026,944 1026,1320 565,1320",
    x: 561,
    y: 941,
    width: 465,
    height: 379,

    imageWidth: 100,
    zoom: 1,
    panX: 0,
    panY: 0,
    rotate: 0,
    frameBg: "#e8edf2",

    images: [scene8],
  },
  {
    id: "scene9",
    clipId: "scene9Clip",
    points: "1029,947 1440,988 1440,1320 1025,1320",
    x: 1025,
    y: 947,
    width: 415,
    height: 373,

    imageWidth: 100,
    zoom: 1,
    panX: 0,
    panY: 0,
    rotate: 0,
    frameBg: "#e8edf2",

    images: [scene8],
  }
];

const ROADMAP = [
  {
    phase: "Phase 01",
    status: "Complete",
    date: "Jun 01, 2026",
    title: "Rabbit Awakening",
    icon: "🥕",
    accent: "#52b927",
    tilt: "-2.4deg",
    body:
      "Jack Rabbit is born. The brand, first community story, token identity, and early holder energy are introduced to the market.",
    steps: ["Community launch", "Token identity", "First holders", "Social channels"],
  },
  {
    phase: "Phase 02",
    status: "Current",
    date: "Jun 15, 2026",
    title: "Staking & Farms",
    icon: "🌾",
    accent: "#ff8b13",
    tilt: "1.8deg",
    body:
      "The ecosystem becomes useful. Holders can stake, farm, track rewards, and interact with a cleaner Jack Rabbit DApp experience.",
    steps: ["Stake JACK", "LP farms", "Reward panels", "Better UI"],
  },
  {
    phase: "Phase 03",
    status: "Building",
    date: "Jul 01, 2026",
    title: "Buy Burn Engine",
    icon: "🔥",
    accent: "#db234e",
    tilt: "-1.5deg",
    body:
      "Protocol systems begin supporting long-term value through fees, treasury flow, and automated buy-and-burn behavior.",
    steps: ["Treasury flow", "Buy pressure", "Burn mechanics", "Reward routing"],
  },
  {
    phase: "Phase 04",
    status: "Next",
    date: "Jul 20, 2026",
    title: "NFT Bond Chapter",
    icon: "🎟️",
    accent: "#8c55ff",
    tilt: "2.2deg",
    body:
      "Jack Rabbit adds a collectible layer where bonds, positions, and playful NFT-style cards become part of the user journey.",
    steps: ["Bond NFTs", "Position cards", "Claim visuals", "Premium design"],
  },
  {
    phase: "Phase 05",
    status: "Future",
    date: "Aug 10, 2026",
    title: "Rabbit Universe",
    icon: "🚀",
    accent: "#13a7ff",
    tilt: "-2deg",
    body:
      "The project expands beyond one page into a bigger Jack Rabbit universe with deeper tools, community features, and more ecosystem utility.",
    steps: ["More tools", "Community growth", "New pages", "Universe expansion"],
  },
  {
    phase: "Phase 06",
    status: "Dream File",
    date: "Sep 01, 2026",
    title: "Moon Mission",
    icon: "🌕",
    accent: "#ffd044",
    tilt: "1.4deg",
    body:
      "The long-term mission is to make Jack Rabbit feel fun, trusted, and alive while the ecosystem keeps improving step by step.",
    steps: ["Brand trust", "Fun utility", "More liquidity", "Bigger reach"],
  },
];

/* ============================================================
   LEGEND COMIC SMART FRAME TIMING
   - GIFs wait until the GIF finishes one full play.
   - PNG/JPG/WEBP/static images wait for LEGEND_STATIC_IMAGE_MS.
   ============================================================ */

const gifDurationCache = new Map();

function isLegendGif(src) {
  return typeof src === "string" && /\.gif(\?|#|$)/i.test(src);
}

function readLegendGifDurationMs(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);

  const isGif =
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38;

  if (!isGif) return null;

  let position = 13;

  const packedField = bytes[10];
  const hasGlobalColorTable = (packedField & 0x80) !== 0;

  if (hasGlobalColorTable) {
    const globalColorTableSize = 3 * Math.pow(2, (packedField & 0x07) + 1);
    position += globalColorTableSize;
  }

  let totalDurationMs = 0;
  let pendingDelayMs = 0;
  let frameCount = 0;

  while (position < bytes.length) {
    const blockId = bytes[position++];

    // GIF trailer / end
    if (blockId === 0x3b) break;

    // Extension block
    if (blockId === 0x21) {
      const label = bytes[position++];

      // Graphics Control Extension: frame delay lives here
      if (label === 0xf9) {
        const blockSize = bytes[position++];

        if (blockSize === 4) {
          position += 1; // packed field

          const delayHundredths = bytes[position] + (bytes[position + 1] << 8);
          position += 2;

          position += 1; // transparent color index
          position += 1; // block terminator

          // GIF delay is in hundredths of a second.
          // Some GIFs wrongly report 0, so use a small safe minimum.
          pendingDelayMs = Math.max(delayHundredths * 10, 80);
        } else {
          position += blockSize;
        }
      } else {
        // Skip other extension blocks
        while (position < bytes.length) {
          const subBlockSize = bytes[position++];
          if (subBlockSize === 0) break;
          position += subBlockSize;
        }
      }

      continue;
    }

    // Image descriptor block
    if (blockId === 0x2c) {
      frameCount += 1;
      totalDurationMs += pendingDelayMs || 100;
      pendingDelayMs = 0;

      const imagePackedField = bytes[position + 8];
      position += 9;

      const hasLocalColorTable = (imagePackedField & 0x80) !== 0;

      if (hasLocalColorTable) {
        const localColorTableSize =
          3 * Math.pow(2, (imagePackedField & 0x07) + 1);

        position += localColorTableSize;
      }

      position += 1; // LZW minimum code size

      // Skip image data sub-blocks
      while (position < bytes.length) {
        const subBlockSize = bytes[position++];
        if (subBlockSize === 0) break;
        position += subBlockSize;
      }

      continue;
    }

    break;
  }

  if (!frameCount || !totalDurationMs) return null;

  return totalDurationMs;
}

async function getLegendGifDurationMs(src) {
  if (gifDurationCache.has(src)) {
    return gifDurationCache.get(src);
  }

  const durationPromise = fetch(src)
    .then((response) => response.arrayBuffer())
    .then((arrayBuffer) => readLegendGifDurationMs(arrayBuffer))
    .catch(() => null);

  gifDurationCache.set(src, durationPromise);

  return durationPromise;
}

async function getLegendFrameDurationMs(src, fallbackMs) {
  const fallbackDuration = fallbackMs ?? LEGEND_STATIC_IMAGE_MS;

  if (isLegendGif(src)) {
    const gifDuration = await getLegendGifDurationMs(src);
    return gifDuration || fallbackDuration;
  }

  return fallbackDuration;
}

/* ============================================================
   Buy JACK swap config
   ============================================================ */

const JACK_TOKEN_ADDRESS = "0xE004a1987fB0CAFAD49aA5180cbBb50c92e8C031";
const PULSEX_ROUTER_ADDRESS = "0x165C3410fC91EF562C50559f7d2289fEbed552d9";
const WPLS_ADDRESS = "0xA1077a294dDE1B09bB078844df40758a5D0f9a27";

const ZERO_BIGINT = ethers.toBigInt(0);
const SLIPPAGE_BPS = ethers.toBigInt(2500); // 25%
const SLIPPAGE_PERCENT = 25;
const BPS_DIVISOR = ethers.toBigInt(10000);

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const PULSEX_ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
  "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable",
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
];

const BUY_MISSION_TOKENS = [
  {
    key: "pls",
    symbol: "PLS",
    name: "Pulse",
    iconSrc: logoPLS,
    isNative: true,
    address: ethers.ZeroAddress,
    copyAddress: WPLS_ADDRESS,
    decimals: 18,
    path: [WPLS_ADDRESS, JACK_TOKEN_ADDRESS],
  },
  {
    key: "pdai",
    symbol: "pDAI",
    name: "Pulse DAI",
    iconSrc: logoPDAI,
    isNative: false,
    address: "PASTE_PDAI_ADDRESS_HERE",
    decimals: 18,
    path: ["PASTE_PDAI_ADDRESS_HERE", WPLS_ADDRESS, JACK_TOKEN_ADDRESS],
  },
  {
    key: "plsx",
    symbol: "PLSX",
    name: "PulseX",
    iconSrc: logoPLSX,
    isNative: false,
    address: "PASTE_PLSX_ADDRESS_HERE",
    decimals: 18,
    path: ["PASTE_PLSX_ADDRESS_HERE", WPLS_ADDRESS, JACK_TOKEN_ADDRESS],
  },
  {
    key: "hex",
    symbol: "HEX",
    name: "HEX",
    iconSrc: logoHEX,
    isNative: false,
    address: "PASTE_HEX_ADDRESS_HERE",
    decimals: 8,
    path: ["PASTE_HEX_ADDRESS_HERE", WPLS_ADDRESS, JACK_TOKEN_ADDRESS],
  },
  {
    key: "inc",
    symbol: "INC",
    name: "Incentive",
    iconSrc: logoINC,
    isNative: false,
    address: "PASTE_INC_ADDRESS_HERE",
    decimals: 18,
    path: ["PASTE_INC_ADDRESS_HERE", WPLS_ADDRESS, JACK_TOKEN_ADDRESS],
  },
  {
    key: "atropa",
    symbol: "ATROPA",
    name: "Atropa",
    iconSrc: logoATROPA,
    isNative: false,
    address: "PASTE_ATROPA_ADDRESS_HERE",
    decimals: 18,
    path: ["PASTE_ATROPA_ADDRESS_HERE", WPLS_ADDRESS, JACK_TOKEN_ADDRESS],
  },
  {
    key: "teddy",
    symbol: "TEDDY",
    name: "Teddy",
    iconSrc: logoTEDDY,
    isNative: false,
    address: "PASTE_TEDDY_ADDRESS_HERE",
    decimals: 18,
    path: ["PASTE_TEDDY_ADDRESS_HERE", WPLS_ADDRESS, JACK_TOKEN_ADDRESS],
  },
];

const JACK_OUTPUT_TOKEN = {
  key: "jack",
  symbol: "JACK",
  name: "Jack Rabbit",
  iconSrc: jacklogo,
  address: JACK_TOKEN_ADDRESS,
};

function formatBuyNumber(value, maxDigits = 4) {
  const numberValue = Number(value || 0);

  if (!Number.isFinite(numberValue)) {
    return "0";
  }

  return numberValue.toLocaleString(undefined, {
    maximumFractionDigits: maxDigits,
  });
}

function isRealAddress(address) {
  return typeof address === "string" && ethers.isAddress(address);
}

function isConfiguredToken(token) {
  if (token.isNative) {
    return token.path.every(isRealAddress);
  }

  return isRealAddress(token.address) && token.path.every(isRealAddress);
}

function getTokenCopyAddress(token) {
  return token?.copyAddress || token?.address || "";
}

async function getPulseProvider() {
  if (!window.ethereum) {
    throw new Error("Please install MetaMask or another Web3 wallet.");
  }

  return new ethers.BrowserProvider(window.ethereum);
}

function renderTokenIcon(token, className) {
  if (token?.iconSrc) {
    return <img src={token.iconSrc} alt={token.symbol} className={className} />;
  }

  return <span>{token?.icon || "•"}</span>;
}

export function BuyJackSwapSection() {
  const [selectedSymbol, setSelectedSymbol] = useState("pDAI");
  const [payAmount, setPayAmount] = useState("1");
  const [tokenMenuOpen, setTokenMenuOpen] = useState(false);
  const [tokenSearch, setTokenSearch] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [copiedAddressKey, setCopiedAddressKey] = useState(null);

  const [account, setAccount] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [balances, setBalances] = useState({});
  const [quoteRaw, setQuoteRaw] = useState(null);
  const [quoteFormatted, setQuoteFormatted] = useState("0");

  const tokenPickerRef = useRef(null);

  const selectedToken =
    BUY_MISSION_TOKENS.find((token) => token.symbol === selectedSymbol) ||
    BUY_MISSION_TOKENS[0];

  const amountNumber = Math.max(Number(payAmount || 0), 0);
  const currentBalance = balances[selectedToken.symbol] || "0";

  const routerConfigured = isRealAddress(PULSEX_ROUTER_ADDRESS);
  const selectedConfigured = isConfiguredToken(selectedToken);

  const amountOutMinRaw =
    quoteRaw && quoteRaw > ZERO_BIGINT
      ? (quoteRaw * (BPS_DIVISOR - SLIPPAGE_BPS)) / BPS_DIVISOR
      : ZERO_BIGINT;

  const amountOutMinFormatted =
    amountOutMinRaw > ZERO_BIGINT
      ? ethers.formatUnits(amountOutMinRaw, 18)
      : "0";

  const rateDisplay =
    amountNumber > 0
      ? formatBuyNumber(Number(quoteFormatted || 0) / amountNumber, 6)
      : "0";

  const plainRateText = `1 ${selectedToken.symbol} ≈ ${rateDisplay} JACK`;

  const filteredMissionTokens = BUY_MISSION_TOKENS.filter((token) => {
    const searchValue = tokenSearch.trim().toLowerCase();

    if (!searchValue) return true;

    const copyAddress = getTokenCopyAddress(token).toLowerCase();

    return (
      token.symbol.toLowerCase().includes(searchValue) ||
      token.name.toLowerCase().includes(searchValue) ||
      copyAddress.includes(searchValue)
    );
  });

  const canSwap =
    account &&
    routerConfigured &&
    selectedConfigured &&
    amountNumber > 0 &&
    quoteRaw &&
    quoteRaw > ZERO_BIGINT &&
    !swapping;

  const connectWallet = async () => {
    try {
      setConnecting(true);
      setStatusMessage("Connecting wallet...");

      await switchOrAddPulseNetwork();

      const provider = await getPulseProvider();
      const accounts = await provider.send("eth_requestAccounts", []);

      setAccount(accounts?.[0] || "");
      setStatusMessage("Wallet connected.");
    } catch (error) {
      console.error(error);
      setStatusMessage(error?.message || "Wallet connection failed.");
    } finally {
      setConnecting(false);
    }
  };

  const openTokenOverlay = () => {
    setTokenSearch("");
    setTokenMenuOpen(true);
  };

  const closeTokenOverlay = () => {
    setTokenSearch("");
    setTokenMenuOpen(false);
  };

  const selectToken = (symbol) => {
    setSelectedSymbol(symbol);
    setTokenMenuOpen(false);
    setTokenSearch("");
    setQuoteRaw(null);
    setQuoteFormatted("0");
    setStatusMessage("");
  };

  const copyTokenAddress = async (token) => {
    const addressToCopy = getTokenCopyAddress(token);

    if (!isRealAddress(addressToCopy)) {
      setStatusMessage(`${token.symbol} contract address is not configured yet.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(addressToCopy);
      setCopiedAddressKey(token.key);
      setStatusMessage(`${token.symbol} contract copied.`);

      setTimeout(() => {
        setCopiedAddressKey(null);
      }, 1300);
    } catch (error) {
      console.error(error);
      setStatusMessage("Could not copy contract address.");
    }
  };

  const loadBalances = async () => {
    if (!account) return;

    try {
      const provider = await getPulseProvider();
      const nextBalances = {};

      for (const token of BUY_MISSION_TOKENS) {
        if (!isConfiguredToken(token)) {
          nextBalances[token.symbol] = "0";
          continue;
        }

        if (token.isNative) {
          const rawBalance = await provider.getBalance(account);
          nextBalances[token.symbol] = ethers.formatUnits(
            rawBalance,
            token.decimals
          );
        } else {
          const tokenContract = new ethers.Contract(
            token.address,
            ERC20_ABI,
            provider
          );

          const rawBalance = await tokenContract.balanceOf(account);
          nextBalances[token.symbol] = ethers.formatUnits(
            rawBalance,
            token.decimals
          );
        }
      }

      setBalances(nextBalances);
    } catch (error) {
      console.error(error);
      setStatusMessage("Could not load wallet balances.");
    }
  };

  const loadQuote = async () => {
    setQuoteRaw(null);
    setQuoteFormatted("0");

    if (
      !account ||
      !routerConfigured ||
      !selectedConfigured ||
      amountNumber <= 0
    ) {
      return;
    }

    try {
      setQuoting(true);

      const provider = await getPulseProvider();
      const router = new ethers.Contract(
        PULSEX_ROUTER_ADDRESS,
        PULSEX_ROUTER_ABI,
        provider
      );

      const amountInRaw = ethers.parseUnits(
        payAmount || "0",
        selectedToken.decimals
      );

      const amountsOut = await router.getAmountsOut(
        amountInRaw,
        selectedToken.path
      );

      const outputRaw = amountsOut[amountsOut.length - 1];

      setQuoteRaw(outputRaw);
      setQuoteFormatted(ethers.formatUnits(outputRaw, 18));
      setStatusMessage("");
    } catch (error) {
      console.error(error);
      setStatusMessage(
        "No live route found yet. Check the token address, router, or liquidity path."
      );
    } finally {
      setQuoting(false);
    }
  };

  const approveIfNeeded = async (signer, amountInRaw) => {
    if (selectedToken.isNative) return;

    const tokenContract = new ethers.Contract(
      selectedToken.address,
      ERC20_ABI,
      signer
    );

    const allowance = await tokenContract.allowance(
      account,
      PULSEX_ROUTER_ADDRESS
    );

    if (allowance >= amountInRaw) return;

    setStatusMessage(`Approving ${selectedToken.symbol}...`);

    const approveTx = await tokenContract.approve(
      PULSEX_ROUTER_ADDRESS,
      amountInRaw
    );

    await approveTx.wait();
  };

  const useMaxBalance = () => {
    setPayAmount(currentBalance);
  };

  const swapMissionTokenForJack = async () => {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask or another Web3 wallet.");
        return;
      }

      if (!account) {
        await connectWallet();
        return;
      }

      if (!routerConfigured) {
        alert("PulseX router address is not configured yet.");
        return;
      }

      if (!selectedConfigured) {
        alert(`${selectedToken.symbol} address/path is not configured yet.`);
        return;
      }

      if (amountNumber <= 0) {
        alert("Enter an amount first.");
        return;
      }

      if (!quoteRaw || quoteRaw <= ZERO_BIGINT) {
        alert("No valid live quote found yet.");
        return;
      }

      setSwapping(true);
      setStatusMessage("Preparing swap...");

      await switchOrAddPulseNetwork();

      const provider = await getPulseProvider();
      const signer = await provider.getSigner();

      const amountInRaw = ethers.parseUnits(
        payAmount || "0",
        selectedToken.decimals
      );

      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

      const router = new ethers.Contract(
        PULSEX_ROUTER_ADDRESS,
        PULSEX_ROUTER_ABI,
        signer
      );

      let tx;

      if (selectedToken.isNative) {
        setStatusMessage("Swapping PLS for JACK...");

        tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
          amountOutMinRaw,
          selectedToken.path,
          account,
          deadline,
          {
            value: amountInRaw,
          }
        );
      } else {
        await approveIfNeeded(signer, amountInRaw);

        setStatusMessage(`Swapping ${selectedToken.symbol} for JACK...`);

        tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
          amountInRaw,
          amountOutMinRaw,
          selectedToken.path,
          account,
          deadline
        );
      }

      setStatusMessage("Waiting for transaction confirmation...");
      await tx.wait();

      setStatusMessage("Swap complete. JACK received!");
      await loadBalances();
      await loadQuote();
    } catch (error) {
      console.error(error);

      const message =
        error?.shortMessage ||
        error?.reason ||
        error?.message ||
        "Swap failed.";

      setStatusMessage(message);
    } finally {
      setSwapping(false);
    }
  };

  useEffect(() => {
    if (!tokenMenuOpen) return;

    const handleOutsideClick = (event) => {
      if (
        tokenPickerRef.current &&
        !tokenPickerRef.current.contains(event.target)
      ) {
        closeTokenOverlay();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [tokenMenuOpen]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      setAccount(accounts?.[0] || "");
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  useEffect(() => {
    loadBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadQuote();
    }, 450);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, selectedSymbol, payAmount]);

  return (
    <section className={styles.buyJackSection}>
      <div className={styles.buyJackLayout}>
        <div className={styles.buyJackIntro}>
          <div className={styles.buyJackSticker}>🥕 Mission Tokens Only</div>

          <h2 className={styles.buyJackTitle}>
            <span className={styles.buyJackTitleWhite}>Buy $JACK</span>
            <span className={styles.buyJackTitleGold}>The Fun</span>
            <span className={styles.buyJackTitleGold}>Way</span>
          </h2>

          <div className={styles.buyJackBuyGuide}>
            <div className={styles.buyJackGuideSteps}>
              <article className={styles.buyJackGuideStep}>
                <div className={styles.buyJackGuideNumber}>1</div>
                <div
                  className={`${styles.buyJackGuideIcon} ${styles.buyJackGuideWalletIcon}`}
                  aria-hidden="true"
                >
                  <span></span>
                </div>
                <h3>Connect Wallet</h3>
                <p>Connect your wallet to get started.</p>
              </article>

              <article className={styles.buyJackGuideStep}>
                <div className={styles.buyJackGuideNumber}>2</div>
                <div
                  className={`${styles.buyJackGuideIcon} ${styles.buyJackGuideTokenIcon}`}
                  aria-hidden="true"
                >
                  <span className={styles.buyJackGuideTokenRing}></span>
                  <img src={jacklogo} alt="" />
                </div>
                <h3>Choose Token</h3>
                <p>Select the mission token you want to swap from.</p>
              </article>

              <article className={styles.buyJackGuideStep}>
                <div className={styles.buyJackGuideNumber}>3</div>
                <div
                  className={`${styles.buyJackGuideIcon} ${styles.buyJackGuideCoinIcon}`}
                  aria-hidden="true"
                >
                  <img src={jacklogo} alt="" />
                </div>
                <h3>Swap for JACK</h3>
                <p>Swap your token for $JACK in seconds.</p>
              </article>

              <article className={styles.buyJackGuideStep}>
                <div className={styles.buyJackGuideNumber}>4</div>
                <div
                  className={`${styles.buyJackGuideIcon} ${styles.buyJackGuideRabbitIcon}`}
                  aria-hidden="true"
                >
                  <span className={styles.buyJackGuideEarLeft}></span>
                  <span className={styles.buyJackGuideEarRight}></span>
                  <span className={styles.buyJackGuideRabbitFace}>😎</span>
                </div>
                <h3>Confirm &amp; Hold</h3>
                <p>Confirm the swap and hold $JACK.</p>
              </article>
            </div>

            <div className={styles.buyJackKeyBurrowCard}>
              <div className={styles.buyJackKeyCoin}>
                <img src={jacklogo} alt="JACK" />
              </div>

              <div className={styles.buyJackKeyCopy}>
                <h3>$JACK is the key to the burrow.</h3>
                <p>
                  Hold, stake, and unlock premium utilities in the Jack Rabbit
                  ecosystem.
                </p>
              </div>

              <div className={styles.buyJackKeyMiniFeatures}>
                <div>
                  <span>👥</span>
                  <strong>Community</strong>
                  <small>Driven</small>
                </div>

                <div>
                  <span>⚡</span>
                  <strong>Meme</strong>
                  <small>Powered</small>
                </div>

                <div>
                  <span>💎</span>
                  <strong>Utility</strong>
                  <small>Focused</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.buyJackSwapShell}>
          <section
            className={`${styles.buyJackSwapCard} ${
              tokenMenuOpen ? styles.buyJackSwapCardMenuOpen : ""
            }`}
          >
            <div className={styles.buyJackOfficialStamp}>Official</div>

            <div className={styles.buyJackSwapTop}>
              <div>
                <div className={styles.buyJackSwapKicker}>Buy $JACK</div>
                <div className={styles.buyJackSwapSub}>
                  JACK says: swap responsibly
                </div>
              </div>

              <button
                type="button"
                className={styles.buyJackConnectBtn}
                data-transaction="connectWallet" onClick={connectWallet}
                disabled={connecting}
              >
                {account
                  ? `${account.slice(0, 4)}...${account.slice(-4)}`
                  : connecting
                  ? "Connecting"
                  : "Connect"}
              </button>
            </div>

            <div className={styles.buyJackFieldStack}>
              <div className={styles.buyJackShadowBand}></div>

              <div className={`${styles.buyJackField} ${styles.buyJackFieldPay}`}>
                <div className={styles.buyJackFieldLabel}>
                  <span>Pay</span>
                  <span>Mission Token</span>
                </div>

                <div className={styles.buyJackFieldRow}>
                  <input
                    className={styles.buyJackAmountInput}
                    type="number"
                    min="0"
                    step="0.01"
                    value={payAmount}
                    onChange={(event) => setPayAmount(event.target.value)}
                  />

                  <div className={styles.buyJackTokenSelect}>
                    <div className={styles.buyJackTokenControlRow}>
                      <button
                        type="button"
                        className={styles.buyJackTokenBtn}
                        onClick={openTokenOverlay}
                      >
                        <span className={styles.buyJackTokenLeft}>
                          <span className={styles.buyJackTokenIcon}>
                            {renderTokenIcon(
                              selectedToken,
                              styles.buyJackTokenIconImg
                            )}
                          </span>
                          <span>{selectedToken.symbol}</span>
                        </span>

                        <span className={styles.buyJackChevron}></span>
                      </button>

                      <button
                        type="button"
                        className={styles.buyJackCopyTokenBtn}
                        onClick={() => copyTokenAddress(selectedToken)}
                        title={`Copy ${selectedToken.symbol} contract`}
                        aria-label={`Copy ${selectedToken.symbol} contract`}
                      >
                        {copiedAddressKey === selectedToken.key ? "✓" : "⧉"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles.buyJackFieldBottom}>
                  <span>
                    {quoting
                      ? "Finding best rabbit route..."
                      : "Mission token input"}
                  </span>

                  <span>
                    Balance: {formatBuyNumber(currentBalance, 4)}
                    <button
                      type="button"
                      className={styles.buyJackMaxBtn}
                      onClick={useMaxBalance}
                    >
                      Max
                    </button>
                  </span>
                </div>
              </div>

              <div className={styles.buyJackSwapSwitch}>↕</div>

              <div
                className={`${styles.buyJackField} ${styles.buyJackFieldReceive}`}
              >
                <div className={styles.buyJackFieldLabel}>
                  <span>Receive</span>
                  <span>JACK</span>
                </div>

                <div className={styles.buyJackFieldRow}>
                  <input
                    className={styles.buyJackAmountInput}
                    type="text"
                    readOnly
                    value={formatBuyNumber(quoteFormatted, 4)}
                  />

                  <div className={styles.buyJackTokenControlRow}>
                    <div
                      className={`${styles.buyJackTokenBtn} ${styles.buyJackTokenStaticBtn}`}
                    >
                      <span className={styles.buyJackTokenLeft}>
                        <span className={styles.buyJackTokenIcon}>
                          {renderTokenIcon(
                            JACK_OUTPUT_TOKEN,
                            styles.buyJackTokenIconImg
                          )}
                        </span>
                        <span>{JACK_OUTPUT_TOKEN.symbol}</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      className={styles.buyJackCopyTokenBtn}
                      onClick={() => copyTokenAddress(JACK_OUTPUT_TOKEN)}
                      title="Copy JACK contract"
                      aria-label="Copy JACK contract"
                    >
                      {copiedAddressKey === JACK_OUTPUT_TOKEN.key ? "✓" : "⧉"}
                    </button>
                  </div>
                </div>

                <div className={styles.buyJackFieldBottom}>
                  <span>
                    You receive about {formatBuyNumber(quoteFormatted, 4)} JACK
                  </span>
                  <span>Live route quote</span>
                </div>
              </div>
            </div>

            <div className={styles.buyJackPlainQuoteRow}>
              <span className={styles.buyJackPlainRateText}>
                {plainRateText}
              </span>

              <button
                type="button"
                className={styles.buyJackPlainGasText}
                onClick={() => setDetailsOpen((value) => !value)}
              >
                <span>⛽</span>
                <span>Live</span>
                <span
                  className={`${styles.buyJackDetailsArrow} ${
                    !detailsOpen ? styles.buyJackDetailsArrowClosed : ""
                  }`}
                >
                  ⌄
                </span>
              </button>
            </div>

            {detailsOpen && (
              <div className={styles.buyJackQuoteDetails}>
                <div className={styles.buyJackDetailRow}>
                  <span>Expected Output</span>
                  <strong>{formatBuyNumber(quoteFormatted, 4)} JACK</strong>
                </div>

                <div className={styles.buyJackDetailRow}>
                  <span>Slippage</span>
                  <strong>{SLIPPAGE_PERCENT}%</strong>
                </div>

                <div className={styles.buyJackDetailRow}>
                  <span>Minimum JACK Received</span>
                  <strong>
                    {formatBuyNumber(amountOutMinFormatted, 4)} JACK
                  </strong>
                </div>

                <div className={styles.buyJackDetailRow}>
                  <span>Rabbit Route</span>
                  <strong>{selectedToken.symbol} → JACK</strong>
                </div>

                <div className={styles.buyJackDetailRow}>
                  <span>Allowed Token Type</span>
                  <strong>Mission Token</strong>
                </div>
              </div>
            )}

            {statusMessage && (
              <div className={styles.buyJackStatus}>{statusMessage}</div>
            )}

            <button
              type="button"
              className={styles.buyJackMainBtn}
              data-transaction="swapMissionTokenForJack" onClick={swapMissionTokenForJack}
              disabled={!canSwap}
            >
              {swapping
                ? "Swapping..."
                : account
                ? "Catch JACK"
                : "Connect First"}
            </button>

            <div className={styles.buyJackPowered}>
              Powered by Jack Rabbit Mission Tokens
            </div>

            <div className={styles.buyJackNotice}>
              🥕 Only JACK-approved mission tokens are shown here. No outside
              coins.
            </div>

            <div className={styles.buyJackContractNote}>
              JACK SAYS: COPY THE REAL CONTRACT • MISSION TOKENS ONLY
            </div>

            {tokenMenuOpen && (
              <div
                ref={tokenPickerRef}
                className={styles.buyJackFullTokenPicker}
              >
                <input
                  type="text"
                  value={tokenSearch}
                  onChange={(event) => setTokenSearch(event.target.value)}
                  className={styles.buyJackFullTokenSearch}
                  placeholder="Search name or paste address"
                  autoFocus
                />

                <div className={styles.buyJackFullTokenList}>
                  {filteredMissionTokens.map((token) => (
                    <button
                      key={token.key}
                      type="button"
                      className={`${styles.buyJackFullTokenItem} ${
                        selectedToken.key === token.key
                          ? styles.buyJackFullTokenItemActive
                          : ""
                      }`}
                      onClick={() => selectToken(token.symbol)}
                    >
                      <span className={styles.buyJackFullTokenLeft}>
                        <span className={styles.buyJackFullTokenIcon}>
                          {renderTokenIcon(
                            token,
                            styles.buyJackFullTokenIconImg
                          )}
                        </span>

                        <span className={styles.buyJackFullTokenMeta}>
                          <strong>{token.symbol}</strong>
                          <small>{token.name}</small>
                        </span>
                      </span>

                      <span className={styles.buyJackFullTokenBalance}>
                        {balances[token.symbol]
                          ? formatBuyNumber(balances[token.symbol], 4)
                          : "0"}
                      </span>
                    </button>
                  ))}

                  {filteredMissionTokens.length === 0 && (
                    <div className={styles.buyJackFullTokenEmpty}>
                      No mission token found.
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Trade Over section below swap panel / console
   ============================================================ */

function TradeOverSection() {
  return (
    <section className={styles.tradeOverSection}>
      <div className={styles.tradeOverCard}>
        <div className={styles.tradeOverMain}>
          <div className={styles.tradeOverImageArea}>
            <img
              src={fancyJack}
              alt="Jack Rabbit trade over"
              className={styles.tradeOverImage}
            />
          </div>

          <div className={styles.tradeOverContent}>
            <div className={styles.tradeScribble} aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>

            <h2 className={styles.tradeOverTitle}>
              <span>Trade Over</span>
              <strong>2,000</strong>
              <span>Cryptocurrencies</span>
            </h2>

            <p className={styles.tradeOverText}>
              The <b>JACK ecosystem</b> is driven by real use: people burn, transfer, 
              stake mission tokens, mine JACK, mint bond NFTs, and interact across 
              the DApps. These actions create activity, fees, and value. The Treasury 
              tracks and coordinates that flow, while JACK’s fee structure can self-adjust 
              based on Treasury strength.
            </p>
          </div>
        </div>

        <div className={styles.tradeFeatureBar}>
          <div className={styles.tradeFeature}>
            <div className={styles.tradeFeatureIcon}>
              <span></span>
            </div>

            <div className={styles.tradeFeatureCopy}>
              <h4>Top Coins</h4>
              <p>Bitcoin, Ethereum, and more.</p>
            </div>
          </div>

          <div className={styles.tradeFeatureDivider}></div>

          <div className={`${styles.tradeFeature} ${styles.tradeFeatureActive}`}>
            <div className={styles.tradeFeatureIcon}>
              <span></span>
            </div>

            <div className={styles.tradeFeatureCopy}>
              <h4>Trending Meme Coins</h4>
              <p>Be part of the buzz.</p>
            </div>
          </div>

          <div className={styles.tradeFeatureDivider}></div>

          <div className={styles.tradeFeature}>
            <div className={styles.tradeFeatureIcon}>
              <span></span>
            </div>

            <div className={styles.tradeFeatureCopy}>
              <h4>Exclusive DEX Listings</h4>
              <p>Trade coins before they hit mainstream.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RoadmapSection() {
  const boardRef = useRef(null);
  const pinboardRef = useRef(null);
  const stringsRef = useRef(null);
  const footerRef = useRef(null);
  const stampBigRef = useRef(null);
  const notesRef = useRef(null);
  const noteBodyRef = useRef(null);
  const controlsRef = useRef(null);

  useEffect(() => {
    const boardEl = boardRef.current;
    const pinboardEl = pinboardRef.current;
    const stringsEl = stringsRef.current;
    const footerEl = footerRef.current;
    const stampBigEl = stampBigRef.current;
    const notesEl = notesRef.current;
    const noteBodyEl = noteBodyRef.current;
    const controlsEl = controlsRef.current;

    if (
      !boardEl ||
      !pinboardEl ||
      !stringsEl ||
      !footerEl ||
      !stampBigEl ||
      !notesEl ||
      !noteBodyEl ||
      !controlsEl
    ) {
      return undefined;
    }

    const STATE = {
      filter: "all",
      strings: false,
      free: false,
      playing: true,
      activeIndex: 1,
    };

    const positions = {};
    let drag = null;
    let justDragged = false;
    let playTimer = null;

    const fmtDate = (iso) =>
      new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });

    const cutTitle = (text) =>
      text
        .split("")
        .map((ch) => (ch === " " ? " " : `<span class="cut">${ch}</span>`))
        .join("");

    function clearStrings() {
      stringsEl.classList.remove("show", "animate");
      stringsEl.innerHTML = "";
    }

    function cardCenter(card) {
      const cardRect = card.getBoundingClientRect();
      const boardRect = boardEl.getBoundingClientRect();

      return {
        x: cardRect.left - boardRect.left + cardRect.width / 2,
        y: cardRect.top - boardRect.top + 8,
      };
    }

    function drawStrings(animate = false) {
      stringsEl.innerHTML = "";

      const cards = Array.from(pinboardEl.querySelectorAll(".exhibit")).sort(
        (a, b) => Number(a.dataset.index) - Number(b.dataset.index)
      );

      for (let i = 0; i < cards.length - 1; i += 1) {
        const start = cardCenter(cards[i]);
        const end = cardCenter(cards[i + 1]);

        const line = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );

        line.setAttribute("x1", start.x);
        line.setAttribute("y1", start.y);
        line.setAttribute("x2", end.x);
        line.setAttribute("y2", end.y);

        stringsEl.appendChild(line);
      }

      stringsEl.setAttribute(
        "viewBox",
        `0 0 ${boardEl.clientWidth} ${boardEl.clientHeight}`
      );

      stringsEl.classList.toggle("animate", animate);

      requestAnimationFrame(() => stringsEl.classList.add("show"));
    }

    function render(animateStrings = false) {
  const visible = ROADMAP.map((item, index) => ({ ...item, index })).filter(
    (item) => STATE.filter === "all" || item.index === STATE.activeIndex
  );

  pinboardEl.innerHTML = "";

  visible.forEach((item, order) => {
    const card = document.createElement("article");
    const rot = ((item.index * 37) % 9) - 4;

    // This fixes the blank screen.
    // It supports both old data using "steps" and new data using "bullets".
    const bullets = item.bullets || item.steps || [];

    card.className = "exhibit";
    card.dataset.index = item.index;
    card.dataset.tag = item.tag || item.status || "roadmap";
    card.style.setProperty("--rot", `${rot}deg`);
    card.style.animationDelay = `${order * 0.045}s`;

    if (item.complete) card.classList.add("is-complete");
    if (item.index === STATE.activeIndex) card.classList.add("is-active-phase");
    if (item.index === 4) card.classList.add("haunted");

    if (STATE.free && positions[item.index]) {
      card.style.setProperty("--x", `${positions[item.index].x}px`);
      card.style.setProperty("--y", `${positions[item.index].y}px`);
    }

    card.innerHTML = `
      <div class="ex-meta">
        <span>${item.phase}</span>
        <time datetime="${item.date}">${fmtDate(item.date)}</time>
      </div>

      <h2 class="ex-title" data-act="notes" title="Open phase notes">
        ${cutTitle(item.title)}
      </h2>

      <p class="ex-body">${item.body}</p>

      <div class="phase-pills">
        ${bullets.map((bullet) => `<span>${bullet}</span>`).join("")}
      </div>

      <div class="ex-actions">
        <button data-act="focus">FOCUS</button>
        <button data-act="notes">NOTES</button>
      </div>
    `;

    pinboardEl.appendChild(card);
  });

  footerEl.textContent = `${ROADMAP.length} ROADMAP FILES PINNED · JACK RABBIT SEQUENCE BOARD`;

  if (STATE.strings) drawStrings(animateStrings);
  else clearStrings();
}

    function focusPhase(index) {
      STATE.activeIndex = (index + ROADMAP.length) % ROADMAP.length;

      stampBigEl.classList.remove("show");
      requestAnimationFrame(() => stampBigEl.classList.add("show"));

      render(STATE.strings);
    }

    function enterFreeMode() {
      if (STATE.free || window.matchMedia("(max-width: 760px)").matches) return;

      const pinRect = pinboardEl.getBoundingClientRect();
      const height = pinboardEl.offsetHeight;
      const snapshot = [];

      pinboardEl.querySelectorAll(".exhibit").forEach((card) => {
        const rect = card.getBoundingClientRect();

        snapshot.push({
          card,
          index: card.dataset.index,
          x: rect.left - pinRect.left,
          y: rect.top - pinRect.top,
        });
      });

      STATE.free = true;
      pinboardEl.classList.add("free");
      pinboardEl.style.height = `${height}px`;

      snapshot.forEach((item) => {
        positions[item.index] = { x: item.x, y: item.y };
        item.card.style.setProperty("--x", `${item.x}px`);
        item.card.style.setProperty("--y", `${item.y}px`);
      });
    }

    function openNotes(index) {
      const item = ROADMAP[index];

      noteBodyEl.innerHTML = `
        <div class="note-stamp">${item.phase} / ${item.status}</div>

        <h3 class="note-title" id="noteTitle">${item.title}</h3>

        <p class="note-line"><b>ROADMAP TAG:</b> ${item.tag.toUpperCase()}</p>
        <p class="note-line"><b>PLANNED DATE:</b> <time datetime="${item.date}">${fmtDate(item.date)}</time></p>
        <p class="note-line"><b>STATUS:</b> ${item.status}</p>

        <p class="note-text">${item.body}</p>

        <p class="note-line"><b>KEY STEPS:</b></p>

        <ul class="note-list">
          ${item.bullets.map((bullet) => `<li>${bullet}</li>`).join("")}
        </ul>
      `;

      notesEl.classList.add("open");
      notesEl.setAttribute("aria-hidden", "false");
    }

    function closeNotes() {
      notesEl.classList.remove("open");
      notesEl.setAttribute("aria-hidden", "true");
    }

    function runMotion() {
      clearInterval(playTimer);

      if (!STATE.playing) return;

      playTimer = setInterval(() => {
        focusPhase(STATE.activeIndex + 1);
      }, 3600);
    }

    function handlePointerDown(event) {
      if (event.target.closest("button")) return;

      const card = event.target.closest(".exhibit");
      if (!card) return;

      enterFreeMode();

      const index = card.dataset.index;
      const ref = pinboardEl.getBoundingClientRect();
      const pos = positions[index] || { x: 0, y: 0 };

      drag = {
        card,
        index,
        moved: false,
        offX: event.clientX - (ref.left + pos.x),
        offY: event.clientY - (ref.top + pos.y),
      };

      card.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event) {
      if (!drag || !STATE.free) return;

      const ref = pinboardEl.getBoundingClientRect();

      let x = event.clientX - ref.left - drag.offX;
      let y = event.clientY - ref.top - drag.offY;

      x = Math.max(0, Math.min(x, pinboardEl.clientWidth - 245));
      y = Math.max(0, Math.min(y, pinboardEl.clientHeight - 135));

      if (!drag.moved) {
        drag.moved = true;
        drag.card.classList.add("dragging");
      }

      positions[drag.index] = { x, y };

      drag.card.style.setProperty("--x", `${x}px`);
      drag.card.style.setProperty("--y", `${y}px`);

      if (STATE.strings) drawStrings(false);
    }

    function endDrag() {
      if (!drag) return;

      if (drag.moved) justDragged = true;

      drag.card.classList.remove("dragging");
      drag = null;
    }

    function handlePinboardClick(event) {
      if (justDragged) {
        justDragged = false;
        return;
      }

      const card = event.target.closest(".exhibit");
      if (!card) return;

      const index = Number(card.dataset.index);
      const actionButton = event.target.closest("button[data-act]");
      const title = event.target.closest('[data-act="notes"]');

      if (actionButton?.dataset.act === "focus") focusPhase(index);
      if (actionButton?.dataset.act === "notes" || title) openNotes(index);
    }

    function handleControlsClick(event) {
      const button = event.target.closest("button");
      if (!button) return;

      if (button.dataset.filter) {
        STATE.filter = button.dataset.filter;

        controlsEl.querySelectorAll("[data-filter]").forEach((btn) => {
          btn.classList.remove("is-active");
        });

        button.classList.add("is-active");
        render(STATE.strings);
      }

      if (button.dataset.action === "string") {
        STATE.strings = !STATE.strings;
        button.classList.toggle("is-active", STATE.strings);

        if (STATE.strings) drawStrings(true);
        else clearStrings();
      }

      if (button.dataset.action === "play") {
        STATE.playing = !STATE.playing;

        button.classList.toggle("is-active", STATE.playing);
        button.textContent = STATE.playing ? "Pause Motion" : "Play Motion";

        runMotion();
      }

      if (button.dataset.action === "reset") {
        Object.keys(positions).forEach((key) => delete positions[key]);

        STATE.free = false;

        pinboardEl.classList.remove("free");
        pinboardEl.style.height = "";

        render(STATE.strings);
      }
    }

    function handleNotesClick(event) {
      if (event.target === notesEl || event.target.closest("[data-close]")) {
        closeNotes();
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") closeNotes();
    }

    function handleResize() {
      if (STATE.strings && !STATE.free) drawStrings(false);
    }

    pinboardEl.addEventListener("pointerdown", handlePointerDown);
    pinboardEl.addEventListener("pointermove", handlePointerMove);
    pinboardEl.addEventListener("pointerup", endDrag);
    pinboardEl.addEventListener("pointercancel", endDrag);
    pinboardEl.addEventListener("click", handlePinboardClick);
    controlsEl.addEventListener("click", handleControlsClick);
    notesEl.addEventListener("click", handleNotesClick);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    render();
    runMotion();

    const stampTimeout = setTimeout(() => {
      stampBigEl.classList.add("show");
    }, 450);

    return () => {
      clearTimeout(stampTimeout);
      clearInterval(playTimer);

      pinboardEl.removeEventListener("pointerdown", handlePointerDown);
      pinboardEl.removeEventListener("pointermove", handlePointerMove);
      pinboardEl.removeEventListener("pointerup", endDrag);
      pinboardEl.removeEventListener("pointercancel", endDrag);
      pinboardEl.removeEventListener("click", handlePinboardClick);
      controlsEl.removeEventListener("click", handleControlsClick);
      notesEl.removeEventListener("click", handleNotesClick);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <section className={styles.roadmapCodepenExact}>
      <main className="board" id="board" ref={boardRef}>
        <div className="board-grain"></div>
        <div className="board-glow"></div>
        <div className="board-flicker"></div>
        <div className="stamp-big" id="stampBig" ref={stampBigRef}>
          ROADMAP
        </div>

        <header className="case-header">
          <div>
            <div className="stamp">Jack Rabbit Official Plan</div>

            <h1 className="case-title" aria-label="Jack Rabbit Roadmap">
              <span className="r r1">J</span>
              <span className="r r2">A</span>
              <span className="r r3">C</span>
              <span className="r r4">K</span>
              <span className="r r5">R</span>
              <span className="r r6">A</span>
              <span className="r r7">B</span>
              <span className="r r8">B</span>
              <span className="r r9">I</span>
              <span className="r r10">T</span>
              <span className="r r11">M</span>
              <span className="r r12">A</span>
              <span className="r r1">P</span>

              <span className="r-sub">
                launch → utility → burn engine → universe
              </span>
            </h1>

            <nav
              className="controls"
              aria-label="Roadmap controls"
              ref={controlsRef}
            >
              <button type="button" className="ctrl is-active" data-filter="all">
                All Phases
              </button>

              <button type="button" className="ctrl" data-filter="active">
                Current Focus
              </button>

              <button type="button" className="ctrl" data-action="string">
                Show Sequence Strings
              </button>

              <button type="button" className="ctrl is-active" data-action="play">
                Pause Motion
              </button>

              <button type="button" className="ctrl" data-action="reset">
                Reset Board
              </button>
            </nav>

            <p className="hint">
              Drag the roadmap cards. Click a card title to open phase notes.
            </p>
          </div>

          <aside className="rabbit-badge" aria-hidden="true">
            <div className="rabbit-face">🐰</div>
            <span>Jack is watching</span>
          </aside>
        </header>

        <svg className="strings" id="strings" aria-hidden="true" ref={stringsRef}></svg>

        <section
          className="pinboard"
          id="pinboard"
          aria-label="Roadmap cards"
          ref={pinboardRef}
        ></section>

        <footer className="case-footer" id="footer" ref={footerRef}></footer>
      </main>

      <div className="notes" id="notes" aria-hidden="true" ref={notesRef}>
        <article
          className="notes-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="noteTitle"
        >
          <button
            type="button"
            className="notes-close"
            data-close
            aria-label="Close notes"
          >
            ×
          </button>

          <div id="noteBody" ref={noteBodyRef}></div>
        </article>
      </div>
    </section>
  );
}

const JACK_FOOTER_TITLE = "JACK RABBIT".split("");

function CleanJackFooterSection() {
  return (
    <section className={styles.cleanJackFooterSection} aria-label="Jack Rabbit footer">
      <div className={styles.cleanFooterContainer}>
        <div className={`${styles.cleanFooterCircle} ${styles.cleanFooterSix}`}></div>
        <div className={`${styles.cleanFooterCircle} ${styles.cleanFooterFive}`}></div>
        <div className={`${styles.cleanFooterCircle} ${styles.cleanFooterFour}`}></div>
        <div className={`${styles.cleanFooterCircle} ${styles.cleanFooterThree}`}></div>
        <div className={`${styles.cleanFooterCircle} ${styles.cleanFooterTwo}`}></div>
        <div className={`${styles.cleanFooterCircle} ${styles.cleanFooterOne}`}></div>

        <div className={styles.cleanFooterHalftone}></div>

        <img
          className={`${styles.cleanFooterCloud} ${styles.cleanFooterCloudLeft}`}
          src={clouds1}
          alt=""
          aria-hidden="true"
        />

        <img
          className={`${styles.cleanFooterCloud} ${styles.cleanFooterCloudRight}`}
          src={clouds1}
          alt=""
          aria-hidden="true"
        />

        <div className={styles.cleanFooterTitleBlock}>
          <h2 className={styles.cleanFooterMainTitle} aria-label="JACK RABBIT">
            {JACK_FOOTER_TITLE.map((letter, index) =>
              letter === " " ? (
                <span
                  key={`gap-${index}`}
                  className={styles.cleanFooterWordGap}
                  aria-hidden="true"
                ></span>
              ) : (
                <span
                  key={`${letter}-${index}`}
                  className={styles.cleanFooterMainTitleLetter}
                >
                  {letter}
                </span>
              )
            )}
          </h2>
        </div>

        <div className={styles.cleanFooterCenterBadge}>
          <img
            className={styles.cleanFooterJackLogoImage}
            src={jacklogo}
            alt="Jack Rabbit Logo"
          />
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const contract = "0xE004a1987fB0CAFAD49aA5180cbBb50c92e8C031";

  const [currentJackImage, setCurrentJackImage] = useState(jackMint);
  const [, setJackScroll] = useState(0);
  const [jackTransform, setJackTransform] = useState("translate(0%, 0%)");
  const [showUmbrella, setShowUmbrella] = useState(false);
  const [umbrellaStyle, setUmbrellaStyle] = useState({});
  const [openJackRunCards, setOpenJackRunCards] = useState({});
  const [legendFrameIndexes, setLegendFrameIndexes] = useState({});

  const rAFRef = useRef(0);
  const tickingRef = useRef(false);
  const lastPhaseRef = useRef(null);

  const rocketTrackRef = useRef(null);
  const rocketImageRef = useRef(null);

  const manifestoCardRef = useRef(null);
  const manifestoTimerRef = useRef(null);
  const manifestoStartedRef = useRef(false);

  const [manifestoPage, setManifestoPage] = useState(1);
  const [typedManifestoOne, setTypedManifestoOne] = useState("");
  const [typedManifestoTwo, setTypedManifestoTwo] = useState("");
  const [showManifestoExtras, setShowManifestoExtras] = useState(false);
  const [showManifestoStamp, setShowManifestoStamp] = useState(false);
  const [showManifestoReplay, setShowManifestoReplay] = useState(false);

  const topStripColors = [
    styles.textBlue,
    styles.textCream,
    styles.textOrange,
    styles.textlightGreen,
  ];

  const bottomStripColors = [
    styles.textlightYellow,
    styles.textdarkGreen,
    styles.whiteshadow,
    styles.textGold,
  ];

  const bottomIcons = ["🔥", "🐾", "💰", "⚡"];

  const toggleJackRunCard = (cardId) => {
    setOpenJackRunCards((previous) => ({
      ...previous,
      [cardId]: !previous[cardId],
    }));
  };

  const copyToClipboard = () => {
    try {
      navigator.clipboard.writeText(contract);
      alert("Contract copied!");
    } catch (e) {
      const textarea = document.createElement("textarea");
      textarea.value = contract;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      alert("Contract copied!");
    }
  };

  const addJackToWallet = async () => {
    const tokenAddress = "0xE004a1987fB0CAFAD49aA5180cbBb50c92e8C031";

    try {
      if (!window.ethereum) {
        alert("Please install MetaMask or a Web3 wallet.");
        return;
      }

      const wasAdded = await window.ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: tokenAddress,
            symbol: "JACK",
            decimals: 18,
            image: window.location.origin + "/jacklogo.png",
          },
        },
      });

      if (wasAdded) {
        alert("JACK added to wallet!");
      }
    } catch (error) {
      console.error(error);
      alert("Could not add JACK to wallet.");
    }
  };

  function clearManifestoTimer() {
    if (manifestoTimerRef.current) {
      clearInterval(manifestoTimerRef.current);
      manifestoTimerRef.current = null;
    }
  }

  function typeManifestoText(setter, text, onDone) {
    clearManifestoTimer();

    let index = 0;
    setter("");

    manifestoTimerRef.current = setInterval(() => {
      index += 1;
      setter(text.slice(0, index));

      if (index >= text.length) {
        clearManifestoTimer();
        setter(text);

        if (onDone) {
          onDone();
        }
      }
    }, 13);
  }

  function resetManifestoSequence() {
    clearManifestoTimer();

    setManifestoPage(1);
    setTypedManifestoOne("");
    setTypedManifestoTwo("");
    setShowManifestoExtras(false);
    setShowManifestoStamp(false);
    setShowManifestoReplay(false);
  }

  function startManifestoSequence() {
    resetManifestoSequence();

    typeManifestoText(setTypedManifestoOne, MANIFESTO_PAGE_ONE_TEXT, () => {
      setTimeout(() => {
        setManifestoPage(2);

        setTimeout(() => {
          typeManifestoText(setTypedManifestoTwo, MANIFESTO_PAGE_TWO_TEXT, () => {
            setTimeout(() => setShowManifestoExtras(true), 220);
            setTimeout(() => setShowManifestoStamp(true), 520);
            setTimeout(() => setShowManifestoReplay(true), 950);
          });
        }, 260);
      }, 700);
    });
  }

  function replayManifesto() {
    manifestoStartedRef.current = true;
    startManifestoSequence();
  }

useEffect(() => {
  let cancelled = false;
  const timeoutIds = [];

  LEGEND_COMIC_PANELS.forEach((panel) => {
    if (!panel.images || panel.images.length <= 1) return;

    const playPanelFrames = async (frameIndex = 0) => {
      if (cancelled) return;

      setLegendFrameIndexes((previous) => ({
        ...previous,
        [panel.id]: frameIndex,
      }));

      const activeImage = panel.images[frameIndex];

      const durationMs = await getLegendFrameDurationMs(
        activeImage,
        panel.frameDurationMs ?? LEGEND_STATIC_IMAGE_MS
      );

      if (cancelled) return;

      const nextFrameIndex = (frameIndex + 1) % panel.images.length;

      const timeoutId = setTimeout(() => {
        playPanelFrames(nextFrameIndex);
      }, durationMs);

      timeoutIds.push(timeoutId);
    };

    playPanelFrames(0);
  });

  return () => {
    cancelled = true;
    timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
  };
}, []);

useEffect(() => {
  const element = manifestoCardRef.current;
  if (!element) return undefined;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !manifestoStartedRef.current) {
        manifestoStartedRef.current = true;
        startManifestoSequence();
      }
    },
    {
      threshold: 0.35,
    }
  );

  observer.observe(element);

  return () => {
    observer.disconnect();
    clearManifestoTimer();
  };

  // This observer should only be created once when the landing page mounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  useEffect(() => {
    const handleScroll = () => {
      const track = rocketTrackRef.current;
      const rocket = rocketImageRef.current;

      if (!track || !rocket) return;
      if (tickingRef.current) return;

      tickingRef.current = true;

      rAFRef.current = requestAnimationFrame(() => {
        const rect = track.getBoundingClientRect();
        const winH = window.innerHeight || document.documentElement.clientHeight;

        if (rect.top < winH && rect.bottom > 0) {
          const progress = 1 - rect.top / winH;
          const clamped = Math.max(0, Math.min(progress, 1));

          rocket.style.setProperty("--jack-distance", `${clamped * 100}%`);
        }

        tickingRef.current = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);

      if (rAFRef.current) {
        cancelAnimationFrame(rAFRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const section = document.querySelector(`.${styles.whoStayedSection}`);
    if (!section) return;

    const handleMouseMove = (e) => {
      const rect = section.getBoundingClientRect();
      section.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
      section.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
    };

    section.addEventListener("mousemove", handleMouseMove);

    return () => {
      section.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  useEffect(() => {
    const handleContractTilt = () => {
      const card = document.getElementById("jack-contract-card");
      if (!card) return;

      const maxTilt = 15;
      const scrollLimit = 400;

      const progress = Math.min(window.scrollY / scrollLimit, 1);
      const tilt = progress * maxTilt;

      card.style.transformOrigin = "top left";
      card.style.transform = `rotate(${tilt}deg)`;
    };

    window.addEventListener("scroll", handleContractTilt, { passive: true });
    handleContractTilt();

    return () => {
      window.removeEventListener("scroll", handleContractTilt);
    };
  }, []);

  useEffect(() => {
    const panels = document.querySelectorAll(`.${styles.panel}`);

    const handleScroll = () => {
      const midpoint = window.innerHeight / 2;

      panels.forEach((panel) => {
        const rect = panel.getBoundingClientRect();

        if (rect.top < midpoint && rect.bottom > midpoint) {
          panel.classList.add(styles.active);
        } else {
          panel.classList.remove(styles.active);
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const wrapper = document.getElementById("jack-tunnel-wrapper");
    if (!wrapper) return;

    const handleScroll = () => {
      const rect = wrapper.getBoundingClientRect();
      const vh = window.innerHeight;
      const totalHeight = Math.max(rect.height - vh, 1);
      const progress = Math.min(Math.max(-rect.top / totalHeight, 0), 1);

      const fallDistance = 5700;
      const y = progress * fallDistance;
      setJackScroll(y);

      wrapper.style.backgroundPositionY = `${progress * 800}px`;

      let newPhase;

      if (progress < 0.2) newPhase = "mint";
      else if (progress < 0.4) newPhase = "stake";
      else if (progress < 0.6) newPhase = "burn";
      else if (progress < 0.8) newPhase = "reward";
      else newPhase = "moon";

      const phaseStart = Math.floor(progress * 5) / 5;
      const local = (progress - phaseStart) * 5;

      let transform = `translate(0%, ${y}px)`;
      let showBrolly = false;
      let brollyStyle = {};

      switch (newPhase) {
        case "mint": {
          const rot = 90 * local;
          transform += ` rotate(${rot}deg)`;
          break;
        }

        case "stake": {
          const sway = Math.sin(local * Math.PI * 2) * 12;
          transform += ` translateX(${sway}px)`;
          break;
        }

        case "burn": {
          showBrolly = true;

          const spin = 720 * local;
          const rise = -30 - local * 420;
          const flip = local > 0.5 ? -1 : 1;

          brollyStyle = {
            position: "absolute",
            top: `${rise}px`,
            right: "-90px",
            transform: `scale(${1 + local * 0.2}) scaleX(${flip}) rotate(${spin}deg)`,
            transition: "transform 0.15s linear",
            width: "150px",
            height: "auto",
            zIndex: 9999,
            pointerEvents: "none",
          };

          transform += ` rotate(${30 * local}deg)`;
          break;
        }

        case "reward": {
          transform += ` scaleX(-1)`;
          break;
        }

        case "moon": {
          const lift = Math.sin(local * Math.PI) * 50;
          transform += ` translateY(${lift}px)`;
          break;
        }

        default:
          break;
      }

      setJackTransform(transform);
      setShowUmbrella(showBrolly);
      setUmbrellaStyle(brollyStyle);

      if (newPhase !== lastPhaseRef.current) {
        lastPhaseRef.current = newPhase;

        switch (newPhase) {
          case "mint":
            setCurrentJackImage(jackMint);
            break;
          case "stake":
            setCurrentJackImage(jackStake);
            break;
          case "burn":
            setCurrentJackImage(jackBurn);
            break;
          case "reward":
            setCurrentJackImage(jackReward);
            break;
          case "moon":
            setCurrentJackImage(jackMoon);
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className={styles.app}>
      <div className={styles.topBar}>
        <img src={jacklogo} alt="Jack Logo" className={styles.logo} />
        <a href="/stake" className={styles.dappButton}>Explore the dApp →</a>
      </div>

      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.taglinePill}>
            <span className={styles.taglineIcon}>🐾</span>
            <span className={styles.taglineHighlight}>PEG STABILITY ENGINE</span>
          </div>

          <img src={slogan} alt="Jack Rabbit slogan" className={styles.sloganImg} />

          <div className={styles.contractBox}>
            <div className={styles.contractCard} id="jack-contract-card">
              <div className={styles.officialBadge}>
                <span className={styles.pawDots}></span>
                Wazz up
              </div>

              <div className={styles.contractTitleRow}>
                <div className={styles.contractText}>
                  <span>JACK SAYS:</span> ADD TOKEN TO WALLET
                </div>

                <button className={styles.addTokenBtn} data-transaction="addJackToWallet" onClick={addJackToWallet}>
                  $JACK
                </button>
              </div>

              <div className={styles.addressRow}>
                <div className={styles.addressText}>{contract}</div>

                <button className={styles.copyBtn} onClick={copyToClipboard}>
                  📋
                </button>
              </div>

              <div className={styles.bottomNote}>
                Contract configuration must be verified before signing.
              </div>
            </div>
          </div>
        </div>

        <div className={styles.heroRight}>
          <img src={mascot} alt="Jack Mascot" className={styles.mascot} />
        </div>
      </div>

      <div className={`${styles.ticker} ${styles.tickerYellow}`}>
        <div className={`${styles.tickerInner} ${styles.scrollLeft}`}>
          {[...Array(2)].map((_, i) => (
            <React.Fragment key={i}>
              {[
                { text: "Growth Engine", color: topStripColors[0], icon: "💎", start: i === 0 ? "0s" : "12s" },
                { text: "Diamond Paws", color: topStripColors[1], icon: "🐾", start: i === 0 ? "3s" : "15s" },
                { text: "Community Driven", color: topStripColors[2], icon: "🥕", start: i === 0 ? "6s" : "18s" },
                { text: "Born to Burn", color: topStripColors[3], icon: "🔥", start: i === 0 ? "9s" : "21s" },
              ].map((item, phraseIndex) => (
                <span className={styles.tickerPhrase} key={`${i}-${phraseIndex}`}>
                  <span
                    className={`${item.color} ${styles.tickerText}`}
                    style={{ "--wordStart": item.start }}
                  >
                    {item.text.split("").map((letter, index) => (
                      <span
                        key={index}
                        className={styles.waveLetter}
                        style={{ "--letterIndex": index }}
                      >
                        {letter === " " ? "\u00A0" : letter}
                      </span>
                    ))}
                  </span>

                  <span className={styles.tickerIcon}>{item.icon}</span>
                </span>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className={`${styles.ticker} ${styles.tickerRed}`}>
        <div className={`${styles.tickerInner} ${styles.scrollRight}`}>
          {[...Array(2)].map((_, i) => (
            <React.Fragment key={i}>
              {[
                { text: "By the community", color: bottomStripColors[0], icon: bottomIcons[0], start: i === 0 ? "1.5s" : "13.5s" },
                { text: "Nipples Pegged", color: bottomStripColors[1], icon: bottomIcons[1], start: i === 0 ? "4.5s" : "16.5s" },
                { text: "For the community", color: bottomStripColors[2], icon: bottomIcons[2], start: i === 0 ? "7.5s" : "19.5s" },
                { text: "Built to balance", color: bottomStripColors[3], icon: bottomIcons[3], start: i === 0 ? "10.5s" : "22.5s" },
              ].map((item, phraseIndex) => (
                <span className={styles.tickerPhrase} key={`${i}-${phraseIndex}`}>
                  <span
                    className={`${item.color} ${styles.tickerText}`}
                    style={{ "--wordStart": item.start }}
                  >
                    {item.text.split("").map((letter, index) => (
                      <span
                        key={index}
                        className={styles.waveLetter}
                        style={{ "--letterIndex": index }}
                      >
                        {letter === " " ? "\u00A0" : letter}
                      </span>
                    ))}
                  </span>

                  <span className={styles.tickerIcon}>{item.icon}</span>
                </span>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      <section className={styles.layerScrollSection}>
        <div className={styles.whoStayedSection}>
          <div className={styles.manifestoCornerIntro}>
            <div className={styles.manifestoCornerTag}>
              Born to Burn, Built to Pegg.
            </div>

            <div className={styles.manifestoCommunityTitle}>
              <span>A movement Powered by Community.</span>
              <span>for the community.</span>
            </div>
          </div>

          <div className={styles.whoStayedContent}>
            <div className={styles.manifestoStack}>
              <article
                ref={manifestoCardRef}
                className={`${styles.manifestoCard} ${
                  showManifestoStamp ? styles.showManifestoStamp : ""
                }`}
              >
                <div className={styles.manifestoPages}>
                  <section
                    className={`${styles.manifestoPage} ${
                      manifestoPage === 1 ? styles.activeManifestoPage : ""
                    }`}
                  >
                    <div className={styles.manifestoMiniLabel}>
                      JACK Nation <span>Rising</span>
                    </div>

                    <div className={styles.manifestoTypeArea}>
                      <p className={styles.manifestoTypedText}>
                        {typedManifestoOne}
                        {manifestoPage === 1 &&
                          typedManifestoOne.length < MANIFESTO_PAGE_ONE_TEXT.length && (
                            <span className={styles.manifestoCursor}>|</span>
                          )}
                      </p>
                    </div>
                  </section>

                  <section
                    className={`${styles.manifestoPage} ${
                      manifestoPage === 2 ? styles.activeManifestoPage : ""
                    }`}
                  >
                    <div className={styles.manifestoMiniLabel}>
                      JACK + pDAI <span>Ecosystem Thesis</span>
                    </div>

                    <div className={styles.manifestoTypeArea}>
                      <p className={styles.manifestoTypedText}>
                        {typedManifestoTwo}
                        {manifestoPage === 2 &&
                          typedManifestoTwo.length < MANIFESTO_PAGE_TWO_TEXT.length && (
                            <span className={styles.manifestoCursor}>|</span>
                          )}
                      </p>
                    </div>
                  </section>
                </div>

                <div className={styles.manifestoStamp}>
                  For the believers who stayed
                </div>
              </article>

              <section
                className={`${styles.manifestoBelowLoop} ${
                  showManifestoExtras ? styles.showManifestoExtras : ""
                }`}
              >
                <div className={styles.manifestoFlowStrip}>
                  <span>DApp Activity</span>
                  <b>→</b>
                  <span>Protocol Value</span>
                  <b>→</b>
                  <span>Ecosystem Support</span>
                </div>

                <div className={styles.manifestoPills}>
                  <span>Collects Value</span>
                  <span>Supports pDAI</span>
                  <span>Mission Tokens</span>
                  <span>Rewards Believers</span>
                </div>
              </section>

              <button
                type="button"
                className={`${styles.manifestoReplayBtn} ${
                  showManifestoReplay ? styles.showManifestoReplayBtn : ""
                }`}
                onClick={replayManifesto}
              >
                Replay
              </button>
            </div>
          </div>
        </div>

        <div className={styles.overlayScrollTrack}>
          <div className={styles.layerScrollSpacer}></div>

          <div className={styles.howJackRuns}>
            <div className={styles.skyCloudBackground} aria-hidden="true">
              {SKY_CLOUDS.map((cloud, index) => (
                <div
                  key={index}
                  className={`${styles.skyCloud} ${styles[cloud.size]} ${styles[cloud.style]}`}
                >
                  <div></div>
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
              ))}
            </div>

            <img
              src={jackCitySkyline}
              alt=""
              className={styles.jackCitySkyline}
              aria-hidden="true"
              loading="eager"
              decoding="async"
            />

            <div className={styles.howJackRunsHero}>
              <div className={styles.rocketbunnyTrack} ref={rocketTrackRef}>
                <img
                  ref={rocketImageRef}
                  src={jackriding}
                  alt="Jack Riding Rocket"
                  className={styles.jackRocketAnimation}
                  loading="eager"
                  decoding="async"
                  style={{ "--jack-distance": "0%" }}
                />
              </div>

              <img
                src={howJackRunsTitle}
                alt="How Jack Runs"
                className={styles.howJackRunsTitle}
              />
            </div>

            <section className={styles.jackRunCardsSection}>
              <div className={styles.jackRunCardsGrid}>
                {JACK_RUN_CARDS.map((card, index) => (
                  <button
                    type="button"
                    key={card.id}
                    className={`${styles.jackRunCard} ${
                      openJackRunCards[card.id] ? styles.jackRunCardOpen : ""
                    }`}
                    style={{ "--card-index": index + 1 }}
                    onClick={() => toggleJackRunCard(card.id)}
                    aria-pressed={!!openJackRunCards[card.id]}
                    aria-label={`${card.title} card`}
                  >
                    <div className={styles.jackRunBook}>
                      <div className={styles.jackRunCardInside}>
                        <div className={styles.jackRunInsideTop}>
                          <div className={styles.jackRunInsideNumber}>
                            {card.number}
                          </div>

                          <div className={styles.jackRunInsideTag}>
                            {card.insideTag}
                          </div>
                        </div>

                        <div>
                          <h3>{card.insideTitle}</h3>
                          <p>{card.body}</p>
                        </div>

                        <div className={styles.jackRunInsideNote}>
                          {card.note}
                        </div>
                      </div>

                      <div className={styles.jackRunCardCover}>
                        <div className={styles.jackRunCardCoverFront}>
                          <div className={styles.jackRunCardScreen}>
                            <img
                              src={card.image}
                              alt={`${card.title} preview`}
                              className={styles.jackRunCardCoverImg}
                            />
                          </div>

                          <div className={styles.jackRunCardTitlePlate}>
                            <h4>{card.title}</h4>
                            <span>{card.subtitle}</span>
                          </div>

                          <div className={styles.jackRunCardTag}>
                            <span>{card.tag}</span>
                          </div>
                        </div>

                        <div className={styles.jackRunCardCoverBack}>
                          <strong>{card.backTitle}</strong>
                          <span>{card.backText}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>

      <section className={styles.memeImageStrip}>
        <div className={styles.memeImageStripTrack}>
          {[...MEME_STRIP_IMAGES, ...MEME_STRIP_IMAGES].map((image, index) => (
            <div className={styles.memeImageCard} key={index}>
              <img src={image} alt={`Jack meme ${index + 1}`} />
            </div>
          ))}
        </div>
      </section>

      <div
        className={styles.jackTwoLevelWorld}
        style={{ "--jack-two-level-bg": `url(${jackTwoLevelBg})` }}
      >
        <BuyJackSwapSection />
        <TradeOverSection />
      </div>


      {/* ============================================================
   THE LEGEND SECTION — FULL PAGE COMIC ONLY
   ============================================================ */}

<section className={styles.legendSection}>
  <div className={styles.legendComicStage}>
    <svg
      className={styles.legendComicSvg}
      viewBox="0 0 1440 1320"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {LEGEND_COMIC_PANELS.map((panel) => (
          <clipPath key={panel.clipId} id={panel.clipId}>
            <polygon points={panel.points} />
          </clipPath>
        ))}

        <linearGradient id="legendDarkShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000000" stopOpacity="0.02" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.28" />
        </linearGradient>
      </defs>

      {/* IMAGE FILLS — NO AUTO-CROP VERSION */}
{/* IMAGE FILLS — GIFS WAIT FOR GIF END, STATIC IMAGES USE MINUTES */}
{/* IMAGE FILLS — GIFS WAIT FOR GIF END, STATIC IMAGES USE MINUTES */}
{LEGEND_COMIC_PANELS.map((panel) => {
  const activeFrameIndex = legendFrameIndexes[panel.id] ?? 0;
  const activeImage = panel.images[activeFrameIndex % panel.images.length];

  const imageWidth = panel.imageWidth ?? 100;
  const zoom = panel.zoom ?? 1;
  const panX = panel.panX ?? 0;
  const panY = panel.panY ?? 0;
  const rotate = panel.rotate ?? 0;

  return (
    <foreignObject
      key={`${panel.id}-${activeFrameIndex}-${activeImage}`}
      x={panel.x}
      y={panel.y}
      width={panel.width}
      height={panel.height}
      clipPath={`url(#${panel.clipId})`}
      className={styles.legendPanelForeignObject}
    >
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        className={styles.legendPanelWindow}
        style={{
          background: panel.frameBg || "#e8edf2",
        }}
      >
        <img
          src={activeImage}
          alt=""
          className={`${styles.legendPanelFreeImage} ${styles.legendPanelImageFade}`}
          style={{
            width: `${imageWidth}%`,
            transform: `translate(${panX}px, ${panY}px) rotate(${rotate}deg) scale(${zoom})`,
          }}
        />
      </div>
    </foreignObject>
  );
})}

      {/* LIGHT SHADE */}
      {LEGEND_COMIC_PANELS.map((panel) => (
        <polygon
          key={`${panel.id}-shade`}
          className={styles.legendPanelShade}
          points={panel.points}
        />
      ))}

      {/* WHITE COMIC BORDERS */}
      {LEGEND_COMIC_PANELS.map((panel) => (
        <polygon
          key={`${panel.id}-border`}
          className={styles.legendPanelBorder}
          points={panel.points}
        />
      ))}
        </svg>
  </div>
</section>

      <section id="jack-tunnel-wrapper" className={styles.jackTunnelSection}>
        <div className={styles.jackTunnel}>
          <div className={styles.jackRabbitWrapper}>
            <div
              className={styles.jackAndUmbrellaGroup}
              style={{
                transform: jackTransform,
                transition: "transform 0.18s ease-out",
              }}
            >
              <img
                src={currentJackImage}
                alt="Jack Rabbit"
                className={styles.jackRabbit}
              />

              {showUmbrella && (
                <img
                  src={jackUmbrella}
                  alt="Umbrella"
                  className={styles.jackUmbrella}
                  style={umbrellaStyle}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <RoadmapSection jackLogo={jacklogo} />
      <CleanJackFooterSection />
    </div>
  );
}