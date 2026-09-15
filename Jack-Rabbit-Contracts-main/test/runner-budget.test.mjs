import test from 'node:test';
import assert from 'node:assert/strict';
import { runnerBudget } from '../economics/runner-budget.mjs';
const scenario = () => ({ updateGas: '300000', claimGas: '40000', gasPriceWei: '1000000000', updatesPerDay: '24',
  premiumBps: '2000', plsRewardReserveWei: '2500000000000000000', runnerShareBps: '5000',
  availableRunnerBudgetWei: '17500000000000', hasEligibleJackStake: true });
test('Runner scenarios price both calls, cap funded work and expose native fee shortfalls', () => {
  const r = runnerBudget(scenario());
  assert.equal(r.rewardPerUpdateWei, '408000000000000');
  assert.equal(r.dailyCostWei, '9792000000000000');
  assert.equal(r.firstDayFeeIncomeWei, '35000000000000');
  assert.equal(r.firstDayRunnerIncomeWei, '17500000000000');
  assert.equal(r.firstDayShortfallWei, '9774500000000000');
  assert.equal(r.fundedUpdatesWithoutNewIncome, '0');
  const funded = runnerBudget({ ...scenario(), plsRewardReserveWei: r.requiredOpeningPlsRewardReserveWei });
  assert(BigInt(funded.firstDayRunnerIncomeWei) >= BigInt(r.dailyCostWei));
  const under = runnerBudget({ ...scenario(), plsRewardReserveWei: String(BigInt(r.requiredOpeningPlsRewardReserveWei) - 1n) });
  assert(BigInt(under.firstDayRunnerIncomeWei) < BigInt(r.dailyCostWei));
});
test('Runner scenarios require eligible stakers and do not infer income or infinite funded work', () => {
  assert.equal(runnerBudget({ ...scenario(), hasEligibleJackStake: false }).firstDayRunnerIncomeWei, '0');
  assert.equal(runnerBudget({ ...scenario(), runnerShareBps: '0' }).requiredOpeningPlsRewardReserveWei, null);
  assert.equal(runnerBudget({ ...scenario(), gasPriceWei: '0' }).fundedUpdatesWithoutNewIncome, null);
  assert.throws(() => runnerBudget({ ...scenario(), runnerShareBps: '10001' }));
  assert.throws(() => runnerBudget({ ...scenario(), gasPriceWei: '1.5' }));
});
