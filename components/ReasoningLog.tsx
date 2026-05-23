import { useState } from "react";
import { ReasoningStep } from "../lib/types";

export default function ReasoningLog({ steps }: { steps: ReasoningStep[] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!steps || steps.length === 0) return null;

  return (
    <div className="my-2 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-950 max-w-2xl shadow-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900 flex justify-between items-center transition-colors border-b border-transparent data-[open=true]:border-gray-200 dark:data-[open=true]:border-gray-800"
        data-open={isOpen}
      >
        <span className="flex items-center gap-2">
          <span className="font-mono text-gray-400">{isOpen ? '[-]' : '[+]'}</span>
          Agent Reasoning Log
        </span>
      </button>
      
      {isOpen && (
        <div className="p-4 bg-gray-50 dark:bg-gray-950 flex flex-col gap-5 border-t border-gray-100 dark:border-gray-800 max-h-96 overflow-y-auto">
          {steps.map((s, i) => (
             <div key={i} className="text-[13px] font-mono text-gray-700 dark:text-gray-300">
                <div className="font-bold text-teal-700 dark:text-teal-500 mb-1.5 flex items-center gap-2">
                   <span>Step {s.stepNumber}</span>
                   <span className="text-gray-400">·</span>
                   <span>{s.toolCalled ? `ACT → ${s.toolCalled}` : 'THINK'}</span>
                </div>
                <div className="whitespace-pre-wrap break-words pl-3 border-l-2 border-teal-200/50 dark:border-teal-900/50 leading-relaxed text-gray-600 dark:text-gray-400">
                   {s.toolCalled ? s.toolOutput : s.thought}
                </div>
             </div>
          ))}
        </div>
      )}
    </div>
  );
}
