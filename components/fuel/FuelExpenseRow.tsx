import type { FuelApiResponse } from "../../lib/types";

interface FuelExpenseRowProps {
  fuelAmount: number;
  fuelData: FuelApiResponse;
}

export default function FuelExpenseRow({ fuelAmount, fuelData }: FuelExpenseRowProps) {
  const { currentPetrol } = fuelData.priceChange;
  const { monthlyDelta, isCostIncreased, avgKmPerDay, avgKmPerLitre } = fuelData.driverImpact;
  const { nextRevisionDate } = fuelData.price;

  let deltaContent;
  if (monthlyDelta === 0) {
    deltaContent = <span className="text-gray-500">unchanged</span>;
  } else if (isCostIncreased) {
    deltaContent = <span className="text-amber-600">↑ ₹{monthlyDelta}/mo</span>;
  } else {
    deltaContent = <span className="text-green-600">↓ ₹{Math.abs(monthlyDelta)}/mo</span>;
  }

  const tooltipText = `Based on ~${avgKmPerDay}km/day at ${avgKmPerLitre}km/litre. 
Next IOC revision: ${nextRevisionDate}
Last updated: ${fuelData.price.lastUpdated}`;

  return (
    <div 
      className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-help"
      title={tooltipText}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600">
            <path d="M3 22L3 9c0-1.7 1.3-3 3-3h6c1.7 0 3 1.3 3 3v13"></path>
            <path d="M11 12H7"></path>
            <path d="M3 22h12"></path>
            <path d="M15 12h2a2 2 0 0 1 2 2v6h2V8l-3-3.6a2 2 0 0 0-1.5-.6h-3"></path>
          </svg>
        </div>
        <span className="font-medium text-gray-800">Fuel</span>
      </div>

      <div className="flex items-center gap-6">
        <span className="font-bold text-gray-900">₹{fuelAmount}</span>
        <div className="flex flex-col items-end text-[11px]">
          <span className="text-gray-500">₹{currentPetrol}/litre</span>
          {deltaContent}
        </div>
      </div>
    </div>
  );
}
