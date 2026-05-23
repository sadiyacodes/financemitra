import { NextResponse } from 'next/server';
import { getUserTransactions, getUserProfile } from '../../../lib/memory/profile-store';
import { Transaction } from '../../../lib/types';

// ── Income metrics ────────────────────────────────────────────────────────────

interface IncomeMetrics {
  totalIncome: number;
  avgMonthly: number;
  avgWeekly: number;
  avgDaily: number;
  activeDays: number;
  totalDays: number;
  activityRate: number;
  stabilityScore: number;
  bestWeek: number;
  projectedAnnual: number;
  longestStreak: number;
  peakMonth: string;
  peakMonthAmount: number;
}

function computeMetrics(transactions: Transaction[]): IncomeMetrics {
  const income = transactions.filter(t => t.type === 'income');
  if (income.length === 0) {
    return {
      totalIncome: 0, avgMonthly: 0, avgWeekly: 0, avgDaily: 0,
      activeDays: 0, totalDays: 91, activityRate: 0, stabilityScore: 0,
      bestWeek: 0, projectedAnnual: 0, longestStreak: 0,
      peakMonth: '', peakMonthAmount: 0,
    };
  }

  const sortedDates = income.map(t => t.date.slice(0, 10)).sort();
  const firstDate = new Date(sortedDates[0]);
  const lastDate = new Date(sortedDates[sortedDates.length - 1]);
  const totalDays = Math.max(91, Math.ceil((lastDate.getTime() - firstDate.getTime()) / 86_400_000) + 1);

  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const avgDaily = totalIncome / totalDays;
  const avgMonthly = Math.round(avgDaily * 30);
  const avgWeekly = Math.round(avgDaily * 7);

  // Active earning days
  const activeDaySet = new Set(income.map(t => t.date.slice(0, 10)));
  const activeDays = activeDaySet.size;
  const activityRate = Math.round((activeDays / totalDays) * 100);

  // Weekly totals for stability
  const weekMap = new Map<string, number>();
  for (const t of income) {
    const d = new Date(t.date);
    const dayOfWeek = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    weekMap.set(key, (weekMap.get(key) ?? 0) + t.amount);
  }
  const weeklyAmounts = Array.from(weekMap.values());
  const avgW = weeklyAmounts.reduce((s, v) => s + v, 0) / (weeklyAmounts.length || 1);
  const variance = weeklyAmounts.reduce((s, v) => s + Math.pow(v - avgW, 2), 0) / (weeklyAmounts.length || 1);
  const cv = Math.sqrt(variance) / (avgW || 1);
  const stabilityScore = Math.max(0, Math.min(100, Math.round((1 - Math.min(cv, 1)) * 100)));
  const bestWeek = Math.round(Math.max(...weeklyAmounts, 0));

  // Monthly totals for peak month
  const monthMap = new Map<string, number>();
  for (const t of income) {
    const key = t.date.slice(0, 7); // YYYY-MM
    monthMap.set(key, (monthMap.get(key) ?? 0) + t.amount);
  }
  let peakMonth = '';
  let peakMonthAmount = 0;
  Array.from(monthMap.entries()).forEach(([month, total]) => {
    if (total > peakMonthAmount) { peakMonth = month; peakMonthAmount = total; }
  });

  // Longest earning streak
  const allActiveDates = Array.from(activeDaySet).sort();
  let longestStreak = 0;
  let currentStreak = 0;
  for (let i = 0; i < allActiveDates.length; i++) {
    if (i === 0) {
      currentStreak = 1;
    } else {
      const prev = new Date(allActiveDates[i - 1]);
      const curr = new Date(allActiveDates[i]);
      const diff = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
      currentStreak = diff === 1 ? currentStreak + 1 : 1;
    }
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  return {
    totalIncome: Math.round(totalIncome),
    avgMonthly,
    avgWeekly,
    avgDaily: Math.round(avgDaily),
    activeDays,
    totalDays,
    activityRate,
    stabilityScore,
    bestWeek,
    projectedAnnual: Math.round(avgDaily * 365),
    longestStreak,
    peakMonth,
    peakMonthAmount: Math.round(peakMonthAmount),
  };
}

// ── Narrative prompt ──────────────────────────────────────────────────────────

function buildPrompt(profile: ReturnType<typeof getUserProfile>, metrics: IncomeMetrics): string {
  const peakMonthLabel = metrics.peakMonth
    ? new Date(metrics.peakMonth + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    : 'N/A';

  return `You are a financial analyst generating a professional income verification narrative for a gig worker applying for credit or a loan.

Applicant: ${profile!.name}, ${profile!.city} — ${profile!.type.replace(/_/g, ' ')}

Verified Income Metrics (last ${metrics.totalDays} days of transaction data):
- Total income earned: ₹${metrics.totalIncome.toLocaleString()}
- Average monthly income: ₹${metrics.avgMonthly.toLocaleString()}
- Average weekly income: ₹${metrics.avgWeekly.toLocaleString()}
- Average daily income: ₹${metrics.avgDaily.toLocaleString()}
- Active earning days: ${metrics.activeDays} of ${metrics.totalDays} days (${metrics.activityRate}% activity rate)
- Income stability score: ${metrics.stabilityScore}/100 (lower coefficient of variation = higher score)
- Best single week: ₹${metrics.bestWeek.toLocaleString()}
- Peak month: ${peakMonthLabel} (₹${metrics.peakMonthAmount.toLocaleString()})
- Longest consecutive earning streak: ${metrics.longestStreak} days
- Projected annual income: ₹${metrics.projectedAnnual.toLocaleString()}

Write a professional credit assessment narrative in exactly 3 paragraphs:

Paragraph 1 — Income Profile: Describe the applicant's income capacity, earning pattern, and overall financial activity level. Mention key figures naturally.

Paragraph 2 — Stability & Reliability: Assess the consistency of income for EMI servicing. Reference the stability score, activity rate, and streak. Based on the 20% EMI rule (EMI should not exceed 20% of average monthly income), state the recommended maximum monthly EMI: ₹${Math.round(metrics.avgMonthly * 0.2).toLocaleString()}.

Paragraph 3 — Creditworthiness Summary: Provide a concise creditworthiness assessment. Be factual and specific. End with a one-line recommendation for lenders.

Rules: Use ₹ notation. Write in third person. Be professional and factual. Do not include generic disclaimers or hedging language. Do not use bullet points — pure prose only.`;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const profile = getUserProfile(userId);
    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const transactions = getUserTransactions(userId);
    const metrics = computeMetrics(transactions);

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const useMock = !anthropicKey || anthropicKey === 'your_api_key_here';

    let narrative: string;

    if (useMock) {
      const maxEmi = Math.round(metrics.avgMonthly * 0.2);
      narrative = `${profile.name} is an active ${profile.type.replace(/_/g, ' ')} based in ${profile.city}, with verified income of ₹${metrics.totalIncome.toLocaleString()} over the past ${metrics.totalDays} days. The applicant maintains an average monthly income of ₹${metrics.avgMonthly.toLocaleString()}, with an average daily earning of ₹${metrics.avgDaily.toLocaleString()}, demonstrating consistent engagement with the gig economy.

The applicant's income stability score of ${metrics.stabilityScore}/100 reflects a ${metrics.stabilityScore >= 70 ? 'reliable and consistent' : metrics.stabilityScore >= 50 ? 'moderately consistent' : 'variable'} earning pattern, with ${metrics.activeDays} active earning days out of ${metrics.totalDays} (${metrics.activityRate}% activity rate). A longest consecutive earning streak of ${metrics.longestStreak} days further supports the applicant's capacity for sustained income generation. Based on the 20% EMI affordability rule, the recommended maximum monthly EMI is ₹${maxEmi.toLocaleString()}.

Based on the verified transaction data, ${profile.name} demonstrates ${metrics.stabilityScore >= 70 ? 'strong' : metrics.stabilityScore >= 50 ? 'adequate' : 'moderate'} creditworthiness for a consumer or vehicle loan. The projected annual income of ₹${metrics.projectedAnnual.toLocaleString()} and demonstrated earning consistency support loan eligibility within standard gig-worker risk frameworks. Recommended for consideration subject to standard KYC and credit bureau verification.`;
    } else {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{ role: 'user', content: buildPrompt(profile, metrics) }],
        }),
      });

      if (!res.ok) throw new Error(`Claude API error ${res.status}`);
      const data = await res.json();
      narrative = data.content?.[0]?.text ?? '';
    }

    return NextResponse.json({ narrative, metrics });
  } catch (err: any) {
    console.error('Credit narrative error:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate narrative' }, { status: 500 });
  }
}
