import { NextResponse } from 'next/server';
import { getUserProfile, getUserTransactions } from '../../../lib/memory/profile-store';
import { analyzeIncome } from '../../../lib/engine/income-analyzer';
import { trackExpenses } from '../../../lib/engine/expense-tracker';
import { planSavings } from '../../../lib/engine/savings-planner';
import { forecastIncome } from '../../../lib/engine/income-forecaster';
import { generateAlerts } from '../../../lib/engine/alert-engine';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const profile = getUserProfile(userId);
  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const txns = getUserTransactions(userId);

  try {
    const income = analyzeIncome(txns, profile);
    const exp = trackExpenses(txns, userId);
    const plan = planSavings(income, exp, profile.savings_goal);
    const forecast = forecastIncome(txns, userId);

    const alerts = generateAlerts(income, exp, plan, forecast, profile);

    return NextResponse.json({ alerts, healthScore: income.healthScore });
  } catch (err: any) {
     return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
