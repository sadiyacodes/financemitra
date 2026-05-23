"use client";

import React from "react";
import { useRouter } from "next/navigation";
import type { SmartAlert } from "../app/api/smart-alerts/route";

// ── Kind → visual config ──────────────────────────────────────────────────────
const KIND_CONFIG = {
  opportunity: {
    accent: "bg-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/10",
    border: "border-amber-200 dark:border-amber-800/40",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    label: "Opportunity",
  },
  warning: {
    accent: "bg-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/10",
    border: "border-rose-200 dark:border-rose-800/40",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    label: "Alert",
  },
  positive: {
    accent: "bg-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/10",
    border: "border-emerald-200 dark:border-emerald-800/40",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    label: "On Track",
  },
  info: {
    accent: "bg-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/10",
    border: "border-blue-200 dark:border-blue-800/40",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    label: "Insight",
  },
};

// ── Single toast card ─────────────────────────────────────────────────────────
function AlertCard({
  alert,
  index,
  onDismiss,
  onAskAI,
}: {
  alert: SmartAlert;
  index: number;
  onDismiss: (id: string) => void;
  onAskAI: (query: string) => void;
}) {
  const [visible, setVisible] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 80);
    return () => clearTimeout(t);
  }, [index]);

  const handleDismiss = () => {
    setLeaving(true);
    setTimeout(() => onDismiss(alert.id), 280);
  };

  const cfg = KIND_CONFIG[alert.kind] ?? KIND_CONFIG.info;

  return (
    <div
      className={`
        relative flex items-start gap-0 rounded-xl border shadow-sm overflow-hidden
        transition-all duration-300 ease-out
        ${cfg.bg} ${cfg.border}
        ${visible && !leaving ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}
        ${leaving ? "opacity-0 scale-95" : ""}
      `}
      style={{ transitionProperty: "opacity, transform" }}
    >
      {/* Left accent stripe */}
      <div className={`w-1 self-stretch flex-shrink-0 ${cfg.accent}`} />

      <div className="flex-1 flex items-start gap-3 p-4 min-w-0">
        {/* Icon */}
        <span className="text-xl flex-shrink-0 mt-0.5 select-none">{alert.icon}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
              {cfg.label}
            </span>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
              {alert.title}
            </p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-snug">
            {alert.message}
          </p>
          <button
            onClick={() => onAskAI(alert.chat_query)}
            className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors flex items-center gap-1"
          >
            Ask AI about this
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors self-start"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── Loading skeletons ─────────────────────────────────────────────────────────
function AlertSkeleton({ index }: { index: number }) {
  return (
    <div
      className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden flex animate-pulse"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="w-1 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
      <div className="flex-1 p-4 space-y-2">
        <div className="flex gap-2 items-center">
          <div className="w-12 h-4 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="w-36 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="w-2/3 h-3 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SmartAlerts({ userId }: { userId: string }) {
  const router = useRouter();
  const [alerts, setAlerts] = React.useState<SmartAlert[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) return;
    fetch(`/api/smart-alerts?userId=${userId}`)
      .then(r => r.json())
      .then(data => {
        setAlerts(data.alerts ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  const handleDismiss = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleAskAI = (query: string) => {
    router.push(`/chat?prefill=${encodeURIComponent(query)}`);
  };

  // Nothing to show
  if (!loading && alerts.length === 0) return null;

  return (
    <div className="col-span-1 md:col-span-2 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500">
          Smart Alerts
        </span>
        {!loading && alerts.length > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        )}
      </div>

      {loading ? (
        <>
          <AlertSkeleton index={0} />
          <AlertSkeleton index={1} />
        </>
      ) : (
        alerts.map((alert, i) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            index={i}
            onDismiss={handleDismiss}
            onAskAI={handleAskAI}
          />
        ))
      )}
    </div>
  );
}
