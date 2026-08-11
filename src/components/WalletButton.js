// src/components/WalletButton.js
import React, { useEffect, useMemo, useState } from "react";
import { BrowserProvider } from "ethers";
import styles from "../styles/Navbar.module.css";

/**
 * PulseChain networks
 * Mainnet chainId: 369 / 0x171
 * Testnet chainId: 943 / 0x3AF
 */
export const NETWORKS = {
  369: {
    key: "pulse-mainnet",
    label: "Mainnet",
    chainIdHex: "0x171",
    rpcUrls: ["https://rpc.pulsechain.com"],
    blockExplorerUrls: ["https://scan.pulsechain.com"],
    nativeCurrency: {
      name: "Pulse",
      symbol: "PLS",
      decimals: 18,
    },
  },

  943: {
    key: "pulse-testnet",
    label: "Testnet",
    chainIdHex: "0x3AF",
    rpcUrls: ["https://rpc.v4.testnet.pulsechain.com"],
    blockExplorerUrls: ["https://scan.v4.testnet.pulsechain.com"],
    nativeCurrency: {
      name: "Pulse",
      symbol: "tPLS",
      decimals: 18,
    },
  },
};

const DEFAULT_NETWORK = NETWORKS[369];

function hasWallet() {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

function normalizeChainId(chainIdValue) {
  if (chainIdValue == null) return undefined;

  if (typeof chainIdValue === "string") {
    return parseInt(chainIdValue, 16);
  }

  return Number(chainIdValue);
}

function labelFor(chainIdNumber) {
  return NETWORKS[chainIdNumber]?.label ?? `Chain ${chainIdNumber}`;
}

function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * This helper can also be reused later inside the Buy JACK swap section.
 */
export async function switchOrAddPulseNetwork(target = DEFAULT_NETWORK) {
  if (!hasWallet()) {
    throw new Error("No wallet found. Please install MetaMask.");
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: target.chainIdHex }],
    });

    return target;
  } catch (error) {
    if (error?.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: target.chainIdHex,
            chainName: `PulseChain ${target.label}`,
            rpcUrls: target.rpcUrls,
            blockExplorerUrls: target.blockExplorerUrls,
            nativeCurrency: target.nativeCurrency,
          },
        ],
      });

      return target;
    }

    throw error;
  }
}

export default function WalletButton({ className = "" }) {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(undefined);
  const [connecting, setConnecting] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);

  const currentNetwork = chainId != null ? NETWORKS[chainId] : undefined;
  const networkLabel = chainId != null ? labelFor(chainId) : "";
  const isSupportedPulseNetwork = Boolean(currentNetwork);

  // Silent init: checks wallet state without opening wallet prompt.
  useEffect(() => {
    if (!hasWallet()) return;

    let onAccountsChanged;
    let onChainChanged;
    let isMounted = true;

    async function initWalletState() {
      try {
        const provider = new BrowserProvider(window.ethereum);

        const accounts = await provider.listAccounts();
        if (isMounted && accounts.length > 0) {
          setAccount(accounts[0].address);
        }

        const network = await provider.getNetwork();
        if (isMounted && network?.chainId != null) {
          setChainId(Number(network.chainId));
        }
      } catch (error) {
        console.error("Wallet silent init failed:", error);
      }

      if (window.ethereum?.on) {
        onAccountsChanged = (accounts) => {
          setAccount(accounts?.[0] || "");
        };

        onChainChanged = (newChainId) => {
          setChainId(normalizeChainId(newChainId));
        };

        window.ethereum.on("accountsChanged", onAccountsChanged);
        window.ethereum.on("chainChanged", onChainChanged);
      }
    }

    initWalletState();

    return () => {
      isMounted = false;

      if (window.ethereum?.removeListener) {
        if (onAccountsChanged) {
          window.ethereum.removeListener("accountsChanged", onAccountsChanged);
        }

        if (onChainChanged) {
          window.ethereum.removeListener("chainChanged", onChainChanged);
        }
      }
    };
  }, []);

  const short = useMemo(() => shortAddress(account), [account]);

  const connect = async () => {
    if (!hasWallet()) {
      window.open(
        "https://metamask.io/download/",
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }

    try {
      setConnecting(true);

      const provider = new BrowserProvider(window.ethereum);

      const accounts = await provider.send("eth_requestAccounts", []);
      const connectedAccount = accounts?.[0] || "";

      setAccount(connectedAccount);

      const network = await provider.getNetwork();
      const currentChainId = Number(network.chainId);

      setChainId(currentChainId);

      // If user is not on PulseChain mainnet/testnet, add/switch to PulseChain mainnet.
      if (!NETWORKS[currentChainId]) {
        const switchedNetwork = await switchOrAddPulseNetwork(DEFAULT_NETWORK);
        setChainId(parseInt(switchedNetwork.chainIdHex, 16));
      }
    } catch (error) {
      console.error("Wallet connection failed:", error);
    } finally {
      setConnecting(false);
    }
  };

  const switchTo = async (target) => {
    if (!hasWallet()) return;

    try {
      const switchedNetwork = await switchOrAddPulseNetwork(target);
      setChainId(parseInt(switchedNetwork.chainIdHex, 16));
      setShowSwitcher(false);
    } catch (error) {
      console.error("Network switch failed:", error);
    }
  };

  return (
    <>
      <div className={styles.walletWrap}>
        {!account ? (
          <button className={className} onClick={connect} disabled={connecting}>
            {connecting ? "Connecting…" : "Connect wallet"}
          </button>
        ) : (
          <button className={className} onClick={connect} disabled={connecting}>
            {connecting ? "Connecting…" : short}
          </button>
        )}

        {account && (
          <button
            type="button"
            className={styles.netBadge}
            onClick={() => setShowSwitcher(true)}
            title="Switch Network"
          >
            {isSupportedPulseNetwork
              ? networkLabel
              : chainId
              ? "Wrong Network"
              : "Network"}
          </button>
        )}
      </div>

      {showSwitcher && (
        <div
          className={styles.netModalOverlay}
          onClick={() => setShowSwitcher(false)}
        >
          <div className={styles.netModal} onClick={(e) => e.stopPropagation()}>
            <h3>Switch Networks</h3>

            <div className={styles.netList}>
              {Object.values(NETWORKS).map((network) => {
                const networkNumber = parseInt(network.chainIdHex, 16);
                const active = Number(chainId) === networkNumber;

                return (
                  <button
                    key={network.key}
                    type="button"
                    className={`${styles.netOption} ${
                      active ? styles.activeNet : ""
                    }`}
                    onClick={() => switchTo(network)}
                  >
                    <span className={styles.netDot} />
                    <span>{`PulseChain ${network.label}`}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}