import React, { useState, useEffect } from 'react';
import styles from '../styles/Jackies.module.css';
import { ethers } from 'ethers';
import { useCallback } from 'react';

import jacklogo from '../assets/jacklogo.png';
import plsIcon from '../assets/pls.svg';
import plsxIcon from '../assets/plsx.svg';
import hexIcon from '../assets/hex.svg';
import incIcon from '../assets/inc.svg';
import pdaiIcon from '../assets/pdai.svg';
import atropaIcon from '../assets/atropa.svg';
import teddyIcon from '../assets/teddy.png';
import alienIcon from '../assets/ptgc.png';


const ZeroAddress = '0x0000000000000000000000000000000000000000';

const tokenInfo = {
  [ZeroAddress.toLowerCase()]:               { symbol: 'PLS', icon: plsIcon },
  '0x8a810ea8b121d08342e9e7696f4a9915cbe494b7': { symbol: 'PLSX',   icon: plsxIcon   },
  '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39': { symbol: 'HEX',    icon: hexIcon    },
  '0x6efafcb715f385c71d8af763e8478feea6fadf63': { symbol: 'INC',    icon: incIcon    },
  '0x0154179238926e9d5ab4035803c2788457da3ae2': { symbol: 'pDAI',   icon: pdaiIcon   },
  '0xe929f41b8092fe74811577a004c9700843e86ce1': { symbol: 'Atropa', icon: atropaIcon },
  '0xfaecd753896be6b9c946cef01ce2feffe4f3dd0f': { symbol: 'Teddy',  icon: teddyIcon  },
  '0x1f75a0c8cea75420f56598d429e0d82a0961261e': { symbol: 'Alien',  icon: alienIcon  }
};


export default function Jackies() {
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState('stake');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState('0');
  const [walletAddress, setWalletAddress] = useState(null);
  const [erc20Abi, setErc20Abi] = useState(null);
  const [jackStakeAbi, setJackStakeAbi] = useState(null);
  const [totalStaked, setTotalStaked] = useState(0);
  const [userStake, setUserStake] = useState(0);
  const [apy, setApy] = useState(0);
  const [claimableRewards, setClaimableRewards] = useState({});
  const [activeRewardToken, setActiveRewardToken] = useState(null);
  const [lastDayTimestamp, setLastDayTimestamp] = useState(0);
  const [timeLeft, setTimeLeft] = useState(1800); // fallback
  const [isHoveringRewards, setIsHoveringRewards] = useState(false);




  const JACK_ADDRESS = '0xE004a1987FB0CaFAD49aA51B0cbBb50c92e8C031';
  const STAKE_ADDRESS = '0x2d4522F081fddd339A7AA00443dbc0c50d32906b';
  const DECIMALS = 18;

  // Load ABIs
  useEffect(() => {
    async function loadAbis() {
      try {
        const [erc20Raw, stakeRaw] = await Promise.all([
          fetch('/abis/IERC20.json').then((res) => res.json()),
          fetch('/abis/JackStake.json').then((res) => res.json())
        ]);

        // Extract just the `.abi` array if needed
        const erc20Abi = Array.isArray(erc20Raw) ? erc20Raw : erc20Raw.abi;
        const jackStakeAbi = Array.isArray(stakeRaw) ? stakeRaw : stakeRaw.abi;

        setErc20Abi(erc20Abi);
        setJackStakeAbi(jackStakeAbi);
      } catch (err) {
        console.error('Failed to load ABIs', err);
      }
    }
    loadAbis();
  }, []);

  // Countdown updater
  useEffect(() => {
    const interval = setInterval(() => {
      const next = lastDayTimestamp + 30 * 60 * 1000;
      const remaining = Math.max(0, Math.floor((next - Date.now()) / 1000));
      setTimeLeft(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [lastDayTimestamp]); // depend on timestamp

// Fetch lastDayTimestamp once ABI is loaded
  useEffect(() => {
    async function fetchTimestamp() {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(STAKE_ADDRESS, jackStakeAbi, provider);
      const ts = await contract.lastDayTimestamp(); // BigInt
      setLastDayTimestamp(Number(ts) * 1000); // convert to ms
    }
    if (jackStakeAbi) fetchTimestamp();
  }, [jackStakeAbi]);


  function formatCountdown(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // Wallet Connect
  async function connectWallet() {
    if (!window.ethereum) {
      alert("Please install MetaMask.");
      return;
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    setWalletAddress(address);
  }

  // Fetch balance or stake for modal
  useEffect(() => {
    async function fetchModalData() {
      if (!walletAddress || !erc20Abi || !jackStakeAbi || !showModal) return;

      const provider = new ethers.BrowserProvider(window.ethereum);
      const tokenContract = new ethers.Contract(JACK_ADDRESS, erc20Abi, provider);
      const stakeContract = new ethers.Contract(STAKE_ADDRESS, jackStakeAbi, provider);

      try {
        if (modalAction === 'stake') {
          const rawBal = await tokenContract.balanceOf(walletAddress);
          setBalance(ethers.formatUnits(rawBal, DECIMALS));
        } else {
          const rawStake = await stakeContract.userStakeJack(walletAddress);
          setBalance(ethers.formatUnits(rawStake, DECIMALS));
        }
      } catch (err) {
        console.error('Failed to fetch modal balance/stake:', err);
      }
    }

    fetchModalData();
  }, [showModal, walletAddress, erc20Abi, jackStakeAbi, modalAction]);


// Fetch and update JACK pool stats
const fetchJackStats = useCallback(async () => {
  if (!jackStakeAbi) return;

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(STAKE_ADDRESS, jackStakeAbi, provider);

    const total = await contract.totalStakedJack();
    const totalNum = Number(ethers.formatUnits(total, DECIMALS));
    setTotalStaked(totalNum);

    const JACK_PER_DAY = 1000;
    const apyValue = totalNum > 0 ? ((JACK_PER_DAY * 365) / totalNum) * 100 : 0;
    setApy(apyValue.toFixed(2));

    if (walletAddress) {
      const user = await contract.userStakeJack(walletAddress);
      setUserStake(Number(ethers.formatUnits(user, DECIMALS)));
    }
  } catch (err) {
    console.error('Failed to fetch JACK pool stats:', err);
  }
}, [jackStakeAbi, walletAddress]); // dependencies go here


// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  fetchJackStats();
}, [fetchJackStats]); // now it's legit


const fetchRotatingReward = useCallback(async () => {
  if (!jackStakeAbi) return;

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(STAKE_ADDRESS, jackStakeAbi, provider);
    const activeToken = await contract.getRewardTokenByRotation();

    setActiveRewardToken(activeToken.toLowerCase());
  } catch (err) {
    console.error('Failed to fetch rotating reward token:', err);
  }
}, [jackStakeAbi]);


useEffect(() => {
  fetchRotatingReward();
}, [fetchRotatingReward]);


const fetchClaimableExternalRewards = useCallback(async () => {
  if (!jackStakeAbi || !walletAddress) return;

  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(STAKE_ADDRESS, jackStakeAbi, provider);

  try {
    const [tokenAddresses, rewardAmounts] = await contract.getAllClaimableExternalRewards(walletAddress);
    const updated = {};

    for (let i = 0; i < tokenAddresses.length; i++) {
      const token = tokenAddresses[i].toLowerCase();
      updated[token] = ethers.formatUnits(rewardAmounts[i], 18); // assume 18 decimals for now
    }

    setClaimableRewards(updated);
  } catch (err) {
    console.error("❌ Failed to fetch JACK staking rewards", err);
  }
}, [jackStakeAbi, walletAddress]);


useEffect(() => {
  fetchClaimableExternalRewards();
}, [fetchClaimableExternalRewards]);


  // Stake / Unstake
  async function confirmAction() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("Enter a valid amount.");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const token = new ethers.Contract(JACK_ADDRESS, erc20Abi, signer);
      const stakeContract = new ethers.Contract(STAKE_ADDRESS, jackStakeAbi, signer);
      const amountParsed = ethers.parseUnits(amount, DECIMALS);

      if (modalAction === 'stake') {
        const allowance = await token.allowance(walletAddress, STAKE_ADDRESS);
        if (allowance < amountParsed) {
          const tx = await token.approve(STAKE_ADDRESS, amountParsed);
          await tx.wait();
        }

        const tx = await stakeContract.stakeJack(amountParsed);
        await tx.wait();
        fetchJackStats(); // 👈 added here
        alert('✅ JACK staked!');
      } else {
        const tx = await stakeContract.unstakeJack(amountParsed);
        await tx.wait();
        fetchJackStats(); // 👈 added here
        alert('✅ JACK unstaked!');
      }

      setShowModal(false);
    } catch (err) {
      console.error('Transaction failed:', err);
      alert('❌ Transaction failed.');
    }
  }

  // Fade effect
  useEffect(() => {
    document.body.classList.remove(styles.fadeOut);
    setTimeout(() => document.body.classList.add(styles.fadeIn), 0);
    return () => document.body.classList.remove(styles.fadeIn);
  }, []);

async function claimReward(tokenAddress) {
  if (!jackStakeAbi || !walletAddress) return;

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(STAKE_ADDRESS, jackStakeAbi, signer);

    const tx = await contract.claimSpecificJackReward(tokenAddress); // <– always this
    await tx.wait();

    alert(`✅ Claimed reward for ${tokenInfo[tokenAddress]?.symbol || 'Token'}`);
    fetchClaimableExternalRewards(); // update UI
  } catch (err) {
    console.error('Claim failed:', err);
    alert('❌ Claim failed.');
  }
}



async function handleBumpDay() {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(STAKE_ADDRESS, jackStakeAbi, signer);
    const tx = await contract.bumpDay();
    await tx.wait();
    alert("✅ Rewards distributed!");
    // Optionally refetch data
  } catch (err) {
    console.error("Failed to bump day:", err);
    alert("❌ Failed to bump day.");
  }
}




  return (
    <div className={`${styles['page-wrapper']} ${styles['fade-page']}`}> {/* Fade transition wrapper */}
      <header className={styles['dapp-header']}>
        <img src={jacklogo} alt="Jack Rabbit Logo" className={styles['header-logo']} />
        <nav className={styles['header-nav']}>
          <button
            className={`${styles['nav-btn']} ${styles['fade-scroll-control']}`}
            onClick={connectWallet}
          >
            {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Connect wallet'}
          </button>
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <h1>Jackies!!!</h1>
          <p>Stake Jack to earn your favourite tokens</p>
        </section>

        <section className={styles.pools}>
          <div className={`${styles['panel-tabs']} ${styles['stake-tabs']}`}>
            <button className={`${styles.tab} ${styles.stake}`} onClick={() => {
              setModalAction('stake');
              setShowModal(true);
            }}>Stake Jack</button>

            <button className={`${styles.tab} ${styles.unstake}`} onClick={() => {
              setModalAction('unstake');
              setShowModal(true);
            }}>Unstake Jack</button>
          </div>

          <div className={`${styles.panel} ${styles['stake-panel']}`}>
            <table className={styles['data-table']}>
              <thead>
                <tr>
                  <th className={styles['col-desc__text']}>Token</th>
                  <th className={styles['col-desc__text']}>Symbol</th>
                  <th className={styles['col-desc__text']}>APY</th>
                  <th className={styles['col-desc__text']}>Total Staked</th>
                  <th className={styles['col-desc__text']}>Your Stake</th>
                </tr>
              </thead>
              <tbody>
                <tr className={styles['data-row']}>
                  <td><img src={jacklogo} alt="Jack" className={styles['token-icon']} /></td>
                  <td>JACK</td>
                  <td>{apy}%</td>
                  <td>{Number(totalStaked).toLocaleString()}</td>
                  <td>{Number(userStake).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.pools}>
          <div className={`${styles['panel-tabs']} ${styles['rewards-tabs']}`}>
            <button
              className={`${styles.tab} ${styles.rewards} ${timeLeft === 0 ? styles['rewards-ready'] : ''}`}
              onClick={() => {
                if (timeLeft === 0) handleBumpDay(); // ⬅️ Triggers bump
              }}
              onMouseEnter={() => setIsHoveringRewards(true)}
              onMouseLeave={() => setIsHoveringRewards(false)}
            >
              {isHoveringRewards
                ? `Next in ${formatCountdown(timeLeft)}`
                : timeLeft === 0
                  ? 'Claim rewards'
                  : 'Rewards'}
            </button>
          </div>
          <div className={`${styles.panel} ${styles['rewards-panel']}`}>
           <ul className={styles['rewards-list']}>
              {Object.entries(tokenInfo).map(([address, info]) => {
                const isActive = address.toLowerCase() === activeRewardToken;
                return (
                  <li
                    key={address}
                    className={styles['reward-item']}
                  >
                    <img
                      src={info.icon}
                      alt={info.symbol}
                      className={`${styles['reward-icon']} ${!isActive ? styles['gray-icon'] : styles['glow-icon']}`}
                    />
                    <div className={styles['reward-amount']}>
                      {Number(claimableRewards[address] || "0").toLocaleString()}
                    </div>
                    <button
                      className={styles['claim-btn']}
                      onClick={() => claimReward(address)}
                    >
                      Claim
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {showModal && (
          <div id="action-modal" className={styles.modal}>
            <div className={styles['modal-overlay']} onClick={() => setShowModal(false)}></div>
            <div className={styles['modal-input-field']}>
              <h2 className={styles['modal-title']}>
                {modalAction === 'stake' ? 'Stake Jack!!!' : 'Unstake Jack!!!'}
              </h2>
              <div className={`${styles['modal-panel']} ${styles.panel}`}>
                <div className={styles['modal-inner']}>
                  <div className={styles['modal-row']}>
                    <div className={styles['modal-field']}>
                      <div className={styles['token-field']}>
                        <div className={styles['token-label']}>
                          <img src={jacklogo} alt="JACK" />
                          <span>JACK</span>
                        </div>
                      </div>
                      <input
                        type="number"
                        className={styles['modal-input']}
                        placeholder="0.0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <span className={styles['modal-balance']}>
                  Balance: <strong>{balance}</strong>
                </span>

                <div className={styles['confirm-button-wrapper']}>
                  <button
                    className={styles.modalActionBtn}
                    onClick={confirmAction}
                  >
                    Confirm {modalAction === 'stake' ? 'Stake' : 'Unstake'}
                  </button>
                </div>

                <button className={styles['modal-close']} onClick={() => setShowModal(false)}>
                  &times;
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
