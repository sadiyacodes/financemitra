import { NextResponse } from 'next/server';
import { getUserProfile, getUserTransactions } from '../../../lib/memory/profile-store';
import { analyzeIncome } from '../../../lib/engine/income-analyzer';
import { generateWeeklyDigest } from '../../../lib/engine/weekly-digest';

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
    const digest = generateWeeklyDigest(txns, income);

    return NextResponse.json(digest);
  } catch (err: any) {
     return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
