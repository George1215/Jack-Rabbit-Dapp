import React, { useEffect, useState, useRef, useCallback } from 'react';
import { BrowserProvider, Contract, parseUnits, formatUnits, ZeroAddress } from 'ethers';
import styles from '../styles/Diamond.module.css';


import jacklogo    from '../assets/jacklogo.png';
import plsIcon     from '../assets/pls.svg';
import plsxIcon    from '../assets/plsx.svg';
import hexIcon     from '../assets/hex.svg';
import incIcon     from '../assets/inc.svg';
import pdaiIcon    from '../assets/pdai.svg';
import atropaIcon  from '../assets/atropa.svg';
import teddyIcon   from '../assets/teddy.png';
import alienIcon   from '../assets/alien.png';

// Mapping of pool token addresses to their symbols and icons
const tokenInfo = {
  [ZeroAddress.toLowerCase()]:               { symbol: 'PLS', icon: plsIcon },
  '0x8a810ea8b121d08342e9e7696f4a9915cbe494b7': { symbol: 'PLSX',   icon: plsxIcon   },
  '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39': { symbol: 'HEX',    icon: hexIcon    },
  '0x6efafcb715f385c71d8af763e8478feea6fadf63': { symbol: 'INC',    icon: incIcon    },
  '0x0154179238926e9d5ab4035803c2788457da3ae2': { symbol: 'PDAI',   icon: pdaiIcon   },
  '0xe929f41b8092fe74811577a004c9700843e86ce1': { symbol: 'ATROPA', icon: atropaIcon },
  '0xfaecd753896be6b9c946cef01ce2feffe4f3dd0f': { symbol: 'TEDDY',  icon: teddyIcon  },
  '0x1f75a0c8cea75420f56598d429e0d82a0961261e': { symbol: 'ALIEN',  icon: alienIcon  }
};

// Minimal ERC-20 ABI for balanceOf only
const erc20MinimalAbi = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

// Load JackStake ABI
async function loadAbi(filename) {
  const url  = `${process.env.PUBLIC_URL}/abis/${filename}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load ABI: ${filename}`);
  const json = await resp.json();
  return Array.isArray(json) ? json : (json.abi ?? json);
}

// Shorten address for display
function truncateAddress(addr) {
  return `${addr.slice(0,6)}…${addr.slice(-4)}`;
}


export default function Diamond() {
  const STAKE_ADDR = '0x2d4522F081fddd339A7AA00443dbc0c50d32906b';
  const [pools, setPools]               = useState([]);
  const [userBalance, setUserBalance]   = useState('0');
  const [selectedToken, setSelectedToken] = useState(Object.keys(tokenInfo)[0]);
  const [amount, setAmount]             = useState('');
  const [searchTerm, setSearchTerm]     = useState('');
  const [isModalOpen, setModalOpen]     = useState(false);
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [activePoolTab, setActivePoolTab] = useState('stake');
  const [claimableRewards, setClaimableRewards] = useState({});
  const [fadeClass, setFadeClass] = useState(styles.fadeIn); // Initial animation on mount
  


  const providerRef  = useRef(null);
  const jackReadRef  = useRef(null);
  const jackWriteRef = useRef(null);
  const erc20AbiRef  = useRef(null);
  
  

  // Open & close modal
  function openModal(isStake) {
    setActivePoolTab(isStake ? 'stake' : 'unstake');
    setSelectedToken(Object.keys(tokenInfo)[0]);
    setSearchTerm('');
    setAmount('');
    setDropdownOpen(false);
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
  }



  // Load pools & calculate APY
// Define this FIRST
const loadClaimableRewards = useCallback(async () => {
  const jackRead = jackReadRef.current;
  if (!jackRead) return;

  try {
    let user = null;
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) user = accounts[0];
      } catch (_) {}

    const rewards = {};

    await Promise.all(
      pools.map(async (pool) => {
        try {
          const amt = await jackRead.getClaimableJackReward(user, pool.addr);
          rewards[pool.addr] = Number(formatUnits(amt, 18));
        } catch (e) {
          rewards[pool.addr] = 0;
        }
      })
    );

    setClaimableRewards(rewards);
  } catch (e) {
    console.error('Error loading claimable rewards:', e);
  }
}, [pools]); // <-- Make sure it's defined before it's used

// Then define this SECOND
const loadStakeConfig = useCallback(async () => {
  const jackRead = jackReadRef.current;
  if (!jackRead) return;

  let user = null;
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) user = accounts[0];
  } catch (_) {
    user = null;
  }

  try {
    const poolAddrs = await jackRead.getExternalPools();
    if (!poolAddrs.length) {
      setPools([]);
      return;
    }

    const today = Math.floor(Date.now() / 86400000); // current day in epoch format

    const decimalsMap = {
      [ZeroAddress.toLowerCase()]: 18, // PLS
      '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39': 8, // HEX
      '0x6efafcb715f385c71d8af763e8478feea6fadf63': 18, // INC
    };

    const rawData = await Promise.all(
      poolAddrs.map(async addr => {
        const [tW, dailyWRaw] = await Promise.all([
          jackRead.totalStakedExternal(addr),
          jackRead.dailyNetReward(addr, today) // ✅ Replaces old externalJackDaily()
        ]);

        const decimals = decimalsMap[addr.toLowerCase()] || 18;
        const totalStaked = Number(formatUnits(tW, decimals));
        const dailyJ = Number(formatUnits(dailyWRaw, 18));

        let userStake = 0;
        if (user) {
          try {
            const uW = await jackRead.userStakeExternal(addr, user);
            userStake = Number(formatUnits(uW, decimals));
          } catch (_) {}
        }

        const rawApy = totalStaked > 0 ? (dailyJ * 365 / totalStaked) * 100 : 0;

        return {
          addr: addr.toLowerCase(),
          total: totalStaked,
          user: userStake,
          daily: dailyJ,
          rawApy: rawApy
        };
      })
    );

    rawData.sort((a, b) => b.rawApy - a.rawApy);
    const topRaw = rawData.length > 0 ? rawData[0].rawApy : 0;

    const rankedPools = rawData.map(p => ({
      ...p,
      apy: topRaw > 0 ? (p.rawApy / topRaw) * 100 : 0
    }));

    setPools(rankedPools);
  } catch (e) {
    console.error(e);
  }
}, []);





  // Load user balance for selected token
const loadBalance = useCallback(async (tokenAddr) => {
  const provider = providerRef.current;
  if (!provider) return;
  try {
    let user = null;
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) user = accounts[0];
    } catch (_) {
      user = null;
    }

    const decimalsMap = {
      [ZeroAddress.toLowerCase()]: 18,
      '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39': 8,
    };

    const decimals = decimalsMap[tokenAddr.toLowerCase()] || 18;

    if (activePoolTab === 'unstake') {
      const stakeBal = await jackReadRef.current.userStakeExternal(tokenAddr, user);
      setUserBalance(formatUnits(stakeBal, decimals));
    } else {
      if (tokenAddr === ZeroAddress.toLowerCase()) {
        const balance = await provider.getBalance(user);
        setUserBalance(formatUnits(balance, decimals));
      } else {
        const token = new Contract(tokenAddr, erc20MinimalAbi, provider);
        const bal = await token.balanceOf(user);
        setUserBalance(formatUnits(bal, decimals));
      }
    }
  } catch (e) {
    console.error('Error loading balance:', e);
  }
}, [activePoolTab]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isModalOpen) loadBalance(selectedToken); }, [isModalOpen, selectedToken]);

  // Approve and stake/unstake logic
async function confirmAction() {
  const provider = providerRef.current;
  const erc20Abi = erc20AbiRef.current;
  const jackWrite = jackWriteRef.current;
  const jackRead = jackReadRef.current;
  if (!provider || !erc20Abi || !jackWrite || !jackRead) return;

  if (!amount || Number(amount) <= 0) {
    alert('Enter a valid amount');
    return;
  }

  try {
    const signer = await provider.getSigner();
    const userAddr = await signer.getAddress();

    const decimalsMap = {
      [ZeroAddress.toLowerCase()]: 18, // PLS
      '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39': 8,  // HEX
      '0x6efafcb715f385c71d8af763e8478feea6fadf63': 18, // INC
      // Add more if needed
    };

    const decimals = decimalsMap[selectedToken.toLowerCase()] || 18;
    const amountWei = parseUnits(amount, decimals);
    const isPLS = selectedToken === ZeroAddress.toLowerCase();

    console.log(`Selected Token: ${tokenInfo[selectedToken].symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Amount Entered: ${amount}`);
    console.log(`Parsed Amount (wei): ${amountWei.toString()}`);
    console.log(`Is PLS: ${isPLS}`);

    // ✅ STAKE logic
    if (activePoolTab === 'stake') {
      if (isPLS) {
        const tokenAddr = ZeroAddress;
        const valueToSend = amountWei;
        const buffer = parseUnits('0.01', 18);
        const totalToSend = valueToSend + buffer;

        console.log('🟡 [PLS STAKE] Preparing transaction...');
        console.log('🔍 totalToSend (with buffer):', totalToSend.toString());

        const tx = await jackWrite.stakeExternal(tokenAddr, valueToSend, {
          value: totalToSend
        });
        console.log('✅ PLS Transaction sent:', tx.hash);
        await tx.wait();
        console.log('✅ PLS Transaction confirmed');
      } else {
        // ERC-20 stake
        const tokenRead = new Contract(selectedToken, erc20MinimalAbi, provider);
        const allowance = await tokenRead.allowance(userAddr, STAKE_ADDR);
        if (allowance < amountWei) {
          const tokenWrite = tokenRead.connect(signer);
          const txA = await tokenWrite.approve(STAKE_ADDR, amountWei);
          await txA.wait();
        }

        const tx = await jackWrite.stakeExternal(selectedToken, amountWei);
        console.log('✅ ERC-20 Transaction sent:', tx.hash);
        await tx.wait();
        console.log('✅ ERC-20 Transaction confirmed');
      }

      alert(`✅ Successfully staked ${tokenInfo[selectedToken].symbol}`);
    }

    // ✅ UNSTAKE logic
    else if (activePoolTab === 'unstake') {
      // Pre-check: user must have enough staked
      const stakeBal = await jackRead.userStakeExternal(selectedToken, userAddr);
      console.log('📊 Your stake balance:', stakeBal.toString());

      if (amountWei > stakeBal) {
        alert('You are trying to unstake more than you have!');
        return;
      }

      const tx = await jackWrite.unstakeExternal(selectedToken, amountWei);
      console.log('✅ Unstake transaction sent:', tx.hash);
      await tx.wait();
      console.log('✅ Unstake confirmed');
      alert(`✅ Successfully unstaked ${tokenInfo[selectedToken].symbol}`);
    }

    closeModal();
    loadStakeConfig();

  } catch (err) {
    console.error('❌ Transaction Failed:', err);
    alert('Error: ' + err.message);
  }
}

async function fetchClaimableRewards() {
  const jackRead = jackReadRef.current;
  if (!jackRead) return;

  let userAddr;
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
      userAddr = accounts[0];
    } else {
      return; // No connected wallet
    }
  } catch (e) {
    console.error("Error fetching user account:", e);
    return;
  }

  const updatedRewards = {};

  for (const tokenAddress of Object.keys(tokenInfo)) {
    try {
      const reward = await jackRead.getClaimableJackReward(userAddr, tokenAddress);
      updatedRewards[tokenAddress] = formatUnits(reward, 18);
    } catch (err) {
      console.error(`Error fetching reward for ${tokenAddress}`, err);
      updatedRewards[tokenAddress] = "0";
    }
  }

  setClaimableRewards(updatedRewards);
}


async function claimJackReward(tokenAddr) {
  try {
    const jackWrite = jackWriteRef.current;
    if (!jackWrite) return;

    const tx = await jackWrite.claimJackReward(tokenAddr);
    await tx.wait();
    alert(`✅ Claimed JACK reward from ${tokenInfo[tokenAddr]?.symbol || 'token'}`);
    await fetchClaimableRewards()
    loadStakeConfig();
  } catch (e) {
    console.error('❌ Claim failed:', e);
    alert('Claim failed: ' + e.message);
  }
}


// Initialization
// Initialization
useEffect(() => {
  async function init() {
    if (!window.ethereum) return;
    const provider = new BrowserProvider(window.ethereum);
    providerRef.current = provider;
    const signer = await provider.getSigner();
    erc20AbiRef.current = erc20MinimalAbi;

    const stakeAbi = await loadAbi('JackStake.json');
    jackReadRef.current = new Contract(STAKE_ADDR, stakeAbi, provider);
    jackWriteRef.current = new Contract(STAKE_ADDR, stakeAbi, signer);

    const btn = document.getElementById('connect-btn');
    async function updateBtn() {
      const accts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accts.length) {
        btn.textContent = truncateAddress(accts[0]);
        btn.classList.add('connected');
        loadStakeConfig(); // now safe here too
      } else {
        btn.textContent = 'Connect wallet';
        btn.classList.remove('connected');
      }
    }
    if (btn) {
      btn.onclick = async () => {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        updateBtn();
      };
      window.ethereum.on('accountsChanged', updateBtn);
      updateBtn();
    }
  }
  init();
}, [loadStakeConfig]);

// ✅ New clean effect below to fix the warning
useEffect(() => {
  loadStakeConfig();
}, [loadStakeConfig]); // ✅ Include it here as required

useEffect(() => {
  if (pools.length > 0) {
    loadClaimableRewards();
  }
}, [pools, loadClaimableRewards]);


  
// const loadClaimableRewards = useCallback(async () => {
//   const jackRead = jackReadRef.current;
//   if (!jackRead) return;

//   try {
//     const [user] = await window.ethereum.request({ method: 'eth_accounts' });
//     const rewards = {};

//     await Promise.all(
//       pools.map(async (pool) => {
//         try {
//           const amt = await jackRead.getClaimableJackReward(user, pool.addr);
//           rewards[pool.addr] = Number(formatUnits(amt, 18));
//         } catch (e) {
//           rewards[pool.addr] = 0;
//         }
//       })
//     );

//     setClaimableRewards(rewards);
//   } catch (e) {
//     console.error('Error loading claimable rewards:', e);
//   }
// }, [pools]); // ✅ add 'pools' as dependency

useEffect(() => {
  window.scrollTo(0, 0); // Reset scroll
  return () => {
    setFadeClass(styles.fadeIn); // Reset fade state when component unmounts
  };
}, []);

  // Render JSX
  return (
    <div className={`${styles.diamondPage} ${fadeClass}`}>
      <header className={styles.dappHeader}>
        <img src={jacklogo} alt="Logo" className={styles.headerLogo}/>
        <nav className={styles.headerNav}>


          <button id="connect-btn" className={styles.navBtn}>Connect wallet</button>
        </nav>
      </header>
      <main>
        <section className={styles.hero}>
          <h1>Diamond Hands!!!</h1>
          <p>Stake your favourite tokens to earn Jack in the pools below</p>
        </section>
        <section className={styles.pools}>
          <div className={styles.poolsLeftWrapper}>
            <div className={`${styles.panelTabs} ${styles.leftTabs}`}>  
              <button className={`${styles.tab} ${styles.stake}`} onClick={()=>openModal(true)}>Stake</button>
              <button className={`${styles.tab} ${styles.unstake}`} onClick={()=>openModal(false)}>Unstake</button>
            </div>
            <div className={`${styles.panel} ${styles.leftPanel}`}>
              <table className={styles.dataTable}>
                <thead><tr><th>Token</th><th>Symbol</th><th>APY</th><th>Total Staked</th><th></th><th>Your Stake</th></tr></thead>
                <tbody>
                  {pools.map(d => {
                    const info = tokenInfo[d.addr] || {};
                    const badge = d.apy > 80 ? '🌶️' : '';

                    return (
                      <tr key={d.addr}>
                        <td>{info.icon && <img src={info.icon} className={styles.tokenIcon} alt={info.symbol}/>}</td>
                        <td>{info.symbol || '–'}</td>
                        <td>{isNaN(d.apy) ? '0.00%' : `${d.apy.toFixed(2)}%`}</td>
                        <td>{typeof d.total === 'number' ? d.total.toLocaleString() : '0.00'}</td>
                        <td className={styles.badgeCell}>{badge}</td>
                        <td>{typeof d.user === 'number' ? d.user.toLocaleString() : '0.00'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className={styles.poolsRightWrapper}>
            <div className={`${styles.panelTabs} ${styles.rightTabs}`}><button className={`${styles.tab} ${styles.rewards}`}>Rewards</button></div>
            <div className={`${styles.panel} ${styles.rightPanel}`}>
              <table className={styles.rewardsTable}>
                <thead><tr className={styles.spacerRow}><td>Jack tokens</td></tr></thead>
                <tbody>
                  {pools.map(d => {
                    const reward = claimableRewards[d.addr] || 0;
                    return (
                      <tr key={d.addr}>
                        <td>{reward.toFixed(2)}</td>
                        <td>
                          <button className={styles.claimBtn} onClick={() => claimJackReward(d.addr)}>
                            Claim
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        {isModalOpen && (
        <div className={`${styles.modal} ${styles.modalVisible}`}>
          <div className={styles.modalOverlay} onClick={closeModal}/>
          <div className={styles.modalPanel}>
            <button className={styles.modalClose} onClick={closeModal}>&times;</button>
            <div className={styles.modalInner}>
              <h2 className={styles.modalTitle}>
                {activePoolTab === 'stake'
                  ? `Stake ${tokenInfo[selectedToken].symbol}`
                  : `Unstake ${tokenInfo[selectedToken].symbol}`}
              </h2>
              <div className={styles.modalRow}>
                <div className={styles.tokenField} onClick={()=>setDropdownOpen(o=>{if(!o)setSearchTerm('');return!o;})}>
                  <img src={tokenInfo[selectedToken].icon} className={styles.tokenFieldIcon} alt={tokenInfo[selectedToken].symbol}/>
                  <span className={styles.tokenFieldArrow}>{tokenInfo[selectedToken].symbol} ▾</span>
                </div>
                <input
                  id={isDropdownOpen ? undefined : 'modal-amount'}
                  className={styles.modalInput}
                  type={isDropdownOpen ? 'text' : 'number'}
                  placeholder={isDropdownOpen ? 'Search token…' : '0.0'}
                  value={isDropdownOpen ? searchTerm : amount}
                  onChange={e => {
                    isDropdownOpen ? setSearchTerm(e.target.value) : setAmount(e.target.value);
                  }}
                  autoFocus={isDropdownOpen}
                />
              </div>
              {isDropdownOpen ? (
                <div className={styles.modalSearchList}>
                  {Object.entries(tokenInfo)
                    .filter(([,info]) =>
                      info.symbol.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map(([addr, info]) => (
                      <div key={addr} className={styles.searchItem} onClick={() => { setSelectedToken(addr); setDropdownOpen(false); }}>
                        <img src={info.icon} className={styles.searchItemImg} alt={info.symbol} />
                        <span>{info.symbol}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className={styles.modalFooter}>
                  <span className={styles.modalBalance}>
                    {activePoolTab === 'unstake' ? 'Staked:' : 'Balance:'} <strong>{Number(userBalance).toFixed(2)}</strong> {tokenInfo[selectedToken].symbol}
                  </span>
                  <button className={styles.claimBtn} onClick={confirmAction}>
                    Confirm {activePoolTab === 'stake' ? 'Stake' : 'Unstake'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>) }
        It’s a fully on-chain, permissionless peg-maintenance mechanism that scales fees into a 1-year rolling budget, enforces rate limits and slippage caps, and automatically flips its buy/sell bias based on observed price.
      </main>
    </div>
  );
}
