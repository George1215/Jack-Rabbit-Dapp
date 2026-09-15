// dapp.js

// ─── Helpers ───────────────────────────────────────────────

// Load an ABI JSON file from /abis
// async function loadAbi(path) {
//    // fetch from the absolute /abis/ directory
//    const resp = await fetch(`/abis/${path}`);
//    if (!resp.ok) throw new Error(`Failed to load ABI: ${path}`);
//    return resp.json();
// }

async function loadAbi(path) {
  // fetch from the relative abis/ folder next to dapp.js/index.html
  const resp = await fetch(`abis/${path}`);
  if (!resp.ok) throw new Error(`Failed to load ABI: ${path} (status ${resp.status})`);
  return resp.json();
}

// Truncate a hex address
function truncateAddress(a) {
  return a.slice(0,6) + "…" + a.slice(-4);
}

// ─── Pool tokens → UI info (lowercase keys) ───────────────
const tokenInfo = {
  "0x8a810ea8b121d08342e9e7696f4a9915cbe494b7": { symbol:"PLS",   icon:"../assets/pls.svg" },
  "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39": { symbol:"PLSX",  icon:"../assets/plsx.svg" },
  "0x6efafcb715f385c71d8af763e8478feea6fadf63": { symbol:"HEX",   icon:"../assets/hex.svg" },
  "0xa210f95d665bb4537434be96d9a2866cca629d5b": { symbol:"INC",   icon:"../assets/inc.svg" },
  "0x0154179238926e9d5ab4035803c2788457da3ae2": { symbol:"pDAI",  icon:"../assets/pdai.svg" },
  "0xe929f41b8092fe74811577a004c9700843e86ce1": { symbol:"Atropa",icon:"../assets/atropa.svg" },
  "0xfaecd753896be6b9c946cef01ce2feffe4f3dd0f": { symbol:"Teddy", icon:"../assets/teddy.png" },
  "0x1f75a0c8cea75420f56598d429e0d82a0961261e": { symbol:"Alien", icon:"../assets/alien.png" }
};

document.addEventListener("DOMContentLoaded", async () => {
  // ── 1) Wallet Connect Button ─────────────────────────────
  const connectBtn = document.getElementById("connect-btn");
  if (connectBtn && window.ethereum) {
    try { await window.ethereum.request({ method:"eth_requestAccounts" }); } catch{}
    async function updateBtn() {
      const accts = await window.ethereum.request({ method:"eth_accounts" });
      if (accts.length) {
        connectBtn.textContent = truncateAddress(accts[0]);
        connectBtn.classList.add("connected");
      } else {
        connectBtn.textContent = "Connect wallet";
        connectBtn.classList.remove("connected");
      }
    }
    connectBtn.addEventListener("click", updateBtn);
    window.ethereum.on("accountsChanged", updateBtn);
    await updateBtn();
  }

  // ── 2) Load ABIs & instantiate JackStake ─────────────────
  // const [jackStakeAbi, ERC20Abi] = await Promise.all([
  //   loadAbi("abis/JackStake.json"),
  //   loadAbi("abis/IERC20.json")
  // ]);

  const [jackStakeAbi] = await Promise.all([ loadAbi("JackStake.json", loadAbi("IERC20.json")) ]);
  

  const provider      = new ethers.providers.Web3Provider(window.ethereum);
  const signer        = provider.getSigner();
  const STAKE_ADDR    = "0x3d50A5EE9ef8C078A86a26161792da5D388A35Fa";
  const jackStakeRead = new ethers.Contract(STAKE_ADDR, jackStakeAbi, provider);
  const jackStake     = new ethers.Contract(STAKE_ADDR, jackStakeAbi, signer);

  // ── 3) Load & render pools + APY ─────────────────────────
  async function loadStakeConfig() {
    try {
      const [user] = await window.ethereum.request({ method:"eth_accounts" });
      const dailyW = await jackStakeRead.externalJackDaily();
      const dailyJ = Number(ethers.utils.formatUnits(dailyW,18));
      const pools  = await jackStakeRead.getExternalPools();
      if (!pools.length) return console.warn("No pools");

      const data = await Promise.all(pools.map(async t => {
        const [tW,uW] = await Promise.all([
          jackStakeRead.totalStakedExternal(t),
          jackStakeRead.userStakeExternal(t,user)
        ]);
        return {
          addr:  t,
          total: Number(ethers.utils.formatUnits(tW,18)),
          user:  Number(ethers.utils.formatUnits(uW,18))
        };
      }));

      const perDay  = dailyJ / data.length;
      const annualJ = perDay * 365;
      data.forEach(d => d.apy = d.total>0 ? (annualJ/d.total)*100 : 0);
      const topApy = Math.max(...data.map(d=>d.apy));

      const tbody = document.getElementById("pools-body");
      tbody.innerHTML = "";
      data.forEach(d => {
        const info  = tokenInfo[d.addr.toLowerCase()]||{};
        const icon  = info.icon ? `<img src="${info.icon}" class="token-icon">` : "";
        const sym   = info.symbol || "–";
        const badge = Math.abs(d.apy-topApy)<1e-6 ? "🦄" : "";
        const tr    = document.createElement("tr");
        tr.innerHTML = `
          <td>${icon}</td>
          <td>${sym}</td>
          <td>${d.apy.toFixed(2)}%</td>
          <td>${d.total.toLocaleString()}</td>
          <td class="badge-cell">${badge}</td>
          <td>${d.user.toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch(e) {
      console.error("Failed loading pools", e);
    }
  }
  loadStakeConfig();

  // ── 4) Carrot ↔ Paw Tabs ──────────────────────────────────
  const cTab = document.getElementById("carrot-tab"),
        pTab = document.getElementById("paw-tab");
  if (cTab && pTab) {
    function activate(t){
      cTab.classList.remove("active");
      pTab.classList.remove("active");
      t.classList.add("active");
    }
    cTab.addEventListener("click", ()=>{ activate(cTab); window.location.href="index.html"; });
    pTab.addEventListener("click", ()=>{ activate(pTab); window.location.href="jackies.html"; });
  }

  // ── 5) Modal logic: amount ↔ search ───────────────────────
  const modal        = document.getElementById("action-modal"),
        overlay      = modal.querySelector(".modal-overlay"),
        closeBtn     = modal.querySelector(".modal-close"),
        titleEl      = modal.querySelector(".modal-title"),
        amtInput     = modal.querySelector("#modal-amount"),
        balContainer = modal.querySelector(".modal-balance"),
        balEl        = balContainer.querySelector("#modal-balance"),
        confirmBtn   = modal.querySelector("#modal-action-btn"),
        pillField    = modal.querySelector(".token-field"),
        symbolSpan   = modal.querySelector("#modal-token-symbol"),
        searchInput  = modal.querySelector("#modal-search"),
        searchList   = modal.querySelector("#modal-search-list"),
        origRow      = modal.querySelector(".modal-input-row"),
        modalFooter  = modal.querySelector(".modal-footer");

// ensure dropdown sits above everything
  searchList.style.zIndex = "1001";

// fake balances
  const fakeBal = {
    pls:435575, plsx:1234567, hex:987654, inc:765432,
    pdai:543210, atropa:432109, teddy:321098, alien:210987
  };

// populate dropdown
  function populateList(){
    searchList.innerHTML = "";
    Object.values(tokenInfo).forEach(info => {
      const div = document.createElement("div");
      div.className    = "search-item";
      div.dataset.sym  = info.symbol.toLowerCase();
      div.innerHTML    = `<img src="${info.icon}" class="token-icon"> ${info.symbol}`;
      div.addEventListener("click", () => {
        // update pill
        modal.querySelector("#modal-token-icon").src = info.icon;
        symbolSpan.textContent = info.symbol;
        balEl.textContent      = fakeBal[info.symbol.toLowerCase()]||0;
        titleEl.textContent    = `Stake ${info.symbol}!!!`;

        // restore view
        searchInput.classList.add("hidden");
        searchList.classList.add("hidden");
        amtInput.classList.remove("hidden");
        confirmBtn.style.visibility   = "visible";
        balContainer.style.visibility = "visible";
        modalFooter.style.display     = "";
      });
      searchList.append(div);
    });
  }

// open / close modal
  function openModal(isStake) {
    titleEl.textContent    = isStake ? "Stake PLS!!!" : "Unstake!!!";
    confirmBtn.textContent = isStake ? "Confirm Stake" : "Confirm Unstake";
    amtInput.value         = "";

    amtInput.classList.remove("hidden");
    searchInput.classList.add("hidden");
    searchList.classList.add("hidden");
    confirmBtn.style.visibility   = "visible";
    balContainer.style.visibility = "visible";
    modalFooter.style.display     = "";
    modal.classList.remove("hidden");
  }
  function closeModal(){
    modal.classList.add("hidden");
  }

  document.querySelectorAll(".tab.stake, .tab.unstake")
    .forEach(btn => btn.addEventListener("click", () => openModal(btn.classList.contains("stake"))));
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", closeModal);

// switch to search
  pillField.addEventListener("click", () => {
    amtInput.classList.add("hidden");
    searchInput.classList.remove("hidden");
    searchList.classList.remove("hidden");
    confirmBtn.style.visibility   = "hidden";
    balContainer.style.visibility = "hidden";
    modalFooter.style.display     = "none";
    populateList();
    searchInput.focus();
  });

// live-filter
  searchInput.addEventListener("input", e => {
    const val = e.target.value.toLowerCase();
    Array.from(searchList.children).forEach(item => {
      item.style.display = item.dataset.sym.startsWith(val) ? "" : "none";
    });
  });

// ── 6) Confirm → approve & stake ─────────────────────────
  confirmBtn.addEventListener("click", async () => {
    try {
      // identify token address
      const iconSrc = modal.querySelector("#modal-token-icon").src;
      const tokenAddr = Object.entries(tokenInfo)
        .find(([_,i]) => i.icon === iconSrc)[0];

      const amt = amtInput.value;
      if (!amt || Number(amt) <= 0)
        throw new Error("Enter a valid amount");
      const amountWei = ethers.utils.parseUnits(amt, 18);

      if (tokenInfo[tokenAddr].symbol !== "PLS") {
        // ERC-20 approval
        const token = new ethers.Contract(tokenAddr, erc20Abi, signer);
        const current = await token.allowance(await signer.getAddress(), STAKE_ADDR);
        if (current.lt(amountWei)) {
          const txA = await token.approve(STAKE_ADDR, amountWei);
          await txA.wait();
        }
        // stake
        const tx = await jackStake.stakeExternal(tokenAddr, amountWei);
        await tx.wait();
      } else {
        // native PLS
        const tx = await jackStake.stakeExternal(tokenAddr, amountWei, { value: amountWei });
        await tx.wait();
      }

      alert("Staked successfully!");
      closeModal();
      loadStakeConfig();
    } catch (err) {
      console.error(err);
      alert("Error: " + (err.message||err));
    }
  });

});
