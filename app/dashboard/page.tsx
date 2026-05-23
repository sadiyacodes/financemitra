"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Heatmap from "../../components/Heatmap";
import SavingsGoalCard from "../../components/SavingsGoalCard";
import FuelPriceBanner from "../../components/fuel/FuelPriceBanner";
import FuelExpenseRow from "../../components/fuel/FuelExpenseRow";
import AffectMeChip from "../../components/fuel/AffectMeChip";
import BestTimeToInvoicePill from "../../components/fx/BestTimeToInvoicePill";
import PendingInvoiceCalculator from "../../components/fx/PendingInvoiceCalculator";
import { Alert, UserProfile, HealthScore, WeeklyDigest, FuelApiResponse, FXApiResponse, Transaction } from "../../lib/types";
// HealthScoreRing intentionally removed in favor of heatmap + Pattern Agent
import { BankingRedirectCard } from "../../components/BankingRedirectCard";
import { personalizeBankingOptions } from "../../lib/utils/banking-personalizer";
import SmartAlerts from "../../components/SmartAlerts";
import React from "react";

// ─── Color map (matches health-score engine) ────────────────────────────────
const colorMap: Record<string, string> = {
  green: "#16a34a", amber: "#d97706", orange: "#ea580c", red: "#dc2626",
};

// ─── Real-data helpers ───────────────────────────────────────────────────────
function computeIncomeByWeek(txns: Transaction[]): { week: string; total: number }[] {
  const weekMap = new Map<string, number>();
  for (const t of txns) {
    if (t.type !== "income") continue;
    const d = new Date(t.date);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d.getTime() - startOfYear.getTime()) / 86_400_000);
    const weekNum = Math.ceil((d.getDay() + 1 + days) / 7);
    const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    weekMap.set(key, (weekMap.get(key) ?? 0) + t.amount);
  }
  return Array.from(weekMap.entries())
    .map(([week, total]) => ({ week, total }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-8);
}

function computeAverageWeekly(byWeek: { week: string; total: number }[]): number {
  if (!byWeek.length) return 0;
  return Math.round(byWeek.reduce((s, w) => s + w.total, 0) / byWeek.length);
}

function computeTopExpenses(txns: Transaction[]): { category: string; total: number }[] {
  const catMap = new Map<string, number>();
  for (const t of txns) {
    if (t.type !== "expense") continue;
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount);
  }
  return Array.from(catMap.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);
}

function estimateGoalDate(
  goal: { target: number; current: number },
  txns: Transaction[]
): string {
  const remaining = goal.target - goal.current;
  if (remaining <= 0) return new Date().toISOString();
  const cutoff = new Date(Date.now() - 30 * 86_400_000);
  const recent = txns.filter(t => new Date(t.date) >= cutoff);
  const income30 = recent.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense30 = recent.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const surplus = income30 - expense30;
  const months = surplus > 0 ? Math.ceil(remaining / surplus) : 14;
  const date = new Date();
  date.setMonth(date.getMonth() + Math.min(months, 60));
  return date.toISOString();
}

export default function Dashboard() {
  const [data, setData] = useState<{ profile: UserProfile, alerts: Alert[], healthScore?: HealthScore, digest?: WeeklyDigest, incomeByWeek: { week: string; total: number }[], averageWeekly: number, dateEstimate: string, txns?: Transaction[], topExpenses: { category: string; total: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [askStr, setAskStr] = useState("");
  const [showDigestModal, setShowDigestModal] = useState(false);
  const [fuelData, setFuelData] = useState<FuelApiResponse | null>(null);
  const [fxData, setFxData] = useState<FXApiResponse | null>(null);
  const [fuelBannerDismissed, setFuelBannerDismissed] = useState(false);
  const [bankingContext, setBankingContext] = useState<{ amount?: number; goalLabel?: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const userId = localStorage.getItem("fm_userId");
    if (!userId) { router.push("/"); return; }
    setCurrentUserId(userId);

    Promise.all([
      fetch(`/api/profile?userId=${userId}`).then(res => res.json()),
      fetch(`/api/alerts?userId=${userId}`).then(res => res.json()),
      fetch(`/api/digest?userId=${userId}`).then(res => res.json()),
      fetch(`/api/transactions?userId=${userId}`).then(res => res.json())
    ]).then(([profile, alertsRes, digest, txns]) => {
      
      if (profile?.type === "ride_share_driver") {
        fetch(`/api/external/fuel?userId=${userId}`)
          .then(r => r.json())
          .then(setFuelData)
          .catch(console.error);
      }

      const FREELANCE_TYPES = ["freelance_designer", "freelance_developer", "freelance_writer", "freelancer"];
      if (profile && FREELANCE_TYPES.includes(profile.type)) {
        fetch(`/api/external/fx?userId=${userId}`)
          .then(r => r.json())
          .then(setFxData)
          .catch(console.error);
      }
      const transactions: Transaction[] = txns.transactions || txns;
      const incomeByWeek = computeIncomeByWeek(transactions);
      const averageWeekly = computeAverageWeekly(incomeByWeek);
      const topExpenses = computeTopExpenses(transactions);
      const dateEstimate = estimateGoalDate(profile.savings_goal, transactions);

      setData({
        profile,
        alerts: alertsRes.alerts || alertsRes,
        healthScore: alertsRes.healthScore,
        digest,
        txns: transactions,
        incomeByWeek,
        averageWeekly,
        dateEstimate,
        topExpenses,
      });
      setLoading(false);
    });
  }, [router]);

  const bankingOptions = React.useMemo(() => {
    return personalizeBankingOptions(data?.txns || []);
  }, [data?.txns]);

  const handleTransferClick = (amount?: number) => {
    setBankingContext({
      amount: amount,
      goalLabel: data?.profile?.savings_goal?.label || "Savings",
    });
  };

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if(askStr.trim()) {
      router.push(`/chat?q=${encodeURIComponent(askStr)}`);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading dashboard...</div>;
  if (!data) return null;

  return (
    <div className="max-w-6xl mx-auto p-6 min-h-screen">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {data.profile.name.split(" ")[0]}</h1>
          <p className="text-gray-500">{data.profile.city} • {data.profile.type.replace(/_/g, " ")}</p>
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={() => { localStorage.removeItem("fm_userId"); router.push("/"); }} className="text-sm text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Switch User</button>
        </div>
      </header>

      {data.profile?.type === "ride_share_driver" && fuelData && !fuelBannerDismissed && (
        <FuelPriceBanner
          priceChange={fuelData.priceChange}
          driverImpact={fuelData.driverImpact}
          city={data.profile.city}
          onDismiss={() => setFuelBannerDismissed(true)}
          onAffectMeClick={() => router.push(
            `/chat?prefill=${encodeURIComponent(
              `How does the recent petrol price change in ${data.profile.city} affect my monthly budget?`
            )}`
          )}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SmartAlerts userId={currentUserId} />

        <div className="col-span-1 md:col-span-2 bg-white dark:bg-gray-950 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <Heatmap transactions={data.txns || []} />
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-500">Compare your earnings to market demand</div>
            <button onClick={() => router.push('/pattern-agent')} className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors flex items-center gap-2">
              <span>Open Pattern Agent</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        <div className="bg-teal-600 rounded-xl p-6 h-auto min-h-[12rem] flex flex-col justify-center text-white">
          <h3 className="font-bold text-xl mb-4">Quick Ask</h3>
          <form onSubmit={handleAsk} className="flex gap-2">
            <input 
              type="text" 
              value={askStr}
              onChange={(e)=>setAskStr(e.target.value)}
              placeholder="e.g. Can I save more this month?" 
              className="flex-1 rounded-lg px-4 py-3 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
            <button type="submit" className="bg-teal-800 hover:bg-teal-900 px-6 py-3 rounded-lg font-bold transition-colors">Ask</button>
          </form>
        </div>
        
        {/* ── Credit Narrative card ──────────────────────────────────────────── */}
        <div className="h-64">
          <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm border border-emerald-200 dark:border-emerald-900/40 p-6 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">📋</span>
                <h3 className="font-bold text-gray-800 dark:text-gray-200">Income Credit Score</h3>
              </div>
              <p className="text-sm text-gray-500 mb-3">Build a professional income narrative from your earnings data — for loan applications and credit assessments.</p>
              <div className="flex gap-3 text-xs">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
                  <div className="text-emerald-600 dark:text-emerald-400 font-semibold">91 days</div>
                  <div className="text-gray-400">of data</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
                  <div className="text-emerald-600 dark:text-emerald-400 font-semibold">AI-written</div>
                  <div className="text-gray-400">narrative</div>
                </div>
              </div>
            </div>
            <button onClick={() => router.push('/credit-narrative')} className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Generate Potential Score →
            </button>
          </div>
        </div>

        {/* ── Tax Assistant CTA ──────────────────────────────────────────────── */}
        <div className="col-span-1 md:col-span-2">
          <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm border border-blue-100 dark:border-blue-900/30 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 flex items-center justify-center text-base flex-shrink-0">🧾</div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Tax Assistant</p>
                <p className="text-xs text-gray-400">Ask about advance tax, TDS, Section 44ADA, ITR-4, and your gig worker tax obligations.</p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/chat?prefill=${encodeURIComponent("Based on my earnings, do I qualify for Section 44ADA? Which tax regime should I use, and do I owe any advance tax this year?")}`)}
              className="whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              Ask Tax Questions
            </button>
          </div>
        </div>

        {fxData && (
          <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 flex flex-col justify-center">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4">FX Hub</h3>
            <BestTimeToInvoicePill
              timingSignal={fxData.timingSignal}
              currencyCode={fxData.rate.currencyCode}
            />
            <div className="mt-4">
              <PendingInvoiceCalculator
                defaultCurrency={fxData.rate.currencyCode}
                fxData={fxData}
              />
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
           <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4">Expenses</h3>
           <div className="space-y-2">
             {data.topExpenses.map((exp, idx) => (
               <div key={exp.category} className={`flex justify-between items-center p-3 ${idx < data.topExpenses.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : ""}`}>
                 <span className="capitalize text-sm text-gray-700 dark:text-gray-300">{exp.category.replace(/_/g, " ")}</span>
                 <span className="font-semibold text-gray-900 dark:text-gray-100">₹{exp.total.toLocaleString()}</span>
               </div>
             ))}
             {data.profile?.type === "ride_share_driver" && fuelData && (
               <FuelExpenseRow
                 fuelAmount={fuelData.driverImpact.currentMonthlyCost}
                 fuelData={fuelData}
               />
             )}
           </div>
           
           {data.profile?.type === "ride_share_driver" && fuelData && (
             <AffectMeChip
               onClick={() => router.push(
                 `/chat?prefill=${encodeURIComponent(
                   `How does the recent petrol price change in ${data.profile.city} affect my monthly budget?`
                 )}`
               )}
             />
           )}
        </div>

        <div className="h-48">
          <SavingsGoalCard 
            label={data.profile.savings_goal.label} 
            target={data.profile.savings_goal.target} 
            current={data.profile.savings_goal.current} 
            dateEstimate={data.dateEstimate} 
            onTransferClick={() => handleTransferClick()}
          />
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
        <button 
          onClick={() => setShowDigestModal(true)} 
          className="flex items-center gap-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white px-8 py-4 rounded-full font-bold shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-xl transition-all transform hover:-translate-y-1 text-base lg:text-lg whitespace-nowrap"
        >
          <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
          View Weekly Digest
        </button>
      </div>

      {showDigestModal && data.digest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-100 dark:border-gray-800">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-teal-50/50 dark:bg-teal-900/20">
              <h3 className="font-bold text-xl text-teal-900 dark:text-teal-100">Weekly Digest</h3>
              <button onClick={() => setShowDigestModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">{data.digest.weekLabel}</div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
                   <div className="text-gray-500 text-sm mb-1">Income</div>
                   <div className="text-xl font-bold dark:text-white">₹{data.digest.incomeThisWeek.toLocaleString()}</div>
                   <div className={`text-[11px] mt-1.5 font-bold px-2 py-0.5 inline-block rounded-md ${data.digest.incomeVsAverage > 0 ? 'text-green-700 bg-green-100 dark:bg-green-900/30' : 'text-red-700 bg-red-100 dark:bg-red-900/30'}`}>
                     {data.digest.incomeVsAverage > 0 ? '↑' : '↓'} {Math.abs(data.digest.incomeVsAverage)}% vs avg
                   </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
                   <div className="text-gray-500 text-sm mb-1">Spent</div>
                   <div className="text-xl font-bold dark:text-white">₹{data.digest.spentThisWeek.toLocaleString()}</div>
                </div>
              </div>
              
              <div className="bg-teal-600 rounded-xl p-5 flex justify-between items-center shadow-md">
                 <span className="font-semibold text-teal-100">Surplus</span>
                 <span className="text-2xl font-bold text-white">₹{data.digest.surplusThisWeek.toLocaleString()}</span>
              </div>
              
              <div className="space-y-3 pt-2">
                 <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-800 pb-3">
                   <span className="text-gray-500">Best Earning Day</span>
                   <span className="font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">{data.digest.bestEarningDay}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm pt-1">
                   <span className="text-gray-500">Top Spend</span>
                   <span className="font-semibold text-gray-800 dark:text-gray-200 text-right">
                     {data.digest.biggestSpendCategory} <span className="text-gray-400 font-normal ml-1">₹{data.digest.biggestSpendAmount}</span>
                   </span>
                 </div>
              </div>
              
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex items-start gap-3">
                 <span className="text-amber-500 text-lg">💡</span>
                 <span className="text-sm font-medium text-amber-800 dark:text-amber-200 leading-snug">
                   {data.digest.notableObservation}
                 </span>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800">
               <button onClick={() => router.push(`/chat?q=${encodeURIComponent('Can you give me a detailed breakdown of my weekly expenses and how I can improve?')}`)} className="bg-white dark:bg-gray-800 border border-teal-200 dark:border-teal-900/50 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 w-full py-3 rounded-xl text-sm font-semibold transition-colors shadow-sm">
                  Ask AI for Full Breakdown
               </button>
            </div>
          </div>
        </div>
      )}

      {bankingContext && bankingOptions && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
           <BankingRedirectCard 
             options={bankingOptions}
             recommendedAmount={bankingContext.amount}
             goalLabel={bankingContext.goalLabel}
             onClose={() => setBankingContext(null)}
           />
        </div>
      )}
    </div>
  );
}
