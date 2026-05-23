import { Transaction, ExpenseStats } from "../types";

export function trackExpenses(transactions: Transaction[], userId: string): ExpenseStats {
  const userTxns = transactions.filter(t => t.user_id === userId && t.type === "expense");

  if (userTxns.length === 0) {
    return {
      totalLast30Days: 0,
      totalLast90Days: 0,
      byCategory: [],
      fixedExpenses: 0,
      variableExpenses: 0,
      trend: "stable",
      largestCategory: "",
      unusualSpikes: []
    };
  }

  const sortedTxns = [...userTxns].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const latestDateStr = sortedTxns[sortedTxns.length - 1].date;
  const latestDate = new Date(latestDateStr);

  const thirtyDaysAgo = new Date(latestDate); thirtyDaysAgo.setDate(latestDate.getDate() - 30);
  const sixtyDaysAgo = new Date(latestDate); sixtyDaysAgo.setDate(latestDate.getDate() - 60);

  let total30 = 0;
  let totalPrior30 = 0; // days 31-60
  let total90 = 0;

  const month1Categories = new Map<string, number>(); // last 30
  const month2Categories = new Map<string, number>(); // 31-60
  const month3Categories = new Map<string, number>(); // 61-90

  for (const t of sortedTxns) {
    const d = new Date(t.date);
    total90 += t.amount;

    if (d >= thirtyDaysAgo) {
      total30 += t.amount;
      month1Categories.set(t.category, (month1Categories.get(t.category) || 0) + t.amount);
    } else if (d >= sixtyDaysAgo) {
      totalPrior30 += t.amount;
      month2Categories.set(t.category, (month2Categories.get(t.category) || 0) + t.amount);
    } else {
      month3Categories.set(t.category, (month3Categories.get(t.category) || 0) + t.amount);
    }
  }

  let fixedExpenses = 0;
  let variableExpenses = 0;

  const allCategories = new Set([...Array.from(month1Categories.keys()), ...Array.from(month2Categories.keys()), ...Array.from(month3Categories.keys())]);
  const byCategory: { category: string; total: number; percentage: number }[] = [];

  let largestCategory = "";
  let largestAmt = -1;

  for (const cat of Array.from(allCategories)) {
    const m1 = month1Categories.get(cat) || 0;
    const m2 = month2Categories.get(cat) || 0;
    const m3 = month3Categories.get(cat) || 0;
    const totalCat = m1 + m2 + m3;
    
    if (totalCat > largestAmt) {
      largestAmt = totalCat;
      largestCategory = cat;
    }

    if (total90 > 0) {
      byCategory.push({ category: cat, total: totalCat, percentage: (totalCat / total90) * 100 });
    }

    // Check fixed: occurs in all 3 months within +/- 15% variance
    if (m1 > 0 && m2 > 0 && m3 > 0) {
      const avg = (m1 + m2 + m3) / 3;
      const maxDiff = Math.max(Math.abs(m1 - avg), Math.abs(m2 - avg), Math.abs(m3 - avg));
      if (maxDiff / avg <= 0.15) {
        fixedExpenses += m1; // Add this month's amount to fixed estimation
        continue;
      }
    }
    variableExpenses += m1;
  }

  let trend: "increasing" | "stable" | "decreasing" = "stable";
  if (total30 > totalPrior30 * 1.1) trend = "increasing";
  else if (total30 < totalPrior30 * 0.9) trend = "decreasing";

  // Unusual spikes: single transaction > 2x the 30-day average for that category
  const unusualSpikes: { date: string; category: string; amount: number; reason: string }[] = [];
  const m1CatAverages = new Map<string, number>();
  for (const [cat, total] of Array.from(month1Categories.entries())) {
    // approximating average per transaction in this category
    const txnsInCatMonth1 = sortedTxns.filter(t => t.category === cat && new Date(t.date) >= thirtyDaysAgo);
    m1CatAverages.set(cat, txnsInCatMonth1.length ? total / txnsInCatMonth1.length : 0);
  }

  for (const t of sortedTxns) {
    if (new Date(t.date) >= thirtyDaysAgo) {
      const avg = m1CatAverages.get(t.category) || 0;
      if (avg > 0 && t.amount > avg * 2) {
        unusualSpikes.push({
          date: t.date,
          category: t.category,
          amount: t.amount,
          reason: `Transaction is > 2x the category average`
        });
      }
    }
  }

  return {
    totalLast30Days: Math.round(total30),
    totalLast90Days: Math.round(total90),
    byCategory,
    fixedExpenses: Math.round(fixedExpenses),
    variableExpenses: Math.round(variableExpenses),
    trend,
    largestCategory,
    unusualSpikes
  };
}
