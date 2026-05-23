import { Transaction, IncomeStats, WeeklyDigest } from "../types";

export function generateWeeklyDigest(
  transactions: Transaction[],
  incomeStats: IncomeStats
): WeeklyDigest {
  const sortedTxns = [...transactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const now = sortedTxns.length ? new Date(sortedTxns[sortedTxns.length - 1].date) : new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const weekTxns = transactions.filter(t => new Date(t.date) > sevenDaysAgo && new Date(t.date) <= now);
  
  let incomeThisWeek = 0;
  let spentThisWeek = 0;
  
  const incomeByDay = new Map<string, number>();
  const spendByCategory = new Map<string, number>();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (const t of weekTxns) {
    if (t.type === "income") {
      incomeThisWeek += t.amount;
      const d = dayNames[new Date(t.date).getDay()];
      incomeByDay.set(d, (incomeByDay.get(d) || 0) + t.amount);
    } else if (t.type === "expense") {
      spentThisWeek += t.amount;
      spendByCategory.set(t.category, (spendByCategory.get(t.category) || 0) + t.amount);
    }
  }

  const surplusThisWeek = incomeThisWeek - spentThisWeek;
  
  const incomeVsAverage = incomeStats.averageWeekly > 0 
    ? Math.round(((incomeThisWeek - incomeStats.averageWeekly) / incomeStats.averageWeekly) * 100)
    : 0;

  let bestEarningDay = "None";
  let bestDayAmt = -1;
  for (const [day, amt] of Array.from(incomeByDay.entries())) {
    if (amt > bestDayAmt) {
      bestDayAmt = amt;
      bestEarningDay = day;
    }
  }

  let biggestSpendCategory = "None";
  let biggestSpendAmount = 0;
  for (const [cat, amt] of Array.from(spendByCategory.entries())) {
    if (amt > biggestSpendAmount) {
      biggestSpendAmount = amt;
      biggestSpendCategory = cat;
    }
  }

  // Notable Observation:
  // 1. check last 4 weeks. incomeStats.incomeByWeek has recent weeks.
  const last4Weeks = incomeStats.incomeByWeek.slice(-4);
  const isHighestIn4Weeks = last4Weeks.every(w => incomeThisWeek >= w.total) && last4Weeks.length > 0 && incomeThisWeek > 0;
  
  let notableObservation = "A steady week, close to your usual pattern.";
  if (isHighestIn4Weeks) {
    notableObservation = "Your best earning week in the last month.";
  } else if (biggestSpendAmount > spentThisWeek * 0.40 && spentThisWeek > 0) {
    notableObservation = `${biggestSpendCategory} dominated your spending this week.`;
  } else if (surplusThisWeek < 0) {
    notableObservation = "You spent more than you earned this week.";
  } else if (incomeVsAverage > 20) {
    notableObservation = `Strong week — you earned ${incomeVsAverage}% above your average.`;
  } else if (incomeVsAverage < -20) {
    notableObservation = `Quiet week — income was ${Math.abs(incomeVsAverage)}% below your average.`;
  }

  const weekLabel = `${sevenDaysAgo.toLocaleString('default', { month: 'short' })} ${sevenDaysAgo.getDate()} – ${now.toLocaleString('default', { month: 'short' })} ${now.getDate()}`;

  return {
    incomeThisWeek,
    incomeVsAverage,
    spentThisWeek,
    surplusThisWeek,
    bestEarningDay,
    biggestSpendCategory,
    biggestSpendAmount,
    notableObservation,
    weekLabel
  };
}
