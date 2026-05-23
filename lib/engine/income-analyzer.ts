import { Transaction, IncomeStats, UserProfile } from "../types";
import { computeHealthScore } from "./health-score";

export function analyzeIncome(transactions: Transaction[], userProfile: UserProfile): IncomeStats {
  const userTxns = transactions.filter(t => t.user_id === userProfile.id && t.type === "income");

  if (userTxns.length === 0) {
    return {
      averageMonthly: 0,
      averageWeekly: 0,
      highestMonth: { month: "", amount: 0 },
      lowestMonth: { month: "", amount: 0 },
      volatilityScore: 0,
      bestDayOfWeek: "",
      worstDayOfWeek: "",
      incomeByWeek: [],
      incomeByMonth: [],
      totalLast30Days: 0,
      totalLast90Days: 0,
      healthScore: computeHealthScore(0, userProfile.monthly_fixed_expenses, -userProfile.monthly_fixed_expenses)
    };
  }

  let total90 = 0;
  let total30 = 0;
  
  // Sort by date mostly to be safe
  const sortedTxns = [...userTxns].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  if (sortedTxns.length === 0) { throw new Error("No transactions"); }
  const latestDateStr = sortedTxns[sortedTxns.length - 1].date;
  const latestDate = new Date(latestDateStr);
  const thirtyDaysAgo = new Date(latestDateStr);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const monthMap = new Map<string, number>();
  const weekMap = new Map<string, number>();
  const dayMap = new Map<string, number>();

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (const t of sortedTxns) {
    const d = new Date(t.date);
    const amt = t.amount;
    total90 += amt;
    if (d >= thirtyDaysAgo) total30 += amt;

    const yyyyMm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(yyyyMm, (monthMap.get(yyyyMm) || 0) + amt);

    // simple ISO week approximation for mock data:
    // we can use "YYYY-WXX"
    const startDate = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((d.getDay() + 1 + days) / 7);
    const weekStr = `${d.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    weekMap.set(weekStr, (weekMap.get(weekStr) || 0) + amt);

    const dayName = dayNames[d.getDay()];
    dayMap.set(dayName, (dayMap.get(dayName) || 0) + amt);
  }

  const incomeByMonth = Array.from(monthMap.entries()).map(([month, total]) => ({ month, total }));
  const incomeByWeek = Array.from(weekMap.entries()).map(([week, total]) => ({ week, total }));

  incomeByMonth.sort((a, b) => a.month.localeCompare(b.month)); // chronological

  let highestMonth = { month: "", amount: -1 };
  let lowestMonth = { month: "", amount: Infinity };
  let sumMonth = 0;
  for (const m of incomeByMonth) {
    if (m.total > highestMonth.amount) highestMonth = { month: m.month, amount: m.total };
    if (m.total < lowestMonth.amount) lowestMonth = { month: m.month, amount: m.total };
    sumMonth += m.total;
  }
  const averageMonthly = incomeByMonth.length ? sumMonth / incomeByMonth.length : 0;

  let sumWeek = 0;
  for (const w of incomeByWeek) sumWeek += w.total;
  const averageWeekly = incomeByWeek.length ? sumWeek / incomeByWeek.length : 0;

  let bestDayOfWeek = "";
  let bestDayAmt = -1;
  let worstDayOfWeek = "";
  let worstDayAmt = Infinity;
  for (const [day, amt] of Array.from(dayMap.entries())) {
    if (amt > bestDayAmt) { bestDayAmt = amt; bestDayOfWeek = day; }
    if (amt < worstDayAmt) { worstDayAmt = amt; worstDayOfWeek = day; }
  }

  // Volatility Score: (stdDev / mean) * 100
  let varianceSum = 0;
  for (const m of incomeByMonth) {
    varianceSum += Math.pow(m.total - averageMonthly, 2);
  }
  const variance = incomeByMonth.length ? varianceSum / incomeByMonth.length : 0;
  const stdDev = Math.sqrt(variance);
  
  let volatilityScore = averageMonthly > 0 ? (stdDev / averageMonthly) * 100 : 0;
  if (volatilityScore > 100) volatilityScore = 100;

  const totalMonthlyExpenses = userProfile.monthly_fixed_expenses;
  const monthlySavings = averageMonthly - totalMonthlyExpenses;
  const healthScore = computeHealthScore(averageMonthly, totalMonthlyExpenses, monthlySavings);

  return {
    averageMonthly: Math.round(averageMonthly),
    averageWeekly: Math.round(averageWeekly),
    highestMonth,
    lowestMonth: lowestMonth.amount === Infinity ? { month: "", amount: 0 } : lowestMonth,
    volatilityScore: Math.round(volatilityScore),
    bestDayOfWeek,
    worstDayOfWeek,
    incomeByWeek,
    incomeByMonth,
    totalLast30Days: total30,
    totalLast90Days: total90,
    healthScore
  };
}
