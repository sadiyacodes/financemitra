import { IncomeStats, ExpenseStats, SavingsPlan } from "../types";

export function planSavings(
  incomeStats: IncomeStats,
  expenseStats: ExpenseStats,
  goal: { target: number; current: number; label: string }
): SavingsPlan {
  const currentSurplus = incomeStats.averageMonthly - expenseStats.fixedExpenses;
  
  // Do NOT recommend saving more than 40% of surplus
  let maxSaveMonthly = currentSurplus > 0 ? currentSurplus * 0.4 : 0;
  
  const shortfall = goal.target - goal.current;
  
  let recommendedMonthlySaving = 0;
  let monthsToGoal = Infinity;

  if (maxSaveMonthly > 0 && shortfall > 0) {
    recommendedMonthlySaving = Math.min(shortfall > 1 ? shortfall / 12 : maxSaveMonthly, maxSaveMonthly); // simplified logic: stretch over 12 months, or use max save
    monthsToGoal = Math.ceil(shortfall / recommendedMonthlySaving);
  }

  const isGoalRealistic = monthsToGoal > 0 && monthsToGoal <= 36;
  const recommendedWeeklySaving = recommendedMonthlySaving / 4.33; // approx weeks per month

  // adjusted plan for slow months using lowest month
  const slowSurplus = incomeStats.lowestMonth.amount - expenseStats.fixedExpenses;
  const adjustedPlanForSlowMonths = slowSurplus > 0 ? slowSurplus * 0.4 : 0;

  // adjusted plan for good months using highest month
  const bestSurplus = incomeStats.highestMonth.amount - expenseStats.fixedExpenses;
  const adjustedPlanForGoodMonths = bestSurplus > 0 ? bestSurplus * 0.4 : 0;

  const targetDate = new Date();
  if (isGoalRealistic) {
    targetDate.setMonth(targetDate.getMonth() + monthsToGoal);
  }

  const savingsRate = incomeStats.averageMonthly > 0 ? (recommendedMonthlySaving / incomeStats.averageMonthly) * 100 : 0;

  const warnings: string[] = [];
  if (currentSurplus <= 0) {
    warnings.push("Current spending leaves no savings room. You are relying on variable income to meet fixed expenses.");
  } else if (!isGoalRealistic && shortfall > 0) {
    warnings.push("This goal may take over 3 years. Consider extending the timeline or finding ways to increase monthly surplus.");
  }
  if (adjustedPlanForSlowMonths <= 0) {
    warnings.push("In your slow months, you cannot afford to save. Ensure you have a buffer.");
  }

  return {
    recommendedMonthlySaving: Math.round(recommendedMonthlySaving),
    recommendedWeeklySaving: Math.round(recommendedWeeklySaving),
    monthsToGoal,
    weeksToGoal: Math.round(monthsToGoal * 4.33),
    adjustedPlanForSlowMonths: Math.round(adjustedPlanForSlowMonths),
    adjustedPlanForGoodMonths: Math.round(adjustedPlanForGoodMonths),
    currentSurplus: Math.round(currentSurplus),
    savingsRate: Math.round(savingsRate),
    isGoalRealistic,
    realisticTargetDate: isGoalRealistic ? targetDate.toISOString() : "",
    warnings
  };
}
