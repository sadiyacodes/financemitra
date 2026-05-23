"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Transaction, UserProfile } from "../../lib/types";

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Stability ring ────────────────────────────────────────────────────────────
function StabilityRing({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 70 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";
  const label = score >= 70 ? "Strong" : score >= 50 ? "Moderate" : "Variable";
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex items-center gap-4">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          transform="rotate(-90 44 44)"
        />
        <text x="44" y="48" textAnchor="middle" fontSize="16" fontWeight="700" fill={color}>{score}</text>
      </svg>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">Stability Score</p>
        <p className="text-lg font-bold" style={{ color }}>{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">out of 100</p>
      </div>
    </div>
  );
}

// ── Narrative placeholder ─────────────────────────────────────────────────────
function NarrativePlaceholder({ isGenerating }: { isGenerating: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-14 px-8 select-none">
      <div className="space-y-2 w-full max-w-lg opacity-[0.08]">
        {[100, 90, 95, 80, 88, 70].map((w, i) => (
          <div key={i} className="h-3 rounded-full bg-slate-400" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="text-center space-y-1">
        {isGenerating ? (
          <>
            <div className="inline-flex items-center gap-2 text-emerald-600 font-semibold text-sm">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Writing your credit narrative…
            </div>
            <p className="text-xs text-slate-400">Analysing 91 days of earnings data</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-400">No narrative generated yet</p>
            <p className="text-xs text-slate-400">Click the button above to generate your income credit narrative</p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CreditNarrativePage() {
  const router = useRouter();
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [narrative, setNarrative] = React.useState<string | null>(null);
  const [metrics, setMetrics] = React.useState<Record<string, number | string> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [narrativeVisible, setNarrativeVisible] = React.useState(false);

  React.useEffect(() => {
    const userId = localStorage.getItem("fm_userId") || "user_001";
    Promise.all([
      fetch(`/api/profile?userId=${userId}`).then(r => r.json()),
      fetch(`/api/transactions?userId=${userId}`).then(r => r.json()),
    ]).then(([p, txData]) => {
      setProfile(p);
      setTransactions(txData.transactions || []);
    });
  }, []);

  // Compute quick metrics client-side for immediate display
  const quickMetrics = React.useMemo(() => {
    const income = transactions.filter(t => t.type === "income");
    const total = income.reduce((s, t) => s + t.amount, 0);
    const activeDays = new Set(income.map(t => t.date.slice(0, 10))).size;
    return {
      totalIncome: Math.round(total),
      avgMonthly: Math.round((total / 91) * 30),
      avgWeekly: Math.round((total / 91) * 7),
      activeDays,
      activityRate: Math.round((activeDays / 91) * 100),
    };
  }, [transactions]);

  const handleGenerate = async () => {
    const userId = localStorage.getItem("fm_userId") || "user_001";
    setNarrative(null);
    setNarrativeVisible(false);
    setError(null);
    setIsGenerating(true);
    try {
      const res = await fetch("/api/credit-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate narrative");
      setNarrative(data.narrative);
      setMetrics(data.metrics);
      setTimeout(() => setNarrativeVisible(true), 50);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const displayMetrics = metrics ?? quickMetrics;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-700">
              FinanceMitra · Income Intelligence
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              Income Credit Score
            </h1>
            <p className="mt-2 max-w-lg text-base text-slate-500">
              A professional income narrative built from your verified earnings data — ready for loan applications and credit assessments.
            </p>
            {profile && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 font-medium">{profile.name}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 font-medium">{profile.city}</span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700 font-medium">91 days verified</span>
              </div>
            )}
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </button>
        </div>

        {/* ── Generate button ──────────────────────────────────────────────── */}
        <div className="flex justify-center">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || transactions.length === 0}
            className="inline-flex items-center gap-2.5 rounded-full bg-emerald-600 px-7 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-200/60 hover:bg-emerald-700 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {narrative ? "Regenerate Narrative" : "Generate Potential Score"}
              </>
            )}
          </button>
        </div>

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-[24px] bg-rose-50 border border-rose-200 p-5 text-rose-800 text-sm flex items-start gap-3">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold">Generation failed</p>
              <p className="mt-0.5">{error}</p>
              <button onClick={handleGenerate} className="mt-2 text-rose-600 underline text-xs">Retry</button>
            </div>
          </div>
        )}

        {/* ── Metrics grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard
            label="Total Income"
            value={`₹${(displayMetrics.totalIncome as number).toLocaleString()}`}
            sub="last 91 days"
          />
          <MetricCard
            label="Avg Monthly"
            value={`₹${(displayMetrics.avgMonthly as number).toLocaleString()}`}
            sub="projected"
          />
          <MetricCard
            label="Avg Weekly"
            value={`₹${(displayMetrics.avgWeekly as number).toLocaleString()}`}
            sub="projected"
          />
          <MetricCard
            label="Active Days"
            value={`${displayMetrics.activeDays}`}
            sub={`${displayMetrics.activityRate}% activity rate`}
          />
          <MetricCard
            label="Max EMI"
            value={`₹${Math.round((displayMetrics.avgMonthly as number) * 0.2).toLocaleString()}`}
            sub="20% affordability rule"
          />
          {metrics ? (
            <StabilityRing score={metrics.stabilityScore as number} />
          ) : (
            <MetricCard label="Stability Score" value="—" sub="generate to see" />
          )}
        </div>

        {/* ── Narrative card ───────────────────────────────────────────────── */}
        <div className="rounded-[32px] border border-emerald-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 pt-6 pb-2 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-950">Credit Narrative</h2>
            <p className="text-sm text-slate-500 mt-0.5">AI-generated, grounded in your verified transaction data.</p>
          </div>

          {narrative ? (
            <div
              className="p-6 transition-opacity duration-500"
              style={{ opacity: narrativeVisible ? 1 : 0 }}
            >
              {narrative.split("\n\n").map((para, i) => (
                <p key={i} className={`text-sm leading-relaxed text-slate-700 ${i > 0 ? "mt-4" : ""}`}>
                  {para.trim()}
                </p>
              ))}
              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Verified from transaction history
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  91-day data window
                </span>
              </div>
            </div>
          ) : (
            <NarrativePlaceholder isGenerating={isGenerating} />
          )}
        </div>

        {/* ── Ask AI follow-up ─────────────────────────────────────────────── */}
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-700">Need to explain this to a lender?</p>
            <p className="text-xs text-slate-400 mt-0.5">Ask the AI how to present your income profile for a specific loan type.</p>
          </div>
          <button
            onClick={() => {
              const q = narrative
                ? `I have a gig worker income narrative. My average monthly income is ₹${(displayMetrics.avgMonthly as number).toLocaleString()} and my stability score is ${metrics?.stabilityScore ?? "unknown"}/100. How should I present this to a bank or NBFC when applying for a loan?`
                : "I'm a gig worker and I want to apply for a loan. How should I present my variable income to a lender?";
              router.push(`/chat?prefill=${encodeURIComponent(q)}`);
            }}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Ask AI
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

      </div>
    </div>
  );
}
