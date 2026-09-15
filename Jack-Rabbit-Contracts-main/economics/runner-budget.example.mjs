import { runnerBudget } from './runner-budget.mjs';
const input = {
  updateGas: '300000', claimGas: '40000', gasPriceWei: '1000000000', updatesPerDay: '24',
  premiumBps: '2000', plsRewardReserveWei: '2500000000000000000', runnerShareBps: '5000',
  availableRunnerBudgetWei: '17500000000000', hasEligibleJackStake: true,
};
console.log(JSON.stringify({ assumptions: 'Illustrative rounded gas allowances, hypothetical 1 gwei, one update/hour; not production settings or live gas data.', input, result: runnerBudget(input) }, null, 2));
