import { useState } from "react";
import type { FuelPriceChange, DriverFuelImpact } from "../../lib/types";

interface FuelPriceBannerProps {
  priceChange: FuelPriceChange;
  driverImpact: DriverFuelImpact;
  city: string;
  onDismiss: () => void;
  onAffectMeClick: () => void;
}

export default function FuelPriceBanner({
  priceChange,
  driverImpact,
  city,
  onDismiss,
  onAffectMeClick
}: FuelPriceBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (!priceChange.hasPriceChanged || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss();
  };

  const isCostIncreased = driverImpact.isCostIncreased;

  return (
    <div className={`flex items-center justify-between w-full h-[44px] px-4 mb-4 ${isCostIncreased ? 'bg-amber-50 border-l-4 border-amber-400' : 'bg-green-50 border-l-4 border-green-400'}`}>
      <div className="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isCostIncreased ? "text-amber-500" : "text-green-500"}>
          <path d="M3 22L3 9c0-1.7 1.3-3 3-3h6c1.7 0 3 1.3 3 3v13"></path>
          <path d="M11 12H7"></path>
          <path d="M3 22h12"></path>
          <path d="M15 12h2a2 2 0 0 1 2 2v6h2V8l-3-3.6a2 2 0 0 0-1.5-.6h-3"></path>
        </svg>
        <span className="text-[13px] text-gray-600">
          Petrol in {city} revised to ₹{priceChange.currentPetrol}/litre on {priceChange.changeDate}
        </span>
        <span className={`text-[12px] font-medium px-[8px] py-[1px] rounded-full ${isCostIncreased ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
          {priceChange.petrolDelta > 0 ? "+" : ""}₹{priceChange.petrolDelta}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={onAffectMeClick} className="text-[12px] text-teal-600 bg-transparent cursor-pointer font-medium hover:underline">
          How does this affect me?
        </button>
        <button onClick={handleDismiss} className="text-[16px] text-gray-500 cursor-pointer hover:text-gray-700">
          ×
        </button>
      </div>
    </div>
  );
}
