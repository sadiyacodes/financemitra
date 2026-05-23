import fuelData from "../../../data/fuel-prices.json";
import type { FuelApiResponse, DriverFuelImpact, FuelPriceChange } from "../../types";

export function fetchFuelPrice(city: string): FuelApiResponse {
  // Step 1: Normalize city name — fallback to Bengaluru if city not found
  const normalizedCity =
    (Object.keys(fuelData.prices) as string[]).find(
      c => c.toLowerCase() === city.toLowerCase()
    ) ?? "Bengaluru";

  const cityData = fuelData.prices[normalizedCity as keyof typeof fuelData.prices];
  const assumptions = fuelData.driver_assumptions;

  // Step 2: Pull current and previous from history array
  // history[0] = most recent, history[1] = previous revision
  const current = cityData.history[0];
  const previous = cityData.history[1];

  const petrolDelta = parseFloat((current.petrol - previous.petrol).toFixed(2));
  const dieselDelta = parseFloat((current.diesel - previous.diesel).toFixed(2));

  // Step 3: Compute next IOC revision date
  // IOC revises on 1st and 15th of every month
  const today = new Date();
  const day = today.getDate();
  const nextRevision =
    day < 15
      ? new Date(today.getFullYear(), today.getMonth(), 15)
      : new Date(today.getFullYear(), today.getMonth() + 1, 1);

  // Step 4: Compute driver monthly fuel cost
  const litresPerMonth =
    assumptions.litres_per_day * assumptions.working_days_per_month;
  const currentMonthlyCost = parseFloat(
    (litresPerMonth * current.petrol).toFixed(2)
  );
  const previousMonthlyCost = parseFloat(
    (litresPerMonth * previous.petrol).toFixed(2)
  );
  const monthlyDelta = parseFloat(
    (currentMonthlyCost - previousMonthlyCost).toFixed(2)
  );
  const dailyCost = parseFloat(
    (assumptions.litres_per_day * current.petrol).toFixed(2)
  );

  // Step 5: Compute overall trend across full history
  const newest = cityData.history[0].petrol;
  const oldest = cityData.history[cityData.history.length - 1].petrol;
  const overallDelta = newest - oldest;
  const trend: "rising" | "falling" | "stable" =
    overallDelta > 1 ? "rising" : overallDelta < -1 ? "falling" : "stable";

  // Step 6: Deterministic budget recommendation
  // Rules fire in order — first match wins
  let budgetRecommendation: string;
  if (monthlyDelta > 500) {
    budgetRecommendation = `Fuel costs have risen by ₹${monthlyDelta} this month — consider adding ₹${Math.ceil(monthlyDelta / 4)} to your weekly fuel budget and trimming discretionary spend.`;
  } else if (monthlyDelta > 0 && monthlyDelta <= 500) {
    budgetRecommendation = `A small fuel price increase adds ₹${monthlyDelta} to your monthly cost — your current budget can absorb this without changes.`;
  } else if (monthlyDelta < -500) {
    budgetRecommendation = `Fuel prices dropped by ₹${Math.abs(monthlyDelta)} this month — a good opportunity to redirect that saving toward your emergency fund.`;
  } else if (monthlyDelta < 0) {
    budgetRecommendation = `A small fuel price drop saves you ₹${Math.abs(monthlyDelta)} this month — consider putting the difference toward your savings goal.`;
  } else {
    budgetRecommendation = `Fuel prices are unchanged since the last revision — your fuel budget remains on track.`;
  }

  const driverImpact: DriverFuelImpact = {
    currentMonthlyCost,
    previousMonthlyCost,
    monthlyDelta,
    dailyCost,
    litresPerMonth,
    avgKmPerDay: assumptions.avg_km_per_day,
    avgKmPerLitre: assumptions.avg_km_per_litre,
    workingDaysPerMonth: assumptions.working_days_per_month,
    isCostIncreased: monthlyDelta > 0,
    budgetRecommendation,
    // updatedMonthlyExpense is computed in the API route using userProfile.monthly_fixed_expenses
    updatedMonthlyExpense: 0  // placeholder — populated in API route
  };

  const priceChange: FuelPriceChange = {
    hasPriceChanged: petrolDelta !== 0 || dieselDelta !== 0,
    previousPetrol: previous.petrol,
    currentPetrol: current.petrol,
    petrolDelta,
    dieselDelta,
    petrolDeltaPercent: parseFloat(
      ((petrolDelta / previous.petrol) * 100).toFixed(2)
    ),
    changeDate: current.date,
    previousDate: previous.date,
    trend
  };

  return {
    price: {
      city: normalizedCity,
      petrol: current.petrol,
      diesel: current.diesel,
      lastUpdated: current.date,
      nextRevisionDate: nextRevision.toISOString().split("T")[0],
      source: fuelData.meta.source
    },
    priceChange,
    driverImpact
  };
}
