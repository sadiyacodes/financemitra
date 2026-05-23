export default function SavingsGoalCard({ label, target, current, dateEstimate, onTransferClick }: { label: string, target: number, current: number, dateEstimate: string, onTransferClick?: () => void }) {
  const pcnt = Math.min((current/target)*100, 100);
  
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 h-full flex flex-col justify-between">
      <div>
        <h3 className="font-bold text-gray-900 dark:text-white mb-1">Savings Goal</h3>
        <p className="text-xl font-extrabold text-teal-600">{label}</p>
      </div>
      
      <div className="my-6">
        <div className="flex justify-between text-sm mb-2 font-medium">
          <span className="text-gray-700 dark:text-gray-300">₹{current}</span>
          <span className="text-gray-500">Target: ₹{target}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700 overflow-hidden">
          <div className="bg-teal-500 h-3 rounded-full transition-all duration-1000" style={{ width: `${pcnt}%` }}></div>
        </div>
      </div>
      
      {dateEstimate && (
        <p className="text-sm text-gray-500 bg-teal-50 dark:bg-teal-900/10 p-2 rounded text-center">
          Estimated completion: <span className="font-semibold text-teal-700 dark:text-teal-400">{new Date(dateEstimate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
        </p>
      )}

      <button
        onClick={() => {
          if (onTransferClick) onTransferClick();
          else window.location.href = `/chat?prefill=${encodeURIComponent("I want to transfer my savings — which app should I use?")}`;
        }}
        className="w-full mt-3 py-2 px-4 rounded-lg border border-teal-200 bg-teal-50 text-teal-700 text-sm font-medium hover:bg-teal-100 hover:border-teal-300 transition-colors cursor-pointer"
      >
        Transfer to savings →
      </button>
    </div>
  );
}
