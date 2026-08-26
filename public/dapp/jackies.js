// jackies.js (included after dapp.js)
document.querySelectorAll('.tab.stake, .tab.unstake').forEach(btn => {
    btn.addEventListener('click', () => {
      const isStake = btn.classList.contains('stake');
      // set the title/button text explicitly for Jackies:
      document.querySelector('#action-modal .modal-title').textContent =
        isStake ? 'Stake Jack' : 'Unstake Jack';
      document.querySelector('#modal-action-btn').textContent =
        isStake ? 'Confirm Stake' : 'Confirm Unstake';
  
      // set the fixed Jack icon & balance:
      document.getElementById('modal-token-icon').src = '../assets/jacklogo.png';
      document.getElementById('modal-balance').textContent = '3,245,346'; // pull real data here
  
      // show it:
      document.getElementById('action-modal').classList.remove('hidden');
    });
  });
  