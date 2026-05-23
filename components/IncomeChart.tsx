export default function IncomeChart({ incomeByWeek, averageWeekly }: { incomeByWeek: { week: string, total: number }[], averageWeekly: number }) {
  if (!incomeByWeek || incomeByWeek.length === 0) return <div className="text-sm text-gray-500">No income data</div>;

  const maxTotal = Math.max(...incomeByWeek.map(w => w.total), averageWeekly * 1.5);

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 h-full">
      <h3 className="font-bold text-gray-900 dark:text-white mb-4">Last 8 Weeks Income</h3>
      <div className="relative flex items-end justify-between h-48 gap-2 pt-4">
        {/* Average line */}
        <div 
          className="absolute left-0 right-0 border-t border-dashed border-gray-400 z-0" 
          style={{ bottom: `${(averageWeekly / maxTotal) * 100}%` }}
        >
          <span className="absolute -top-4 right-0 text-xs text-gray-500">Avg: ₹{averageWeekly}</span>
        </div>

        {incomeByWeek.slice(-8).map((w, idx) => {
          const height = (w.total / maxTotal) * 100;
          let color = "bg-red-500";
          if (w.total >= averageWeekly) color = "bg-teal-500";
          else if (w.total >= averageWeekly * 0.75) color = "bg-amber-400";

          return (
            <div key={idx} className="flex flex-col items-center flex-1 z-10 group relative">
              <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-gray-800 text-white text-xs rounded px-2 py-1 transition-opacity">
                ₹{w.total}
              </div>
              <div className={`w-full rounded-t-sm ${color}`} style={{ height: `${height}%` }}></div>
              <span className="text-[10px] text-gray-400 mt-2 truncate w-full text-center">{w.week.split('-W')[1]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
