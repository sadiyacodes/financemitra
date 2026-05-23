import rateData from "../../../data/exchange-rates.json";
import type {
  FXApiResponse,
  ExchangeRateChange,
  FXTimingSignal,
  PendingInvoiceResult,
  Transaction
} from "../../types";

// Detect which foreign currency appears most in a user's transaction history
// Used to auto-select the currency for the FX panel
export function detectPrimaryCurrency(transactions: Transaction[]): string {
  const foreignKeywords: Record<string, string[]> = {
    USD: ["upwork", "fiverr", "toptal", "stripe", "paypal", "usd", "dollar"],
    EUR: ["eur", "euro", "transferwise", "wise"],
    GBP: ["gbp", "pound", "revolut"],
    AED: ["aed", "dirham", "dubai"],
    SGD: ["sgd", "singapore"]
  };

  const counts: Record<string, number> = { USD: 0, EUR: 0, GBP: 0, AED: 0, SGD: 0 };

  transactions
    .filter(t => t.type === "income")
    .forEach(t => {
      const desc = (t.description + " " + (t.source ?? "")).toLowerCase();
      Object.entries(foreignKeywords).forEach(([code, keywords]) => {
        if (keywords.some(k => desc.includes(k))) counts[code]++;
      });
    });

  // Return currency with highest count — default to USD if nothing detected
  const detected = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return detected[1] > 0 ? detected[0] : "USD";
}

export function fetchExchangeRate(currencyCode: string): FXApiResponse {
  // Normalize currency code
  const code = currencyCode.toUpperCase();
  const rateEntry = rateData.rates[code as keyof typeof rateData.rates];

  // Fallback to USD if currency not found
  const entry = rateEntry ?? rateData.rates.USD;
  const usedCode = rateEntry ? code : "USD";

  const history = entry.history;
  const current = history[0];
  const previous = history[1];

  // Step 1: Compute rate change
  const delta = parseFloat((current.rate - previous.rate).toFixed(4));
  const deltaPercent = parseFloat(
    ((delta / previous.rate) * 100).toFixed(3)
  );

  // For freelancers: positive delta (INR weakening) = favorable
  // They receive more INR for the same foreign currency amount
  const threshold = rateData.favorable_move_threshold;
  const direction: "favorable" | "unfavorable" | "unchanged" =
    Math.abs(deltaPercent) < 0.1
      ? "unchanged"
      : delta > 0
      ? "favorable"    // INR weakened = freelancer benefits
      : "unfavorable"; // INR strengthened = freelancer gets less

  // Step 2: Compute 4-week average
  const fourWeekRates = history.slice(0, 4).map(h => h.rate);
  const fourWeekAverage = parseFloat(
    (fourWeekRates.reduce((a, b) => a + b, 0) / fourWeekRates.length).toFixed(4)
  );
  const deltaFromAverage = parseFloat(
    (current.rate - fourWeekAverage).toFixed(4)
  );
  const deltaFromAveragePercent = parseFloat(
    ((deltaFromAverage / fourWeekAverage) * 100).toFixed(3)
  );

  // Step 3: Compute timing signal
  let signal: "good_time" | "neutral" | "wait";
  let label: string;
  let reasoning: string;

  if (deltaFromAveragePercent >= threshold) {
    signal = "good_time";
    label = "Favorable week to receive payments";
    reasoning = `The ${usedCode}/INR rate is ${deltaFromAveragePercent.toFixed(1)}% above your 4-week average — you get more rupees per ${usedCode} right now.`;
  } else if (deltaFromAveragePercent <= -threshold) {
    signal = "wait";
    label = "Rate below recent average";
    reasoning = `The ${usedCode}/INR rate is ${Math.abs(deltaFromAveragePercent).toFixed(1)}% below your 4-week average — if you can delay receiving payment, consider waiting.`;
  } else {
    signal = "neutral";
    label = "Rate near recent average";
    reasoning = `The ${usedCode}/INR rate is close to your 4-week average — no strong reason to time this payment differently.`;
  }

  const timingSignal: FXTimingSignal = {
    signal,
    label,
    reasoning,
    comparedTo: "4_week_average",
    currentRate: current.rate,
    fourWeekAverage,
    deltaFromAverage
  };

  return {
    rate: {
      currencyCode: usedCode,
      currencyName: entry.currency_name,
      symbol: entry.symbol,
      currentRate: current.rate,
      lastUpdated: current.date,
      source: rateData.meta.source
    },
    rateChange: {
      hasMoved: Math.abs(deltaPercent) >= 0.1,
      previousRate: previous.rate,
      currentRate: current.rate,
      delta,
      deltaPercent,
      direction,
      previousDate: previous.date,
      currentDate: current.date
    },
    timingSignal
  };
}

// Pure frontend utility — no API call needed
// Called directly in the PendingInvoiceCalculator component
export function calculatePendingInvoice(
  foreignAmount: number,
  currencyCode: string
): PendingInvoiceResult {
  const code = currencyCode.toUpperCase();
  const entry = rateData.rates[code as keyof typeof rateData.rates] ?? rateData.rates.USD;
  const history = entry.history;

  const currentRate = history[0].rate;
  const lastWeekRate = history[1].rate;
  const fourWeekRates = history.slice(0, 4).map(h => h.rate);
  const fourWeekAvg =
    fourWeekRates.reduce((a, b) => a + b, 0) / fourWeekRates.length;

  const inrToday = parseFloat((foreignAmount * currentRate).toFixed(2));
  const inrLastWeek = parseFloat((foreignAmount * lastWeekRate).toFixed(2));
  const inrFourWeekAvg = parseFloat((foreignAmount * fourWeekAvg).toFixed(2));
  const deltaVsLastWeek = parseFloat((inrToday - inrLastWeek).toFixed(2));
  const deltaVsAverage = parseFloat((inrToday - inrFourWeekAvg).toFixed(2));

  // Deterministic recommendation string
  let recommendation: string;
  if (deltaVsLastWeek > 500) {
    recommendation = `This week's rate is significantly better than last week — good time to receive this payment.`;
  } else if (deltaVsLastWeek > 0) {
    recommendation = `Slightly better than last week — ₹${deltaVsLastWeek} more at today's rate.`;
  } else if (deltaVsLastWeek < -500) {
    recommendation = `Rate is notably weaker than last week — if possible, consider delaying this invoice.`;
  } else if (deltaVsLastWeek < 0) {
    recommendation = `Slightly weaker than last week — difference is ₹${Math.abs(deltaVsLastWeek)}, likely not worth delaying.`;
  } else {
    recommendation = `Rate is unchanged from last week — no timing advantage either way.`;
  }

  return {
    foreignAmount,
    currencyCode: code,
    inrValueToday: inrToday,
    inrValueLastWeek: inrLastWeek,
    inrValueFourWeekAvg: inrFourWeekAvg,
    deltaVsLastWeek,
    deltaVsAverage,
    recommendation
  };
}
