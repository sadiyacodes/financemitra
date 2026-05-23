import { PersonalizedBankingOptions } from "../lib/utils/banking-personalizer";

interface Props {
  options: PersonalizedBankingOptions;
  recommendedAmount?: number;
  goalLabel?: string;
  onClose?: () => void;
}

export function BankingRedirectCard({ options, recommendedAmount, goalLabel, onClose }: Props) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 max-w-[420px] mt-2 shadow-sm font-sans">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">Transfer to savings</h4>
          {recommendedAmount && (
            <p className="text-[12px] text-gray-500 mt-1">Recommended: ₹{recommendedAmount} → {goalLabel || "Savings"}</p>
          )}
        </div>
        <button onClick={onClose} className="text-[16px] text-gray-400 hover:text-gray-600">×</button>
      </div>

      <p className="text-[11px] text-gray-400 italic mt-1 mb-3">FinanceMitra doesn't handle transfers — choose your preferred app below.</p>
      
      {options.detectedCount === 0 && (
         <p className="text-[11px] text-gray-500 mb-2">We couldn't detect your preferred app — choose from the options below.</p>
      )}

      {options.primarySuggestion && (
        <div className="rounded-lg p-2.5 flex items-center justify-between mb-3 border" style={{ backgroundColor: `${options.primarySuggestion.color}14`, borderColor: `${options.primarySuggestion.color}4D` }}>
          <div className="flex items-center">
            <span className="text-[10px] rounded-full px-1.5 py-0.5" style={{ backgroundColor: options.primarySuggestion.color, color: options.primarySuggestion.textColor }}>Detected</span>
            <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100 ml-2">{options.primarySuggestion.name}</span>
          </div>
          <button onClick={() => window.open(options.primarySuggestion!.url, "_blank", "noopener noreferrer")} className="rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-opacity hover:opacity-90" style={{ backgroundColor: options.primarySuggestion.color, color: options.primarySuggestion.textColor }}>
            Open
          </button>
        </div>
      )}

      <div className="h-px w-full bg-gray-200 dark:bg-gray-800 my-3" />

      <h5 className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mt-3 mb-1.5">UPI Apps</h5>
      <div className="grid grid-cols-2 gap-1.5">
        {options.upiApps.map(app => (
          <div key={app.id} onClick={() => window.open(app.url, "_blank", "noopener noreferrer")} className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 hover:border-teal-300 rounded-lg p-2 flex items-center justify-between cursor-pointer transition-colors">
            <span className="text-[13px] text-gray-800 dark:text-gray-200 flex items-center">
              {app.name}
              {app.isDetected && <span className="text-green-500 text-[8px] ml-1.5">●</span>}
            </span>
            <span className="text-[12px] text-gray-400">→</span>
          </div>
        ))}
      </div>

      <h5 className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mt-3.5 mb-1">Net Banking</h5>
      <div className="flex flex-col">
        {options.netBanking.map((bank, i) => (
          <div key={bank.id} className={`flex items-center justify-between h-9 px-1 ${i !== options.netBanking.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}>
            <div className="flex items-center">
              <span className="text-[10px]" style={{ color: bank.color }}>●</span>
              <span className="text-[13px] text-gray-800 dark:text-gray-200 ml-1.5">{bank.name}</span>
              {bank.isDetected && <span className="text-[11px] text-gray-400 ml-1">(detected)</span>}
            </div>
            <button onClick={() => window.open(bank.url, "_blank", "noopener noreferrer")} className="text-[12px] text-teal-600 dark:text-teal-400 hover:underline">Open →</button>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 text-center">
        <span className="text-[10px] text-gray-400">All links open official websites in a new tab.</span>
      </div>
    </div>
  );
}
