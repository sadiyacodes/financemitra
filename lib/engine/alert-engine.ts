import { IncomeStats, ExpenseStats, SavingsPlan, IncomeForecast, UserProfile, Alert } from "../types";

export function generateAlerts(
  incomeStats: IncomeStats,
  expenseStats: ExpenseStats,
  savingsPlan: SavingsPlan,
  forecast: IncomeForecast,
  userProfile: UserProfile
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  // Helper to add alerts
  const addAlert = (severity: Alert['severity'], type: string, title: string, message: string, actionSuggestion: string) => {
    alerts.push({ id: `alert_${Date.now()}_${alerts.length}`, severity, type, title, message, actionSuggestion, triggeredAt: now });
  };

  // ALERT_01: This week income < 70% of weekly average
  const lastWeekIncome = incomeStats.incomeByWeek.length > 0 ? incomeStats.incomeByWeek[incomeStats.incomeByWeek.length - 1].total : 0;
  if (incomeStats.averageWeekly > 0 && lastWeekIncome < incomeStats.averageWeekly * 0.7) {
    const drop = Math.round((1 - (lastWeekIncome / incomeStats.averageWeekly)) * 100);
    addAlert("warning", "low_income_week", "Slow Earnings Week", `Slow week — you earned ${drop}% less than usual.`, "Review expenses and try to hold off on non-essential spending for 3 days.");
  }

  // ALERT_02: Goal progress behind schedule by > 20%
  // Approximated by savings plan timeframe
  if (savingsPlan.isGoalRealistic && savingsPlan.monthsToGoal > 1) {
    const elapsedPcnt = userProfile.savings_goal.current / userProfile.savings_goal.target;
    // mock logic: if the target date is close but pcnt is low, warn. For simple testing we randomly trigger or trigger based on mock metrics.
    if (elapsedPcnt < 0.5 && savingsPlan.monthsToGoal < 6) {
      addAlert("warning", "goal_behind", "Goal Behind Target", `Your ${userProfile.savings_goal.label} is falling behind — consider saving extra this week.`, "Can you pick up one extra gig this weekend?");
    }
  }

  // ALERT_03: Current surplus < 10% of income
  const isTightBudget = incomeStats.averageMonthly > 0 && savingsPlan.currentSurplus < incomeStats.averageMonthly * 0.1;
  if (isTightBudget) {
    addAlert("urgent", "low_surplus", "Tight Budget Month", "Your expenses are eating almost all your income this month.", "Immediately review your recurring fixed expenses for cuts.");
  }

  // ALERT_04: No income logged in last 3 days (non-vendor)
  if (userProfile.type.includes("freelance") || userProfile.type.includes("driver")) {
      // In real code we check transactions dates.
  }

  // ALERT_05: Last month was above-average (Only trigger if NO tight budget)
  if (!isTightBudget && incomeStats.highestMonth.month !== "" && incomeStats.averageMonthly > 0 && incomeStats.highestMonth.amount > incomeStats.averageMonthly * 1.2) {
    const extra = Math.round(incomeStats.highestMonth.amount - incomeStats.averageMonthly);
    addAlert("info", "goal_boost", "Great Earnings Month", `Great month! You could fast-track your ${userProfile.savings_goal.label} by putting aside ₹${extra} extra.`, "Transfer this extra amount to your savings account right now.");
  }

  // ALERT_06: Single expense > 30% of weekly income
  if (expenseStats.unusualSpikes.length > 0) {
    for (const spike of expenseStats.unusualSpikes) {
      if (spike.amount > incomeStats.averageWeekly * 0.3) {
        addAlert("warning", "large_expense", "Large Expense Detected", `Large spend detected in ${spike.category} — was this planned?`, "If unplanned, review your weekly cash limits to recover.");
        break; // just add one
      }
    }
  }

  // ALERT_07: Forecast shows next month income < lowestMonth
  if (forecast.nextMonthEstimate.mid > 0 && forecast.nextMonthEstimate.mid < incomeStats.lowestMonth.amount) {
    addAlert("urgent", "forecast_warning", "Forecast Warning", "Your slow season may be coming — start building a buffer now.", "Stash away an extra 10% this week into emergency savings.");
  }

  // ALERT_08: Emergency fund < 1 month of expenses
  // Assuming the user's emergency fund is either their current goal if labeled emergency, or we check global balance.
  // We'll mock this by checking if they are the 'Emergency fund' goal user and it is below fixed expenses.
  if (userProfile.savings_goal.label.toLowerCase().includes("emergency") && userProfile.savings_goal.current < userProfile.monthly_fixed_expenses) {
    addAlert("urgent", "critical_emergency", "Emergency Fund Critical", "Your emergency fund covers less than 1 month — prioritize this.", "Pause all discretionary saving and direct everything here.");
  }

  return alerts;
}
