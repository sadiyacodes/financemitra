import { useState, useEffect } from "react";
import type { FXApiResponse, PendingInvoiceResult } from "../../lib/types";
import { calculatePendingInvoice } from "../../lib/engine/external/mock-exchange-api";

interface PendingInvoiceCalculatorProps {
  defaultCurrency: string;
  fxData: FXApiResponse;
}

export default function PendingInvoiceCalculator({ defaultCurrency, fxData }: PendingInvoiceCalculatorProps) {
  const [foreignAmount, setForeignAmount] = useState<number | "">("");
  const [selectedCurrency, setSelectedCurrency] = useState(defaultCurrency);
  const [result, setResult] = useState<PendingInvoiceResult | null>(null);

  useEffect(() => {
    if (foreignAmount && typeof foreignAmount === "number" && foreignAmount > 0) {
      setResult(calculatePendingInvoice(foreignAmount, selectedCurrency));
    } else {
      setResult(null);
    }
  }, [foreignAmount, selectedCurrency]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      setForeignAmount("");
    } else {
      setForeignAmount(Number(val));
    }
  };

  return (
    <div className="mt-2 bg-white border border-gray-200 rounded-xl p-3 shadow-sm w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium text-gray-900">Pending invoice</span>
        <select
          value={selectedCurrency}
          onChange={(e) => setSelectedCurrency(e.target.value)}
          className="text-[12px] border border-gray-200 rounded px-1.5 py-0.5 bg-transparent text-gray-900 focus:outline-none focus:border-blue-300"
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="AED">AED</option>
          <option value="SGD">SGD</option>
        </select>
      </div>

      <div className="flex items-center mt-2">
        <span className="text-[14px] text-gray-500 mr-1">{fxData.rate.symbol}</span>
        <input
          type="number"
          min="0"
          placeholder="0"
          value={foreignAmount}
          onChange={handleAmountChange}
          className="text-[18px] font-medium w-[120px] bg-transparent outline-none focus:ring-0 p-0 border-none"
        />
      </div>

      {result && typeof foreignAmount === "number" && foreignAmount > 0 && (
        <>
          <div className="h-px bg-gray-200 my-2" />
          
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-[11px]">Today</span>
              <span className="text-gray-900 text-[16px] font-medium">₹{result.inrValueToday}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-[11px]">Last week</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-600 text-[13px]">₹{result.inrValueLastWeek}</span>
                <span className={`text-[11px] ${result.deltaVsLastWeek >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {result.deltaVsLastWeek >= 0 ? "+" : "-"}₹{Math.abs(result.deltaVsLastWeek)}
                </span>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-[11px]">4-week avg</span>
              <span className="text-gray-600 text-[13px]">₹{result.inrValueFourWeekAvg}</span>
            </div>
          </div>

          <div className="mt-2 text-[12px] text-gray-600 italic">
            {result.recommendation}
          </div>
          
          <div className="mt-1 text-[10px] text-gray-400 text-right">
            Last updated: {fxData.rate.lastUpdated}
          </div>
        </>
      )}
    </div>
  );
}
