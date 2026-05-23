import { WhatIfInput, WhatIfResult, IncomeStats, ExpenseStats, SavingsPlan, UserProfile } from "../types";
import { computeHealthScore } from "./health-score";

export function simulateWhatIf(
  input: WhatIfInput,
  incomeStats: IncomeStats,
  expenseStats: ExpenseStats,
  savingsPlan: SavingsPlan,
  userProfile: UserProfile
): WhatIfResult {
  const monthlyDelta = input.unit === "week" ? input.amount * 4.33 : input.amount;

  const baselineSurplus = incomeStats.averageMonthly - expenseStats.totalLast30Days;
  const baselineSavingsRate = savingsPlan.savingsRate;
  const baselineMonthsToGoal = savingsPlan.monthsToGoal;
  const baselineHealthScore = incomeStats.healthScore?.score || computeHealthScore(incomeStats.averageMonthly, userProfile.monthly_fixed_expenses, baselineSurplus).score;

  let simSurplus = baselineSurplus;
  let simSavings = baselineSurplus;
  let simIncome = incomeStats.averageMonthly;
  let simMonthsToGoal = baselineMonthsToGoal;

  if (input.type === "extra_saving") {
    simSavings += monthlyDelta;
    simMonthsToGoal = Math.ceil((userProfile.savings_goal.target - userProfile.savings_goal.current) / Math.max(simSavings, 1));
  } else if (input.type === "expense_reduction") {
    simSurplus += monthlyDelta;
    simSavings += monthlyDelta;
    simMonthsToGoal = Math.ceil((userProfile.savings_goal.target - userProfile.savings_goal.current) / Math.max(simSavings, 1));
  } else if (input.type === "income_change") {
    simSurplus += monthlyDelta;
    simIncome += monthlyDelta;
    simSavings += monthlyDelta;
    simMonthsToGoal = Math.ceil((userProfile.savings_goal.target - userProfile.savings_goal.current) / Math.max(simSavings, 1));
  } else if (input.type === "goal_change") {
    const newTarget = input.amount;
    simMonthsToGoal = Math.ceil((newTarget - userProfile.savings_goal.current) / Math.max(simSavings, 1));
  }

  // Realism check
  let isRealistic = true;
  let unrealisticReason: string | undefined;

  if (input.type === "extra_saving" || input.type === "expense_reduction") {
    if (monthlyDelta > baselineSurplus * 0.9) {
      isRealistic = false;
      unrealisticReason = `That amount exceeds your current surplus of ₹${Math.round(baselineSurplus)}`;
    }
  }

  const simSavingsRate = simIncome > 0 ? (simSavings / simIncome) : 0;
  // compute simulated health score
  const simHealthScore = computeHealthScore(simIncome, expenseStats.totalLast30Days, simSavings).score;

  return {
    baseline: {
      monthlySurplus: Math.round(baselineSurplus),
      savingsRate: Math.round(baselineSavingsRate * 100) / 100, // round to 2 decimals
      monthsToGoal: baselineMonthsToGoal,
      healthScore: baselineHealthScore
    },
    simulated: {
      monthlySurplus: Math.round(simSurplus),
      savingsRate: Math.round(simSavingsRate * 100) / 100,
      monthsToGoal: simMonthsToGoal,
      healthScore: simHealthScore
    },
    delta: {
      surplusChange: Math.round(simSurplus - baselineSurplus),
      savingsRateChange: Math.round((simSavingsRate - baselineSavingsRate) * 100),
      monthsToGoalChange: simMonthsToGoal - baselineMonthsToGoal,
      healthScoreChange: simHealthScore - baselineHealthScore
    },
    isRealistic,
    unrealisticReason
  };
}
