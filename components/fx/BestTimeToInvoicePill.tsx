import type { FXTimingSignal } from "../../lib/types";

interface BestTimeToInvoicePillProps {
  timingSignal: FXTimingSignal;
  currencyCode: string;
}

export default function BestTimeToInvoicePill({ timingSignal, currencyCode }: BestTimeToInvoicePillProps) {
  const { signal, label, currentRate, fourWeekAverage } = timingSignal;

  let bg, border, text, icon;

  if (signal === "good_time") {
    bg = "bg-green-50";
    border = "border-green-200";
    text = "text-green-700";
    icon = (
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    );
  } else if (signal === "wait") {
    bg = "bg-amber-50";
    border = "border-amber-200";
    text = "text-amber-700";
    icon = (
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    );
  } else {
    bg = "bg-gray-50";
    border = "border-gray-200";
    text = "text-gray-600";
    icon = (
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    );
  }

  return (
    <div className="mt-3 flex flex-col items-start">
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[13px] font-medium ${bg} ${border} ${text}`}>
        {icon}
        {label}
      </div>
      <div className="text-[11px] text-gray-500 mt-1 ml-1">
        1 {currencyCode} = ₹{currentRate} · 4-week avg: ₹{fourWeekAverage}
      </div>
    </div>
  );
}
