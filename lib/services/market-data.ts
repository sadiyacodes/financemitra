import { Transaction } from '../types';

const BENGALURU_EVENTS = [
  { date: "2026-03-22", event_name: "RCB Match – IPL 2026", expected_demand_multiplier: 1.9 },
  { date: "2026-03-28", event_name: "IPL Match – RCB vs MI", expected_demand_multiplier: 1.8 },
  { date: "2026-04-04", event_name: "IPL Match – RCB vs CSK", expected_demand_multiplier: 1.7 },
  { date: "2026-04-12", event_name: "Startup Summit Bengaluru", expected_demand_multiplier: 1.5 },
  { date: "2026-05-01", event_name: "May Day Holiday", expected_demand_multiplier: 1.5 },
  { date: "2026-05-10", event_name: "City Music Fest", expected_demand_multiplier: 1.6 },
];

const HYDERABAD_EVENTS = [
  { date: "2026-03-15", event_name: "SRH vs RCB – IPL Home Match", expected_demand_multiplier: 1.8 },
  { date: "2026-03-25", event_name: "SRH vs KKR – IPL Home Match", expected_demand_multiplier: 1.7 },
  { date: "2026-04-06", event_name: "SRH vs DC – IPL Home Match", expected_demand_multiplier: 1.7 },
  { date: "2026-04-18", event_name: "HITEC City Startup Summit", expected_demand_multiplier: 1.4 },
  { date: "2026-05-01", event_name: "May Day Holiday", expected_demand_multiplier: 1.4 },
  { date: "2026-05-11", event_name: "Hyderabad Music Festival", expected_demand_multiplier: 1.5 },
];

function getCityEvents(city: string) {
  if (city.toLowerCase().includes("hyderabad")) return HYDERABAD_EVENTS;
  return BENGALURU_EVENTS;
}

function getDemandIndex(dayIndex: number, dayOfWeek: number, date: string, cityEvents: typeof BENGALURU_EVENTS): number {
  let base = 55;
  if (dayOfWeek === 0 || dayOfWeek === 6) base += 18;
  if (cityEvents.some(e => e.date === date)) base += 25;
  if (dayIndex >= 58 && dayIndex <= 64) base -= 10;
  if (dayIndex >= 67 && dayIndex <= 73) base -= 14;
  return Math.min(95, Math.max(22, base));
}

export function get_user_earnings(
  { start_date, end_date }: { start_date: string; end_date: string },
  transactions: Transaction[]
): { date: string; earnings: number }[] {
  const earningsMap = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "income") continue;
    const key = t.date.slice(0, 10);
    earningsMap.set(key, (earningsMap.get(key) ?? 0) + t.amount);
  }

  const result: { date: string; earnings: number }[] = [];
  const start = new Date(start_date);
  const end = new Date(end_date);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, earnings: earningsMap.get(key) ?? 0 });
  }
  return result;
}

export function get_market_signals(
  { city, start_date, end_date }: { city: string; platforms: string[]; start_date: string; end_date: string },
  baseRate = 640
): { date: string; surge_active: boolean; demand_index: number; event_flag: boolean; market_potential: number }[] {
  const cityEvents = getCityEvents(city);
  const result = [];
  const start = new Date(start_date);
  const end = new Date(end_date);
  let i = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getDay();
    const demand_index = getDemandIndex(i, dayOfWeek, key, cityEvents);
    const surge_active = demand_index > 70;
    const event_flag = cityEvents.some(e => e.date === key);
    const market_potential = Math.round(
      baseRate * (demand_index / 100) * (surge_active ? 1.4 : 1) * (event_flag ? 1.6 : 1)
    );
    result.push({ date: key, surge_active, demand_index, event_flag, weather_flag: false, market_potential });
    i++;
  }
  return result;
}

export function get_local_events(
  { city, start_date, end_date }: { city: string; start_date: string; end_date: string }
): { date: string; event_name: string; expected_demand_multiplier: number }[] {
  return getCityEvents(city).filter(e => e.date >= start_date && e.date <= end_date);
}

export function flag_insight(params: {
  type: string;
  dates: string[];
  magnitude: string;
  plain_text: string;
}): { acknowledged: boolean } {
  return { acknowledged: true };
}
