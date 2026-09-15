import { useEffect, useState } from 'react';
import { JACK } from '../protocol';
export function useWallet() {
  const [account, setAccount] = useState('');
  const [chain, setChain] = useState('');
  const [balance, setBalance] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;
    let active = true;
    const accounts = values => { if (active) { setAccount(values[0] || ''); setBalance(null); } };
    const network = value => { if (active) { setChain(value); setBalance(null); } };
    Promise.all([provider.request({ method: 'eth_accounts' }), provider.request({ method: 'eth_chainId' })])
      .then(([a, c]) => { accounts(a); network(c); }).catch(() => {});
    provider.on?.('accountsChanged', accounts); provider.on?.('chainChanged', network);
    return () => { active = false; provider.removeListener?.('accountsChanged', accounts); provider.removeListener?.('chainChanged', network); };
  }, []);
  useEffect(() => {
    let active = true;
    if (!account || chain !== '0x171') return;
    window.ethereum.request({ method: 'eth_call', params: [{ to: JACK, data: `0x70a08231${account.slice(2).padStart(64, '0')}` }, 'latest'] })
      .then(value => { if (active) { const units = BigInt(value); setBalance((units / 10n ** 18n).toLocaleString()); } })
      .catch(() => { if (active) setMessage('JACK balance could not be read. Try reconnecting.'); });
    return () => { active = false; };
  }, [account, chain]);
  async function connect() {
    if (!window.ethereum) { setMessage('No browser wallet found. Open this dapp in a wallet-enabled browser.'); return; }
    setBusy(true); setMessage('');
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const network = await window.ethereum.request({ method: 'eth_chainId' });
      setBalance(null); setAccount(accounts[0] || ''); setChain(network);
    } catch (error) { setMessage(error.code === 4001 ? 'Wallet connection cancelled.' : 'Wallet connection failed. Please try again.'); }
    finally { setBusy(false); }
  }
  async function switchNetwork() {
    setBusy(true); setMessage('');
    try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x171' }] }); setBalance(null); setChain(await window.ethereum.request({ method: 'eth_chainId' })); }
    catch { setMessage('Please select PulseChain mainnet (chain ID 369) in your wallet.'); }
    finally { setBusy(false); }
  }
  return { account, chain, balance, message, busy, connect, switchNetwork };
}
