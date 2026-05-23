"use client";

import React from "react";
import { Transaction } from "../lib/types";

type Props = {
  transactions: Transaction[];
  days?: number; // number of days to show, default 91
};

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function Heatmap({ transactions, days = 91 }: Props) {
  // build a map of date -> earnings
  const earningsMap = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "income") continue;
    const d = new Date(t.date);
    const key = formatDate(d);
    earningsMap.set(key, (earningsMap.get(key) ?? 0) + t.amount);
  }

  // If transaction data is old (e.g. fixtures), anchor the 91-day window
  // to the latest transaction date so the heatmap shows meaningful colors.
  const txnDates = Array.from(earningsMap.keys()).sort();
  const latestTxnDate = txnDates.length ? new Date(txnDates[txnDates.length - 1]) : new Date();
  const today = new Date();
  // choose endDate = max(today, latestTxnDate)
  const endDate = latestTxnDate > today ? latestTxnDate : today;
  const start = new Date(endDate);
  start.setDate(endDate.getDate() - (days - 1));

  const daysArr: { date: string; amount: number; dayOfWeek: number; weekNum: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = formatDate(d);
    const dayOfWeek = d.getDay(); // 0 = Sunday
    const weekNum = Math.floor(i / 7);
    daysArr.push({
      date: key,
      amount: earningsMap.get(key) ?? 0,
      dayOfWeek,
      weekNum,
    });
  }

  // compute thresholds using percentiles of non-zero values to avoid outlier skew
  const values = daysArr.map(d => d.amount);
  const nonZero = values.filter(v => v > 0).sort((a, b) => a - b);

  function percentile(arr: number[], p: number) {
    if (!arr.length) return 0;
    const idx = Math.floor((arr.length - 1) * p);
    return arr[idx];
  }

  const t20 = percentile(nonZero, 0.2) || 1;
  const t40 = percentile(nonZero, 0.4) || t20 + 1;
  const t60 = percentile(nonZero, 0.6) || t40 + 1;
  const t80 = percentile(nonZero, 0.8) || t60 + 1;

  const shadeIndex = (amount: number) => {
    if (amount === 0) return 0;
    if (amount >= t80) return 4;
    if (amount >= t60) return 3;
    if (amount >= t40) return 2;
    return 1;
  };

  const greenShades = [
    "#ebedf0",
    "#c6e48b",
    "#7bc96f",
    "#239a3b",
    "#196127",
  ];

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Build a 2D grid: rows (days of week) × columns (weeks)
  const weeksCount = Math.ceil(days / 7);
  const grid: (typeof daysArr[0] | null)[][] = Array(7)
    .fill(null)
    .map(() => Array(weeksCount).fill(null));

  for (const day of daysArr) {
    if (day.weekNum < weeksCount) {
      grid[day.dayOfWeek][day.weekNum] = day;
    }
  }

  return (
    <div className="w-full rounded-3xl bg-white p-4 shadow-[0_18px_60px_-30px_rgba(34,197,94,0.15)]">
      <div className="text-sm font-semibold mb-4 text-emerald-700">91-day earnings heatmap</div>

      {/* GitHub-style heatmap grid */}
      <div className="flex gap-2">
        {/* Day labels on the left */}
        <div className="flex flex-col justify-around pr-2 pt-1">
          {dayLabels.map((label, idx) => (
            <div
              key={idx}
              className="text-xs text-slate-400 h-6 flex items-center font-medium"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Weeks grid (horizontally scrollable on small screens) */}
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex gap-1">
            {Array(weeksCount)
              .fill(null)
              .map((_, weekNum) => (
                <div key={weekNum} className="flex flex-col gap-1">
                  {Array(7)
                    .fill(null)
                    .map((_, dayOfWeek) => {
                      const dayData = grid[dayOfWeek]?.[weekNum];
                      const color = dayData
                        ? greenShades[shadeIndex(dayData.amount)]
                        : "#ebedf0";
                      return (
                        <div
                          key={`${weekNum}-${dayOfWeek}`}
                          title={
                            dayData
                              ? `${dayData.date}: ₹${dayData.amount.toLocaleString()}`
                              : "No data"
                          }
                          className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 rounded-sm border border-slate-200 cursor-pointer transition hover:ring-2 hover:ring-emerald-400 hover:ring-offset-1"
                          style={{ backgroundColor: color }}
                        />
                      );
                    })}
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Less</span>
        <div className="flex gap-1 mx-2">
          {greenShades.map((shade, idx) => (
            <div
              key={idx}
              className="w-4 h-4 rounded-sm border border-slate-200"
              style={{ backgroundColor: shade }}
            />
          ))}
        </div>
        <span>More earnings</span>
      </div>
    </div>
  );
}

