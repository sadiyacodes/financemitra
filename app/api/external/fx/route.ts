import { NextRequest, NextResponse } from "next/server";
import type { Transaction } from "../../../../lib/types";
import { fetchExchangeRate, detectPrimaryCurrency } from "../../../../lib/engine/external/mock-exchange-api";
import transactionsData from "../../../../data/transactions.json";
import usersData from "../../../../data/users.json";

const FREELANCE_TYPES = ["freelance_designer", "freelance_developer", "freelance_writer", "freelancer"];

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const currencyOverride = req.nextUrl.searchParams.get("currency");

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = usersData.find(u => u.id === userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Guard: only serve to freelance users
  if (!FREELANCE_TYPES.includes(user.type)) {
    return NextResponse.json(
      { error: "FX data is only available for freelancer profiles" },
      { status: 403 }
    );
  }

  // Auto-detect currency from transaction history if not provided
  const userTransactions = (transactionsData.filter(t => t.user_id === userId) as unknown) as Transaction[];
  const currency = currencyOverride ?? detectPrimaryCurrency(userTransactions);

  const fxData = fetchExchangeRate(currency);

  await new Promise(res => setTimeout(res, 350));

  return NextResponse.json(fxData);
}
