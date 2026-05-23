"use client";

import React from "react";

type AgentTerminalProps = {
  steps: string[];
  isRunning: boolean;
  height?: string;
};

export default function AgentTerminal({ steps, isRunning, height = "240px" }: AgentTerminalProps) {
  return (
    <div className="bg-slate-50 border border-amber-200 rounded-3xl p-4 text-sm text-slate-950 font-mono shadow-[0_20px_60px_-30px_rgba(251,191,36,0.15)]" style={{ minHeight: height }}>
      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: height }}>
        {steps.length === 0 ? (
          <div className="text-amber-600">Ready to run the agent.</div>
        ) : (
          steps.map((step, index) => (
            <div key={index} className="flex items-center gap-2 text-slate-900">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>{step}</span>
            </div>
          ))
        )}
        {isRunning && (
          <div className="flex items-center gap-2 text-amber-600">
            <span className="animate-pulse">•</span>
            <span>Running...</span>
          </div>
        )}
      </div>
    </div>
  );
}
