"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserProfile, Alert, ScenarioResult, Transaction } from "../../lib/types";
import ReasoningLog from "../../components/ReasoningLog";
import { ScenarioTable } from "../../components/ScenarioTable";
import { BankingRedirectCard } from "../../components/BankingRedirectCard";
import { personalizeBankingOptions } from "../../lib/utils/banking-personalizer";

// ─── Context-aware suggestion chips ─────────────────────────────────────────
function getSuggestionChips(profile: UserProfile | null): string[] {
  if (!profile) return [];

  const goalChip = `Will I hit my ${profile.savings_goal.label} goal on time?`;

  return [
    goalChip,
    `How does the petrol price change in ${profile.city} affect my budget?`,
    "What's my income forecast for next week?",
    "What if I worked 3 extra hours every day this week?",
  ];
}

function ChatContent() {
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: string, content: string, reasoningLog?: any[], scenarioResult?: ScenarioResult }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(`sess_${Date.now()}`);

  // Live Context
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [lastStats, setLastStats] = useState<any>(null);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Banking Card logic
  const [showBankingCard, setShowBankingCard] = useState(false);
  const [bankingCardContext, setBankingCardContext] = useState<{ amount?: number; goalLabel?: string; } | null>(null);

  const bankingOptions = React.useMemo(
    () => personalizeBankingOptions(transactions),
    [transactions]
  );

  const router = useRouter();
  const searchParams = useSearchParams();
  const initialized = useRef(false);

  useEffect(() => {
    const uid = localStorage.getItem("fm_userId");
    if (!uid) { router.push("/"); return; }
    setUserId(uid);

    fetch(`/api/profile?userId=${uid}`).then(res => res.json()).then(setProfile);
    fetch(`/api/alerts?userId=${uid}`).then(res => res.json()).then(setActiveAlerts);
    fetch(`/api/transactions?userId=${uid}`).then(res => res.json()).then(data => setTransactions(data.transactions || []));

    const q = searchParams.get("q");
    const prefill = searchParams.get("prefill");

    if (q && !initialized.current) {
      initialized.current = true;
      sendMessage(q, uid);
    }

    if (prefill && prefill.trim().length > 0 && !initialized.current) {
      initialized.current = true;
      setTimeout(() => {
        sendMessage(decodeURIComponent(prefill), uid);
      }, 300);
    }
  }, []);

  const sendMessage = async (msg: string, currentUserId: string = userId!) => {
    if (!msg.trim()) return;

    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, message: msg, sessionId })
      });
      const data = await resp.json();

      setMessages(prev => [...prev, { role: "assistant", content: data.message || data.error, reasoningLog: data.reasoningLog, scenarioResult: data.data?.scenarioResult }]);

      if (data.alerts) setActiveAlerts(data.alerts);
      if (data.data) {
        setLastStats({
          income: data.data.incomeStats,
          expense: data.data.expenseStats,
          plan: data.data.savingsPlan
        });
      }

      if (data.showBankingCard) {
        setBankingCardContext({
          amount: data.data?.savingsPlan?.recommendedMonthlySaving,
          goalLabel: profile?.savings_goal?.label
        });
        setShowBankingCard(true);
      }

    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error communicating with server." }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex justify-center h-screen bg-gray-50 dark:bg-gray-950">

      <div className="w-full max-w-4xl shadow-xl flex flex-col bg-white dark:bg-gray-900 border-x border-gray-200 dark:border-gray-800">
        <header className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
          <h2 className="font-bold text-lg">FinanceMitra Assistant</h2>
          <button onClick={() => router.push("/dashboard")} className="text-teal-600 text-sm font-medium">← Dashboard</button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center gap-6 mt-16 px-4">
              <div className="text-center">
                <div className="text-4xl mb-3">👋</div>
                <p className="font-semibold text-gray-800 dark:text-gray-200 text-lg">
                  Hi {profile?.name?.split(" ")[0] ?? "there"}!
                </p>
                <p className="text-gray-500 text-sm mt-1">Here are some things you can ask me:</p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-md">
                {getSuggestionChips(profile).map((chip) => (
                  <button
                    key={chip}
                    onClick={() => sendMessage(chip)}
                    className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 text-sm text-gray-700 dark:text-gray-300 transition-all font-medium shadow-sm"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${m.role === 'user' ? 'bg-teal-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'}`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
              {m.role === 'assistant' && m.reasoningLog && (
                <ReasoningLog steps={m.reasoningLog} />
              )}
              {m.scenarioResult && (
                <ScenarioTable result={m.scenarioResult} onSuggestionClick={(msg) => sendMessage(msg)} />
              )}
              {i === messages.length - 1 && m.role === 'assistant' && showBankingCard && bankingOptions && (
                <BankingRedirectCard options={bankingOptions} recommendedAmount={bankingCardContext?.amount} goalLabel={bankingCardContext?.goalLabel} onClose={() => { setShowBankingCard(false); setBankingCardContext(null); }} />
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-start">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-5 py-3 text-gray-500 flex space-x-1">
                <span className="animate-bounce">.</span><span className="animate-bounce" style={{ animationDelay: '100ms' }}>.</span><span className="animate-bounce" style={{ animationDelay: '200ms' }}>.</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}>
            <input
              type="text"
              className="flex-1 border border-gray-300 dark:border-gray-700 rounded-full px-5 py-3 focus:outline-none focus:border-teal-500 dark:bg-gray-900"
              placeholder="Ask anything about your finances..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700 text-white rounded-full px-6 py-3 font-bold transition-colors">
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center p-10">Loading chat...</div>}>
      <ChatContent />
    </Suspense>
  );
}
