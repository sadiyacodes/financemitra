import { ScenarioInput, ScenarioResult, IncomeStats, ExpenseStats, SavingsPlan } from "../types";

export function compareScenarios(
  input: ScenarioInput,
  incomeStats: IncomeStats,
  expenseStats: ExpenseStats,
  savingsPlan: SavingsPlan
): ScenarioResult {
  const itemCost = input.itemCost;
  const interestRate = input.interestRate || 0.18;
  const surplus = incomeStats.averageMonthly - expenseStats.totalLast30Days;
  const currentMonthlySaving = savingsPlan.recommendedMonthlySaving;

  // OPTION A — EMI path
  let emiAmount = input.emiAmount;
  let emiMonths = input.emiMonths;

  if (!emiAmount && emiMonths) {
    const monthlyRate = interestRate / 12;
    emiAmount = itemCost * (monthlyRate * Math.pow(1 + monthlyRate, emiMonths)) / (Math.pow(1 + monthlyRate, emiMonths) - 1);
  } else if (!emiMonths && emiAmount) {
     emiMonths = Math.ceil((itemCost * (1 + interestRate)) / emiAmount);
  } else if (!emiAmount && !emiMonths) {
     emiMonths = 12; // Default 1 year
     const monthlyRate = interestRate / 12;
     emiAmount = itemCost * (monthlyRate * Math.pow(1 + monthlyRate, emiMonths)) / (Math.pow(1 + monthlyRate, emiMonths) - 1);
  }
  emiAmount = emiAmount!;
  emiMonths = emiMonths!;

  const totalInterest = (emiAmount * emiMonths) - itemCost;
  const optionATotalCost = itemCost + totalInterest;

  const newSurplusForA = surplus - emiAmount;
  let optionAGoalDelay = 0;
  if (newSurplusForA > 0) {
     const targetRemaining = savingsPlan.monthsToGoal * currentMonthlySaving; 
     const newMonths = Math.ceil(targetRemaining / newSurplusForA);
     optionAGoalDelay = Math.max(0, newMonths - savingsPlan.monthsToGoal);
  } else {
     optionAGoalDelay = 999;
  }

  let optionASlowMonthRisk: "High" | "Medium" | "Low" = "Low";
  const lowestMonthIncome = incomeStats.lowestMonth.amount;
  if (emiAmount > lowestMonthIncome * 0.25) {
    optionASlowMonthRisk = "High";
  } else if (emiAmount > lowestMonthIncome * 0.15) {
    optionASlowMonthRisk = "Medium";
  }

  // OPTION B — Save up path
  const optionBMonthlyImpact = itemCost / Math.max(1, savingsPlan.monthsToGoal);
  const alternativeSavingMonthly = surplus > currentMonthlySaving ? surplus - currentMonthlySaving : surplus * 0.2;
  const monthsUntilAffordable = Math.ceil(itemCost / Math.max(alternativeSavingMonthly, 1));
  const optionBGoalDelay = 0;

  let optionBSlowMonthRisk: "High" | "Medium" | "Low" = "Low";
  if (optionBMonthlyImpact > lowestMonthIncome * 0.25) {
    optionBSlowMonthRisk = "High";
  } else if (optionBMonthlyImpact > lowestMonthIncome * 0.15) {
    optionBSlowMonthRisk = "Medium";
  }

  const tooRiskyForBoth = (incomeStats.healthScore?.score || 100) < 40 || surplus < 0;
  
  let verdict = "";
  if (tooRiskyForBoth) {
     verdict = `Neither option is safe right now given your ₹${Math.round(surplus)} surplus.`;
  } else if (optionASlowMonthRisk === "High") {
     verdict = "Save up first — the EMI is too risky on your variable income, especially in slow months.";
  } else if (monthsUntilAffordable > 18) {
     verdict = "The EMI path is faster and the risk is manageable given your income stability.";
  } else if (optionATotalCost - itemCost > itemCost * 0.15) {
     verdict = `Saving up saves you ₹${Math.round(totalInterest)} in interest — worth the wait given your timeline.`;
  } else {
     verdict = `Both paths are workable. The EMI is faster but costs ₹${Math.round(totalInterest)} more.`;
  }

  return {
    optionA: {
      label: "Buy on EMI",
      totalCost: Math.round(optionATotalCost),
      monthlyImpact: Math.round(emiAmount),
      goalDelayMonths: optionAGoalDelay,
      slowMonthRisk: optionASlowMonthRisk,
      interestPaid: Math.round(totalInterest),
      assumedInterestRate: interestRate
    },
    optionB: {
      label: "Save up first",
      totalCost: itemCost,
      monthlyImpact: Math.round(optionBMonthlyImpact),
      monthsUntilAffordable: monthsUntilAffordable,
      goalDelayMonths: optionBGoalDelay,
      slowMonthRisk: optionBSlowMonthRisk
    },
    verdict,
    tooRiskyForBoth
  };
}
