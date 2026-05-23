import React from 'react';
import { ScenarioResult } from '../lib/types';

export function ScenarioTable({ result, onSuggestionClick }: { result: ScenarioResult, onSuggestionClick?: (msg: string) => void }) {
  const { optionA, optionB, verdict } = result;

  const getRiskColor = (risk: string) => {
    if (risk === 'Low') return 'text-green-700 bg-green-100';
    if (risk === 'Medium') return 'text-amber-700 bg-amber-100';
    return 'text-red-700 bg-red-100';
  };

  return (
    <div className="w-full max-w-2xl my-3 rounded-xl border border-gray-200 overflow-hidden bg-white text-sm shadow-sm dark:bg-gray-900 dark:border-gray-800">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 uppercase text-[11px] tracking-wider text-gray-500 font-bold">
            <th className="p-3">Comparison</th>
            <th className="p-3 border-l border-gray-200 dark:border-gray-700">{optionA.label}</th>
            <th className="p-3 border-l border-gray-200 dark:border-gray-700">{optionB.label}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          <tr>
            <td className="p-3 font-medium text-gray-700 dark:text-gray-300">Total Cost</td>
            <td className={`p-3 border-l border-gray-200 dark:border-gray-800 ${optionA.totalCost <= optionB.totalCost ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
              ₹{optionA.totalCost.toLocaleString()}
            </td>
            <td className={`p-3 border-l border-gray-200 dark:border-gray-800 ${optionB.totalCost <= optionA.totalCost ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
              ₹{optionB.totalCost.toLocaleString()}
            </td>
          </tr>
          <tr>
            <td className="p-3 font-medium text-gray-700 dark:text-gray-300">Monthly Impact</td>
            <td className={`p-3 border-l border-gray-200 dark:border-gray-800 ${optionA.monthlyImpact <= optionB.monthlyImpact ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
              ₹{optionA.monthlyImpact.toLocaleString()}/mo
            </td>
            <td className={`p-3 border-l border-gray-200 dark:border-gray-800 ${optionB.monthlyImpact <= optionA.monthlyImpact ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
              ₹{optionB.monthlyImpact.toLocaleString()}/mo
            </td>
          </tr>
          <tr>
            <td className="p-3 font-medium text-gray-700 dark:text-gray-300">Goal Delayed By</td>
            <td className={`p-3 border-l border-gray-200 dark:border-gray-800 ${optionA.goalDelayMonths <= optionB.goalDelayMonths ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
              {optionA.goalDelayMonths} months
            </td>
            <td className={`p-3 border-l border-gray-200 dark:border-gray-800 ${optionB.goalDelayMonths <= optionA.goalDelayMonths ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
              {optionB.goalDelayMonths} months
            </td>
          </tr>
          <tr>
             <td className="p-3 font-medium text-gray-700 dark:text-gray-300">Risk in Slow Month</td>
             <td className="p-3 border-l border-gray-200 dark:border-gray-800">
               <span className={`px-2 py-1 rounded text-xs font-semibold ${getRiskColor(optionA.slowMonthRisk)}`}>{optionA.slowMonthRisk}</span>
             </td>
             <td className="p-3 border-l border-gray-200 dark:border-gray-800">
               <span className={`px-2 py-1 rounded text-xs font-semibold ${getRiskColor(optionB.slowMonthRisk)}`}>{optionB.slowMonthRisk}</span>
             </td>
          </tr>
        </tbody>
      </table>
      <div className="p-4 bg-teal-50 dark:bg-teal-900/20 border-l-4 border-teal-500 text-teal-900 dark:text-teal-100 mt-0 text-sm leading-relaxed font-medium">
        {verdict}
      </div>
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 flex justify-center">
        <button 
          onClick={() => onSuggestionClick && onSuggestionClick("Run this for a different EMI amount or timeline")}
          className="text-xs font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-sm rounded-full px-4 py-1.5 text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 focus:outline-none transition-colors"
        >
          Want me to run this for a different EMI amount or timeline?
        </button>
      </div>
    </div>
  );
}
