// src/config/treasuryConfig.js
export const TREASURY_CONFIG = {
  RPC_URL:
    process.env.REACT_APP_RPC_URL ||
    process.env.VITE_RPC_URL ||
    "",

  NETWORK_LABEL:
    process.env.REACT_APP_NETWORK_LABEL ||
    process.env.VITE_NETWORK_LABEL ||
    "PulseChain Testnet v4",

  JACK_TOKEN:
    process.env.REACT_APP_JACK_TOKEN ||
    process.env.VITE_JACK_TOKEN ||
    "0xcaC515CCDDEff1481043Ac67f6d792d004c1D38A",

  JACK_TREASURY:
    process.env.REACT_APP_JACK_TREASURY ||
    process.env.VITE_JACK_TREASURY ||
    "0x49E7C06acBD57D6ecF709b8411c4ca316B2325Bf",

  PDAI_TOKEN:
    process.env.REACT_APP_PDAI_TOKEN ||
    process.env.VITE_PDAI_TOKEN ||
    "0x72F99D6a755609ab03Ce601E4674C059420901B9",

  WPLS_TOKEN:
    process.env.REACT_APP_WPLS_TOKEN ||
    process.env.VITE_WPLS_TOKEN ||
    "0x70499adEBB11Efd915E3b69E700c331778628707",

  EVENT_LOOKBACK_BLOCKS: Number(
    process.env.REACT_APP_EVENT_LOOKBACK ||
      process.env.VITE_EVENT_LOOKBACK ||
      "2000"
  ),
};