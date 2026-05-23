import bankingData from "../../data/banking-options.json";
import type { Transaction } from "../types";

export interface BankingOption {
  id: string;
  name: string;
  shortName: string;
  url: string;
  deeplink?: string;
  color: string;
  textColor: string;
  isDetected: boolean;
  detectedLabel?: string;
}

export interface PersonalizedBankingOptions {
  upiApps: BankingOption[];
  netBanking: BankingOption[];
  primarySuggestion: BankingOption | null;
  detectedCount: number;
}

export function personalizeBankingOptions(
  transactions: Transaction[]
): PersonalizedBankingOptions {
  const transactionText = transactions
    .map(t => `${t.description} ${t.source ?? ""}`)
    .join(" ")
    .toLowerCase();

  function scoreOption(keywords: string[]): number {
    return keywords.filter(k => transactionText.includes(k)).length;
  }

  const scoredUpi = bankingData.upi_apps.map(app => ({
    ...app,
    score: scoreOption(app.keywords),
    isDetected: scoreOption(app.keywords) > 0,
    detectedLabel: scoreOption(app.keywords) > 0
      ? "Detected from your transactions"
      : undefined
  }));

  const scoredNetBanking = bankingData.net_banking.map(bank => ({
    ...bank,
    score: scoreOption(bank.keywords),
    isDetected: scoreOption(bank.keywords) > 0,
    detectedLabel: scoreOption(bank.keywords) > 0
      ? "Detected from your transactions"
      : undefined
  }));

  const sortFn = (a: any, b: any) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  };

  const sortedUpi = scoredUpi.sort(sortFn);
  const sortedNetBanking = scoredNetBanking.sort(sortFn);

  const allScored = [...scoredUpi, ...scoredNetBanking];
  const topDetected = allScored
    .filter(o => o.score > 0)
    .sort(sortFn)[0] ?? null;

  const detectedCount = allScored.filter(o => o.score > 0).length;

  return {
    upiApps: sortedUpi,
    netBanking: sortedNetBanking,
    primarySuggestion: topDetected,
    detectedCount
  };
}
