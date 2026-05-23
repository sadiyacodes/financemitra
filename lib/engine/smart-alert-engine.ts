import { Transaction, UserProfile } from '../types';

// ── City-specific event calendars ─────────────────────────────────────────────
const BENGALURU_EVENTS = [
  { date: "2026-03-22", event_name: "RCB Match – IPL 2026", demand_multiplier: 1.9 },
  { date: "2026-03-28", event_name: "IPL Match – RCB vs MI", demand_multiplier: 1.8 },
  { date: "2026-04-04", event_name: "IPL Match – RCB vs CSK", demand_multiplier: 1.7 },
  { date: "2026-04-12", event_name: "Startup Summit Bengaluru", demand_multiplier: 1.5 },
  { date: "2026-05-01", event_name: "May Day Holiday", demand_multiplier: 1.5 },
  { date: "2026-05-10", event_name: "City Music Fest", demand_multiplier: 1.6 },
  { date: "2026-05-24", event_name: "IPL Playoff – Bengaluru", demand_multiplier: 2.1 },
  { date: "2026-05-31", event_name: "IPL Final Weekend", demand_multiplier: 2.0 },
  { date: "2026-06-07", event_name: "Bengaluru Tech Summit", demand_multiplier: 1.6 },
];

const HYDERABAD_EVENTS = [
  { date: "2026-03-15", event_name: "SRH vs RCB – IPL Home Match", demand_multiplier: 1.8 },
  { date: "2026-03-25", event_name: "SRH vs KKR – IPL Home Match", demand_multiplier: 1.7 },
  { date: "2026-04-06", event_name: "SRH vs DC – IPL Home Match", demand_multiplier: 1.7 },
  { date: "2026-04-18", event_name: "HITEC City Startup Summit", demand_multiplier: 1.4 },
  { date: "2026-05-01", event_name: "May Day Holiday", demand_multiplier: 1.4 },
  { date: "2026-05-11", event_name: "Hyderabad Music Festival", demand_multiplier: 1.5 },
  { date: "2026-05-22", event_name: "SRH IPL Qualifier", demand_multiplier: 1.9 },
  { date: "2026-05-29", event_name: "IPL Final Weekend – Hyderabad", demand_multiplier: 1.8 },
];

function getCityEvents(city: string) {
  if (city.toLowerCase().includes("hyderabad")) return HYDERABAD_EVENTS;
  return BENGALURU_EVENTS; // default for Bengaluru and any unrecognised city
}

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function earningsOnDate(date: string, txns: Transaction[]): number {
  return txns
    .filter(t => t.type === "income" && t.date.slice(0, 10) === date)
    .reduce((s, t) => s + t.amount, 0);
}

function earningsInRange(from: Date, to: Date, txns: Transaction[]): number {
  return txns
    .filter(t => {
      if (t.type !== "income") return false;
      const d = new Date(t.date);
      return d >= from && d <= to;
    })
    .reduce((s, t) => s + t.amount, 0);
}

function avgWeeklyIncome(txns: Transaction[]): number {
  const income = txns.filter(t => t.type === "income");
  if (!income.length) return 0;
  const total = income.reduce((s, t) => s + t.amount, 0);
  const dates = income.map(t => t.date.slice(0, 10)).sort();
  const span = Math.max(
    7,
    Math.ceil((new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / 86_400_000) + 1
  );
  return (total / span) * 7;
}

function avgByDayOfWeek(txns: Transaction[]): number[] {
  const sums = Array(7).fill(0);
  const counts = Array(7).fill(0);
  for (const t of txns) {
    if (t.type !== "income") continue;
    const dow = new Date(t.date).getDay();
    sums[dow] += t.amount;
    counts[dow]++;
  }
  return sums.map((s, i) => (counts[i] > 0 ? Math.round(s / counts[i]) : 0));
}

// ── Trigger types ─────────────────────────────────────────────────────────────

export interface SmartTrigger {
  kind: "upcoming_event" | "weekly_pace" | "day_opportunity" | "streak_risk" | "post_event_gap";
  data: Record<string, string | number | boolean>;
}

// ── Main trigger detector ─────────────────────────────────────────────────────

export function detectTriggers(
  txns: Transaction[],
  profile: UserProfile
): SmartTrigger[] {
  const triggers: SmartTrigger[] = [];
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const dow = today.getDay();

  const avgWeekly = avgWeeklyIncome(txns);
  const byDow = avgByDayOfWeek(txns);
  const cityEvents = getCityEvents(profile.city);

  // ── Trigger 1: Upcoming high-demand event in next 7 days ─────────────────
  for (const ev of cityEvents) {
    const evDate = new Date(ev.date);
    const daysAway = Math.round((evDate.getTime() - today.getTime()) / 86_400_000);
    if (daysAway < 0 || daysAway > 7) continue;

    // Did user work during a past similar event?
    const pastEvents = cityEvents.filter(e => e.date < todayStr && e.demand_multiplier >= ev.demand_multiplier - 0.2);
    const pastPerformances = pastEvents.map(e => earningsOnDate(e.date, txns)).filter(v => v > 0);
    const avgPastEventEarning = pastPerformances.length
      ? Math.round(pastPerformances.reduce((a, b) => a + b, 0) / pastPerformances.length)
      : 0;

    triggers.push({
      kind: "upcoming_event",
      data: {
        event_name: ev.event_name,
        event_date: ev.date,
        days_away: daysAway,
        demand_multiplier: ev.demand_multiplier,
        avg_past_event_earning: avgPastEventEarning,
        avg_daily: Math.round(avgWeekly / 7),
      },
    });
    break; // one event alert max
  }

  // ── Trigger 2: Current week pace vs average ───────────────────────────────
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dow);
  weekStart.setHours(0, 0, 0, 0);
  const weekEarnings = earningsInRange(weekStart, today, txns);
  const daysIntoWeek = Math.max(dow, 1);
  const paceExpected = (avgWeekly / 7) * daysIntoWeek;
  const paceRatio = paceExpected > 0 ? weekEarnings / paceExpected : 1;
  const daysLeftInWeek = 6 - dow;

  if (paceRatio < 0.65 && daysIntoWeek >= 2) {
    const deficit = Math.round(paceExpected - weekEarnings);
    triggers.push({
      kind: "weekly_pace",
      data: {
        week_earnings: Math.round(weekEarnings),
        expected_by_now: Math.round(paceExpected),
        deficit,
        days_left: daysLeftInWeek,
        avg_weekly: Math.round(avgWeekly),
        pace_pct: Math.round(paceRatio * 100),
      },
    });
  } else if (paceRatio >= 1.25 && daysIntoWeek >= 2) {
    const surplus = Math.round(weekEarnings - paceExpected);
    triggers.push({
      kind: "weekly_pace",
      data: {
        week_earnings: Math.round(weekEarnings),
        expected_by_now: Math.round(paceExpected),
        surplus,
        days_left: daysLeftInWeek,
        avg_weekly: Math.round(avgWeekly),
        pace_pct: Math.round(paceRatio * 100),
        is_ahead: true,
      },
    });
  }

  // ── Trigger 3: Today is a high/low demand day based on user's own history ─
  const todayAvg = byDow[dow];
  const overallDailyAvg = Math.round(avgWeekly / 7);
  const dayDiffPct = overallDailyAvg > 0 ? Math.round(((todayAvg - overallDailyAvg) / overallDailyAvg) * 100) : 0;

  if (Math.abs(dayDiffPct) >= 15) {
    triggers.push({
      kind: "day_opportunity",
      data: {
        day_name: DAY_LABELS[dow],
        today_avg: todayAvg,
        daily_avg: overallDailyAvg,
        diff_pct: dayDiffPct,
        is_high: dayDiffPct > 0,
      },
    });
  }

  // ── Trigger 4: Streak risk — no income logged today and past 2 days ───────
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const dayBefore = new Date(today); dayBefore.setDate(today.getDate() - 2);
  const earnedToday = earningsOnDate(todayStr, txns);
  const earnedYesterday = earningsOnDate(yesterday.toISOString().slice(0, 10), txns);
  const earnedDayBefore = earningsOnDate(dayBefore.toISOString().slice(0, 10), txns);

  if (earnedToday === 0 && earnedYesterday === 0 && earnedDayBefore === 0 && dow > 0) {
    triggers.push({
      kind: "streak_risk",
      data: {
        zero_days: 3,
        avg_daily: overallDailyAvg,
        missed_estimate: overallDailyAvg * 3,
        day_name: DAY_LABELS[dow],
      },
    });
  }

  // ── Trigger 5: Post-event gap — high demand event just passed, check user ─
  for (const ev of cityEvents) {
    const evDate = new Date(ev.date);
    const daysSince = Math.round((today.getTime() - evDate.getTime()) / 86_400_000);
    if (daysSince < 1 || daysSince > 3) continue;
    const earned = earningsOnDate(ev.date, txns);
    const marketPotential = Math.round((avgWeekly / 7) * ev.demand_multiplier * 1.4);
    if (earned < marketPotential * 0.5) {
      triggers.push({
        kind: "post_event_gap",
        data: {
          event_name: ev.event_name,
          event_date: ev.date,
          days_since: daysSince,
          earned: earned,
          market_potential: marketPotential,
          missed: marketPotential - earned,
        },
      });
      break;
    }
  }

  return triggers;
}
