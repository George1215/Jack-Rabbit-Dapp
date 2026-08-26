import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './dapp.css';

// Import your ABIs
import JackStakeAbi from '../public/abis/JackStake.json';
// import ERC20Abi from '../public/abis/IERC20.json'; // if needed

// Token metadata
const tokenInfo = {
  "0x8a810ea8b121d08342e9e7696f4a9915cbe494b7": { symbol: "PLS",   icon: "/assets/pls.svg"   },
  "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39": { symbol: "PLSX",  icon: "/assets/plsx.svg"  },
  "0x6efafcb715f385c71d8af763e8478feea6fadf63": { symbol: "HEX",   icon: "/assets/hex.svg"   },
  "0xa210f95d665bb4537434be96d9a2866cca629d5b": { symbol: "INC",   icon: "/assets/inc.svg"   },
  "0x0154179238926e9d5ab4035803c2788457da3ae2": { symbol: "pDAI",  icon: "/assets/pdai.svg"  },
  "0xe929f41b8092fe74811577a004c9700843e86ce1": { symbol: "Atropa",icon: "/assets/atropa.svg"},
  "0xfaecd753896be6b9c946cef01ce2feffe4f3dd0f": { symbol: "Teddy", icon: "/assets/teddy.png" },
  "0x1f75a0c8cea75420f56598d429e0d82a0961261e": { symbol: "Alien", icon: "/assets/alien.png" }
};

function App() {
  // Wallet state
  const [account, setAccount] = useState(null);
  // Pools data
  const [pools, setPools] = useState([]);
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [isStakeMode, setIsStakeMode] = useState(true);
  // Current token selection in modal
  const [selectedToken, setSelectedToken] = useState({ address: Object.keys(tokenInfo)[0], symbol: 'PLS', icon: '/assets/pls.svg' });

  // Initialize provider & load pools
  useEffect(() => {
    if (!window.ethereum) return;
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const jackRead = new ethers.Contract(
      '0x3d50A5EE9ef8C078A86a26161792da5D388A35Fa',
      JackStakeAbi,
      provider
    );

    async function load() {
      // Load wallet
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      setAccount(accounts[0] || null);
      // Load stake config (stub: you'll implement like before)
      // const data = await jackRead.getExternalPools();
      // setPools(data);
    }
    load();
    window.ethereum.on('accountsChanged', (acs) => setAccount(acs[0] || null));
  }, []);

  return (
    <>
      <header className="dapp-header">
        <img src="/assets/jacklogo.png" alt="Logo" className="header-logo" />
        <nav className="header-nav">
          <img src="/assets/carrot.png" alt="Carrot" id="carrot-tab" className="nav-tab active" />
          <img src="/assets/paw.png" alt="Paw" id="paw-tab" className="nav-tab" />
          <button id="connect-btn" className="nav-btn">
            {account ? `${account.slice(0,6)}…${account.slice(-4)}` : 'Connect wallet'}
          </button>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="hero">
          <h1>Diamond Hands!!!</h1>
          <p>Stake your favourite tokens to earn Jack in the pools below</p>
        </section>

        {/* Pools */}
        <section className="pools">
          <div className="pools-left-wrapper">
            <div className="panel-tabs left-tabs">
              <button className="tab stake" onClick={() => setIsStakeMode(true)}>Stake</button>
              <button className="tab unstake" onClick={() => setIsStakeMode(false)}>Unstake</button>
            </div>
            <div className="panel left-panel">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Symbol</th>
                    <th>APY</th>
                    <th>Total Staked</th>
                    <th></th>
                    <th>Your Stake</th>
                  </tr>
                </thead>
                <tbody>
                  {pools.map(pool => (
                    <tr key={pool.token} onClick={() => { setSelectedToken({ address: pool.token, symbol: tokenInfo[pool.token].symbol, icon: tokenInfo[pool.token].icon }); setModalOpen(true); }}>
                      <td><img src={tokenInfo[pool.token].icon} className="token-icon" /></td>
                      <td>{tokenInfo[pool.token].symbol}</td>
                      <td>{pool.apy.toFixed(2)}%</td>
                      <td>{pool.total.toLocaleString()}</td>
                      <td className="badge-cell">{pool.isTop && '🦄'}</td>
                      <td>{pool.user.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rewards side stub omitted for brevity */}
        </section>

        {/* Modal */}
        {modalOpen && (
          <div id="action-modal" className="modal">
            <div className="modal-overlay" onClick={() => setModalOpen(false)} />
            <div className="modal-panel panel">
              <button className="modal-close" onClick={() => setModalOpen(false)}>&times;</button>
              <h2 className="modal-title">{isStakeMode ? `Stake ${selectedToken.symbol}!!!` : `Unstake ${selectedToken.symbol}!!!`}</h2>
              {/* Input row + search logic here... */}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default App;
