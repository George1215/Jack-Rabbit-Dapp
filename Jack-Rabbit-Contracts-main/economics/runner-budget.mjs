// Scenario arithmetic only: no live gas price, adoption or revenue forecast.
const uint = value => {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) throw Error('Use unsigned integer strings');
  return BigInt(value);
};
const ceil = (n, d) => (n + d - 1n) / d;
export function runnerBudget(input) {
  const updateGas = uint(input.updateGas), claimGas = uint(input.claimGas);
  const gasPrice = uint(input.gasPriceWei), updates = uint(input.updatesPerDay);
  const premium = uint(input.premiumBps), reserve = uint(input.plsRewardReserveWei);
  const allocated = uint(input.runnerShareBps), balance = uint(input.availableRunnerBudgetWei);
  if (allocated > 10000n || premium > 10000n || typeof input.hasEligibleJackStake !== 'boolean') throw Error('Invalid scenario');
  // Conservatively charge one withdrawal per update; failed competing submissions are not modeled.
  const reward = ceil((updateGas + claimGas) * gasPrice * (10000n + premium), 10000n);
  const dailyCost = reward * updates;
  const grossEmission = input.hasEligibleJackStake ? reserve * 140n / 1000000n : 0n;
  const fees = grossEmission * 100n / 1000n;
  const dailyIncome = fees * allocated / 10000n;
  const requiredFees = allocated === 0n ? null : ceil(dailyCost * 10000n, allocated);
  const requiredReserve = requiredFees === null ? null : ceil(requiredFees * 10n * 1000000n, 140n);
  return {
    status: 'SCENARIO_ONLY', rewardPerUpdateWei: String(reward), dailyCostWei: String(dailyCost),
    firstDayFeeIncomeWei: String(fees), firstDayRunnerIncomeWei: String(dailyIncome),
    firstDayShortfallWei: String(dailyCost > dailyIncome ? dailyCost - dailyIncome : 0n),
    fundedUpdatesWithoutNewIncome: reward === 0n ? null : String(balance / reward),
    requiredOpeningPlsRewardReserveWei: requiredReserve === null ? null : String(requiredReserve),
    equivalentNominalPlsStakeWei: requiredReserve === null ? null : String(ceil(requiredReserve * 10000n, 250n)),
  };
}
