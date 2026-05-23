import { HealthScore } from "../types";

export function computeHealthScore(
  monthlyIncome: number,
  monthlyExpenses: number,
  monthlySavings: number
): HealthScore {
  const savingsRate = monthlySavings / monthlyIncome;
  const expenseRatio = monthlyExpenses / monthlyIncome;

  const savingsRateScore = Math.min((savingsRate / 0.20) * 50, 50);
  const expenseRatioScore = Math.min(((1 - expenseRatio) / 0.50) * 50, 50);
  const score = Math.round(Math.max(0, Math.min(100, savingsRateScore + expenseRatioScore)));

  const label =
    score >= 75 ? "Healthy" :
    score >= 50 ? "Moderate" :
    score >= 25 ? "Stretched" : "Critical";

  const color =
    score >= 75 ? "green" :
    score >= 50 ? "amber" :
    score >= 25 ? "orange" : "red";

  return { score, label, color, savingsRateScore, expenseRatioScore, savingsRate, expenseRatio };
}
