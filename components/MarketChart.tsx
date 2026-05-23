"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { PatternAgentChartPoint } from "../lib/agents/pattern-agent";

type AreaSegment = { x1: string; x2: string; type: "outperformed" | "missed" };

function computeSegments(data: PatternAgentChartPoint[]): AreaSegment[] {
  if (data.length === 0) return [];
  const areas: AreaSegment[] = [];
  let segStart = data[0].date;
  let segType: "outperformed" | "missed" =
    data[0].actual >= data[0].market_potential ? "outperformed" : "missed";

  for (let i = 1; i < data.length; i++) {
    const type: "outperformed" | "missed" =
      data[i].actual >= data[i].market_potential ? "outperformed" : "missed";
    if (type !== segType) {
      areas.push({ x1: segStart, x2: data[i - 1].date, type: segType });
      segStart = data[i].date;
      segType = type;
    }
  }
  areas.push({ x1: segStart, x2: data[data.length - 1].date, type: segType });
  return areas;
}

type RechartsPayloadEntry = { dataKey: string; value: number };

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: RechartsPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const actual = payload.find(p => p.dataKey === "actual")?.value ?? 0;
  const market = payload.find(p => p.dataKey === "market_potential")?.value ?? 0;
  const diff = actual - market;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs shadow-lg">
      <div className="font-semibold text-slate-700 mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
        <span className="text-slate-600">Actual:</span>
        <span className="font-bold text-slate-900">₹{actual.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
        <span className="text-slate-600">Market:</span>
        <span className="font-bold text-slate-900">₹{market.toLocaleString()}</span>
      </div>
      {diff !== 0 && (
        <div className={`mt-1.5 font-semibold ${diff > 0 ? "text-emerald-600" : "text-rose-500"}`}>
          {diff > 0 ? `+₹${diff.toLocaleString()} ahead` : `-₹${Math.abs(diff).toLocaleString()} behind`}
        </div>
      )}
    </div>
  );
}

export default function MarketChart({ data }: { data: PatternAgentChartPoint[] }) {
  // Show last 30 days for a focused view
  const slice = data.slice(-30);
  const segments = computeSegments(slice);

  const maxY = Math.max(...slice.map(p => Math.max(p.actual, p.market_potential)), 1);

  const formatTick = (d: string) => {
    const dt = new Date(d);
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  };

  const outperformedDays = slice.filter(p => p.actual >= p.market_potential).length;
  const missedDays = slice.length - outperformedDays;

  return (
    <div className="rounded-[28px] bg-white border border-amber-200 p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600 mb-1">
            Market vs Earnings
          </div>
          <div className="text-xl font-semibold text-slate-950">Last 30 days</div>
        </div>
        <div className="flex items-center gap-5 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-[2.5px] bg-amber-400 rounded" />
            Actual (gold)
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-6 rounded"
              style={{ height: "2.5px", background: "repeating-linear-gradient(90deg,#8B5CF6 0,#8B5CF6 5px,transparent 5px,transparent 9px)" }}
            />
            Market (purple)
          </div>
        </div>
      </div>

      {/* Shading legend */}
      <div className="flex gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-emerald-400 opacity-50 inline-block" />
          <span className="text-slate-500">{outperformedDays} days ahead</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-rose-400 opacity-40 inline-block" />
          <span className="text-slate-500">{missedDays} days behind</span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={slice} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatTick}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            interval={4}
          />
          <YAxis
            tickFormatter={(v) => `₹${v}`}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={54}
            domain={[0, Math.ceil(maxY * 1.1)]}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Gap shading — behind the lines */}
          {segments.map((seg, i) => (
            <ReferenceArea
              key={i}
              x1={seg.x1}
              x2={seg.x2}
              fill={seg.type === "outperformed" ? "#22c55e" : "#f43f5e"}
              fillOpacity={0.07}
              stroke="none"
            />
          ))}

          {/* Market potential line — purple dashed */}
          <Line
            type="monotone"
            dataKey="market_potential"
            stroke="#8B5CF6"
            strokeWidth={2}
            strokeDasharray="7 4"
            dot={false}
            activeDot={{ r: 4, fill: "#8B5CF6" }}
            name="market_potential"
          />

          {/* Actual earnings line — gold, on top */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#F59E0B"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: "#F59E0B" }}
            name="actual"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Date range */}
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        <span>{slice[0]?.date}</span>
        <span>{slice[slice.length - 1]?.date}</span>
      </div>
    </div>
  );
}
