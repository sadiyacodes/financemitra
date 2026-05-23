import { NextRequest, NextResponse } from "next/server";
import { fetchFuelPrice } from "../../../../lib/engine/external/mock-fuel-api";
import usersData from "../../../../data/users.json";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = usersData.find(u => u.id === userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Guard: only serve to drivers
  if (user.type !== "ride_share_driver") {
    return NextResponse.json(
      { error: "Fuel data is only available for ride-share driver profiles" },
      { status: 403 }
    );
  }

  const fuelData = fetchFuelPrice(user.city);

  // Populate the updatedMonthlyExpense field using the user's actual fixed expenses
  fuelData.driverImpact.updatedMonthlyExpense =
    user.monthly_fixed_expenses + fuelData.driverImpact.currentMonthlyCost;

  // Add a small simulated delay to feel like a real API call in the demo
  await new Promise(res => setTimeout(res, 400));

  return NextResponse.json(fuelData);
}
