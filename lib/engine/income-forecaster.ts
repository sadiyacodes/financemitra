import { Transaction, IncomeForecast } from "../types";

export function forecastIncome(transactions: Transaction[], userId: string): IncomeForecast {
  const userTxns = transactions.filter(t => t.user_id === userId && t.type === "income");

  if (userTxns.length === 0) {
    return {
      nextWeekEstimate: { low: 0, mid: 0, high: 0 },
      nextMonthEstimate: { low: 0, mid: 0, high: 0 },
      forecastBasis: "Not enough data",
      confidenceLevel: "low"
    };
  }

  const sortedTxns = [...userTxns].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // descending
  
  // Aggregate into weeks from most recent going back
  const weeklyTotals: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  const latestDate = new Date(sortedTxns[0].date);

  for (const t of sortedTxns) {
    const d = new Date(t.date);
    const diffTime = Math.abs(latestDate.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    const weekIndex = Math.floor(diffDays / 7);
    
    if (weekIndex < 8) {
      weeklyTotals[weekIndex] += t.amount;
    }
  }

  // Weighted rolling average algorithm:
  // Last 2 weeks = 50% weight (25% each)
  // Weeks 3-4 = 30% (15% each)
  // Weeks 5-8 = 20% (5% each)
  let weightedWeeklySum = 0;
  let weightSum = 0;

  // Weeks 1-2
  for (let i = 0; i < 2; i++) { if (weeklyTotals.length > i) { weightedWeeklySum += weeklyTotals[i] * 0.25; weightSum += 0.25; } }
  // Weeks 3-4
  for (let i = 2; i < 4; i++) { if (weeklyTotals.length > i) { weightedWeeklySum += weeklyTotals[i] * 0.15; weightSum += 0.15; } }
  // Weeks 5-8
  for (let i = 4; i < 8; i++) { if (weeklyTotals.length > i) { weightedWeeklySum += weeklyTotals[i] * 0.05; weightSum += 0.05; } }

  const weightedWeeklyAvg = weightSum > 0 ? weightedWeeklySum / weightSum : 0;
  
  const nextWeekEstimate = {
    low: Math.round(weightedWeeklyAvg * 0.75),
    mid: Math.round(weightedWeeklyAvg),
    high: Math.round(weightedWeeklyAvg * 1.25)
  };

  const nextMonthEstimate = {
    low: nextWeekEstimate.low * 4.33,
    mid: nextWeekEstimate.mid * 4.33,
    high: nextWeekEstimate.high * 4.33
  };

  // Simplified volatility score calculated within this scope to avoid circulating deps
  const avg = weeklyTotals.reduce((a,b)=>a+b, 0) / 8;
  const variance = weeklyTotals.reduce((a,b)=>a + Math.pow(b - avg, 2), 0) / 8;
  const stdDev = Math.sqrt(variance);
  const volatilityScore = avg > 0 ? (stdDev / avg) * 100 : 0;

  let confidenceLevel: "low" | "medium" | "high" = "low";
  if (volatilityScore < 25) confidenceLevel = "high";
  else if (volatilityScore < 50) confidenceLevel = "medium";

  // No true seasonality data if mock only has 90 days. We omit seasonalWarning for MVP mock data.

  return {
    nextWeekEstimate,
    nextMonthEstimate,
    forecastBasis: "Based on a weighted average of your last 8 weeks of earnings.",
    confidenceLevel
  };
}
