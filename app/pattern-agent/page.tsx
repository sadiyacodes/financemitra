"use client";

import React from "react";
import { useRouter } from "next/navigation";
import MarketChart from "../../components/MarketChart";
import { runPatternAgent, PatternAgentResult, PatternAgentFlag } from "../../lib/agents/pattern-agent";
import { Transaction, UserProfile } from "../../lib/types";

function PerformanceBadge({ label }: { label: PatternAgentResult["performance_label"] }) {
  const config = {
    beating_market: { text: "Beating the Market", bg: "bg-emerald-100", text_c: "text-emerald-800", dot: "bg-emerald-500" },
    tracking_market: { text: "Tracking the Market", bg: "bg-blue-100", text_c: "text-blue-800", dot: "bg-blue-500" },
    below_market: { text: "Below the Market", bg: "bg-rose-100", text_c: "text-rose-700", dot: "bg-rose-500" },
  };
  const c = config[label];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${c.bg} ${c.text_c}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.text}
    </span>
  );
}

function FlagChip({ flag }: { flag: PatternAgentFlag }) {
  const magnitudeColors: Record<string, string> = {
    high: "bg-rose-50 border-rose-200 text-rose-700",
    medium: "bg-amber-50 border-amber-200 text-amber-700",
    low: "bg-slate-50 border-slate-200 text-slate-600",
  };
  const typeLabel = flag.type.replace(/_/g, " ");
  return (
    <div className={`rounded-2xl border p-4 ${magnitudeColors[flag.magnitude] ?? magnitudeColors.low}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="text-xs font-bold uppercase tracking-[0.2em]">{typeLabel}</span>
        <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em]">
          {flag.magnitude}
        </span>
      </div>
      <p className="text-sm leading-snug">{flag.plain_text}</p>
      {flag.dates.length > 0 && (
        <p className="mt-2 text-[10px] uppercase tracking-[0.15em] opacity-60">
          {flag.dates.slice(0, 3).join(" · ")}
        </p>
      )}
    </div>
  );
}

function ChartPlaceholder({ isRunning }: { isRunning: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-16 px-8 select-none">
      {/* Ghost chart lines */}
      <div className="w-full max-w-lg relative">
        <div className="flex items-end justify-between gap-1 h-24 mb-2 opacity-[0.07]">
          {[40, 60, 35, 75, 50, 85, 45, 70, 55, 65, 80, 50, 60, 45, 70].map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-amber-500" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="h-px bg-slate-200 w-full" />
      </div>
      <div className="text-center space-y-1.5">
        {isRunning ? (
          <>
            <div className="inline-flex items-center gap-2 text-amber-600 font-semibold text-sm">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Analysing your earnings against the market…
            </div>
            <p className="text-xs text-slate-400">This takes a few seconds</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-400">No analysis yet</p>
            <p className="text-xs text-slate-400">Run the agent to compare your earnings to market potential</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function PatternAgentPage() {
  const router = useRouter();
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const [result, setResult] = React.useState<PatternAgentResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [chartVisible, setChartVisible] = React.useState(false);

  React.useEffect(() => {
    const userId = localStorage.getItem("fm_userId") || "user_001";
    Promise.all([
      fetch(`/api/profile?userId=${userId}`).then(r => r.json()),
      fetch(`/api/transactions?userId=${userId}`).then(r => r.json()),
    ])
      .then(([profileData, txData]) => {
        setProfile(profileData);
        setTransactions(txData.transactions || []);
      })
      .catch(() => {
        setProfile(null);
        setTransactions([]);
      });
  }, []);

  const handleRun = async () => {
    if (!profile) return;
    setResult(null);
    setChartVisible(false);
    setError(null);
    setIsRunning(true);

    try {
      const res = await runPatternAgent({
        profile,
        transactions,
        platforms: ["grab"],
      });
      setResult(res);
      setTimeout(() => setChartVisible(true), 50);
    } catch (err) {
      console.error(err);
      setError("Unable to run Pattern Agent. Check your API key or try again.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* ── Header — plain, no card ─────────────────────────────────────── */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-700">
              FinanceMitra · Market Intelligence
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              Pattern Agent
            </h1>
            <p className="mt-2 max-w-xl text-base text-slate-500">
              Compare your income rhythm to market demand, surface missed opportunities, and understand your 91-day pattern.
            </p>
            {profile && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 font-medium">
                  {profile.name}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 font-medium">
                  {profile.city}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 self-start rounded-full border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </button>
        </div>

        {/* ── Run button — standalone ──────────────────────────────────────── */}
        <div className="flex justify-center">
          <button
            onClick={handleRun}
            disabled={isRunning || !profile}
            className="inline-flex items-center gap-2.5 rounded-full bg-amber-500 px-7 py-3 text-sm font-semibold text-slate-950 shadow-md shadow-amber-200/60 hover:bg-amber-400 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Analysing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {result ? "Re-run Analysis" : "Run Pattern Agent"}
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
              <p className="font-semibold">Agent error</p>
              <p className="mt-0.5">{error}</p>
              <button onClick={handleRun} className="mt-2 text-rose-600 underline text-xs">Retry</button>
            </div>
          </div>
        )}

        {/* ── Chart — always rendered ─────────────────────────────────────── */}
        <div className="rounded-[32px] border border-amber-200 bg-white shadow-sm overflow-hidden">
          {result ? (
            <div
              className="p-2 transition-opacity duration-500"
              style={{ opacity: chartVisible ? 1 : 0 }}
            >
              <MarketChart data={result.chart_data} />
            </div>
          ) : (
            <ChartPlaceholder isRunning={isRunning} />
          )}
        </div>

        {/* ── Results grid — summary left, insights right ─────────────────── */}
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">

          {/* Performance summary */}
          <div className="rounded-[32px] border border-amber-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-950 mb-1">Performance Summary</h3>
            <p className="text-sm text-slate-500 mb-5">How your earnings track against market potential.</p>
            {result ? (
              <div
                className="transition-opacity duration-500"
                style={{ opacity: chartVisible ? 1 : 0 }}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <PerformanceBadge label={result.performance_label} />
                    <p className="text-base leading-relaxed text-slate-700 max-w-lg">{result.summary}</p>
                  </div>
                  {result.missed_earnings_estimate > 0 && (
                    <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-center min-w-[140px] shrink-0">
                      <p className="text-xs text-rose-600 font-semibold uppercase tracking-wide mb-1">Left on the table</p>
                      <p className="text-2xl font-bold text-rose-700">
                        ₹{result.missed_earnings_estimate.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-slate-400">
                {isRunning ? "Computing performance metrics…" : "Run the agent to see how you compare to the market."}
              </div>
            )}
          </div>

          {/* Insights & flags */}
          <div className="rounded-[32px] border border-amber-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-950">Insights & Flags</h3>
            <p className="mt-1 text-sm text-slate-500">
              Concrete findings with specific dates — no vague observations.
            </p>
            {result ? (
              <div
                className="transition-opacity duration-500"
                style={{ opacity: chartVisible ? 1 : 0 }}
              >
                {result.flags.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    {result.flags.map((flag, i) => (
                      <FlagChip key={i} flag={flag} />
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-sm text-emerald-700 font-medium">
                    No significant gaps detected — you tracked the market closely.
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-slate-400">
                {isRunning ? "Agent is analysing your earnings against the market…" : "Run the agent to see your personalized insights here."}
              </div>
            )}
          </div>
        </div>

        {/* ── Ask AI about this graph ─────────────────────────────────────── */}
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-700">Have questions about your analysis?</p>
            <p className="text-xs text-slate-400 mt-0.5">Ask the AI to explain your earnings pattern, gaps, or what to do next.</p>
          </div>
          <button
            onClick={() => {
              const query = result
                ? result.missed_earnings_estimate > 0
                  ? `I left ₹${result.missed_earnings_estimate.toLocaleString()} on the table. Can you explain what this means and what I should do to improve?`
                  : `My pattern analysis shows I'm ${result.performance_label.replace(/_/g, " ")}. What should I focus on to keep it up?`
                : "Can you explain my 91-day earnings pattern and where I can improve?";
              router.push(`/chat?prefill=${encodeURIComponent(query)}`);
            }}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition"
          >
            Ask AI about this graph
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

      </div>
    </div>
  );
}
