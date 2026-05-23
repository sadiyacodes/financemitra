import React from 'react';

export function HealthScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const gap = circumference - filled;

  const colorMap: Record<string, string> = {
    green: '#16a34a',
    amber: '#d97706',
    orange: '#ea580c',
    red: '#dc2626'
  };

  const strokeColor = colorMap[color] || '#16a34a';

  return (
    <div className="relative flex flex-col items-center justify-center w-[120px] h-[120px]">
      <svg width="120" height="120" viewBox="0 0 120 120">
        {/* Background Track */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="10"
        />
        {/* Progress Arc */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="10"
          strokeDasharray={`${filled} ${gap}`}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
        />
      </svg>
      {/* Centered Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-bold text-gray-800 leading-none">{score}</span>
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-1">{label}</span>
      </div>
    </div>
  );
}
