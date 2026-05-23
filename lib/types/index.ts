export interface Transaction {
  id: string;
  user_id: string;
  date: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  source?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  type: string;
  city: string;
  currency: string;
  monthly_fixed_expenses: number;
  savings_goal: {
    label: string;
    target: number;
    current: number;
  };
  income_pattern: string;
}

export interface IncomeStats {
  averageMonthly: number;
  averageWeekly: number;
  highestMonth: { month: string; amount: number };
  lowestMonth: { month: string; amount: number };
  volatilityScore: number;
  bestDayOfWeek: string;
  worstDayOfWeek: string;
  incomeByWeek: { week: string; total: number }[];
  incomeByMonth: { month: string; total: number }[];
  totalLast30Days: number;
  totalLast90Days: number;
  healthScore?: HealthScore;
}

export interface ExpenseStats {
  totalLast30Days: number;
  totalLast90Days: number;
  byCategory: { category: string; total: number; percentage: number }[];
  fixedExpenses: number;
  variableExpenses: number;
  trend: "increasing" | "stable" | "decreasing";
  largestCategory: string;
  unusualSpikes: { date: string; category: string; amount: number; reason: string }[];
}

export interface SavingsPlan {
  recommendedMonthlySaving: number;
  recommendedWeeklySaving: number;
  monthsToGoal: number;
  weeksToGoal: number;
  adjustedPlanForSlowMonths: number;
  adjustedPlanForGoodMonths: number;
  currentSurplus: number;
  savingsRate: number;
  isGoalRealistic: boolean;
  realisticTargetDate: string;
  warnings: string[];
}

export interface IncomeForecast {
  nextWeekEstimate: { low: number; mid: number; high: number };
  nextMonthEstimate: { low: number; mid: number; high: number };
  forecastBasis: string;
  confidenceLevel: "low" | "medium" | "high";
  seasonalWarning?: string;
}

export interface Alert {
  id: string;
  severity: "info" | "warning" | "urgent";
  type: string;
  title: string;
  message: string;
  actionSuggestion: string;
  triggeredAt: string;
}

export interface AgentContext {
  userId: string;
  userProfile: UserProfile;
  transactions: Transaction[];
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  sessionId: string;
}

export interface ToolResult {
  toolName: string;
  success: boolean;
  data: unknown;
  summary: string;
  error?: string;
}

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, string>;
  execute: (input: Record<string, unknown>, context: AgentContext) => Promise<ToolResult>;
}

export interface ReasoningStep {
  stepNumber: number;
  thought: string;
  toolCalled?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  timestamp: string;
}

export interface AgentResponse {
  message: string;
  reasoningLog: ReasoningStep[];
  alerts: Alert[];
  showBankingCard?: boolean;
  data?: {
    incomeStats?: IncomeStats;
    expenseStats?: ExpenseStats;
    savingsPlan?: SavingsPlan;
    forecast?: IncomeForecast;
    healthScore?: HealthScore;
    whatIfResult?: WhatIfResult;
    weeklyDigest?: WeeklyDigest;
    scenarioResult?: ScenarioResult;
    fuelData?: FuelApiResponse;
    fxData?: FXApiResponse;
  };
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
}

export interface HealthScore {
  score: number;
  label: "Healthy" | "Moderate" | "Stretched" | "Critical";
  color: "green" | "amber" | "orange" | "red";
  savingsRateScore: number;
  expenseRatioScore: number;
  savingsRate: number;
  expenseRatio: number;
}

export interface WhatIfInput {
  type: "extra_saving" | "expense_reduction" | "income_change" | "goal_change";
  amount: number;
  unit: "week" | "month";
  description: string;
}

export interface WhatIfResult {
  baseline: {
    monthlySurplus: number;
    savingsRate: number;
    monthsToGoal: number;
    healthScore: number;
  };
  simulated: {
    monthlySurplus: number;
    savingsRate: number;
    monthsToGoal: number;
    healthScore: number;
  };
  delta: {
    surplusChange: number;
    savingsRateChange: number;
    monthsToGoalChange: number;
    healthScoreChange: number;
  };
  isRealistic: boolean;
  unrealisticReason?: string;
}

export interface WeeklyDigest {
  incomeThisWeek: number;
  incomeVsAverage: number;
  spentThisWeek: number;
  surplusThisWeek: number;
  bestEarningDay: string;
  biggestSpendCategory: string;
  biggestSpendAmount: number;
  notableObservation: string;
  weekLabel: string;
}

export interface ScenarioInput {
  itemName: string;
  itemCost: number;
  emiAmount?: number;
  emiMonths?: number;
  interestRate?: number;
}

export interface ScenarioResult {
  optionA: {
    label: string;
    totalCost: number;
    monthlyImpact: number;
    goalDelayMonths: number;
    slowMonthRisk: "High" | "Medium" | "Low";
    interestPaid: number;
    assumedInterestRate: number;
  };
  optionB: {
    label: string;
    totalCost: number;
    monthlyImpact: number;
    monthsUntilAffordable: number;
    goalDelayMonths: number;
    slowMonthRisk: "High" | "Medium" | "Low";
  };
  verdict: string;
  tooRiskyForBoth: boolean;
}

// ─── FUEL TYPES ──────────────────────────────────────────────────────────────

export interface FuelPrice {
  city: string;
  petrol: number;
  diesel: number;
  lastUpdated: string;
  nextRevisionDate: string;
  source: string;
}

export interface FuelPriceChange {
  hasPriceChanged: boolean;
  previousPetrol: number;
  currentPetrol: number;
  petrolDelta: number;             // positive = increase, negative = decrease
  dieselDelta: number;
  petrolDeltaPercent: number;
  changeDate: string;
  previousDate: string;
  trend: "rising" | "falling" | "stable";   // across full history
}

export interface DriverFuelImpact {
  currentMonthlyCost: number;
  previousMonthlyCost: number;
  monthlyDelta: number;            // positive = costs more now
  dailyCost: number;
  litresPerMonth: number;
  avgKmPerDay: number;
  avgKmPerLitre: number;
  workingDaysPerMonth: number;
  isCostIncreased: boolean;
  budgetRecommendation: string;    // deterministic one-sentence string
  updatedMonthlyExpense: number;   // previous fixed_expenses + new fuel cost
}

export interface FuelApiResponse {
  price: FuelPrice;
  priceChange: FuelPriceChange;
  driverImpact: DriverFuelImpact;
}

// ─── EXCHANGE RATE TYPES ─────────────────────────────────────────────────────

export interface ExchangeRate {
  currencyCode: string;
  currencyName: string;
  symbol: string;
  currentRate: number;             // INR per 1 unit of foreign currency
  lastUpdated: string;
  source: string;
}

export interface ExchangeRateChange {
  hasMoved: boolean;
  previousRate: number;
  currentRate: number;
  delta: number;                   // positive = INR weakened = freelancer gets more INR
  deltaPercent: number;
  direction: "favorable" | "unfavorable" | "unchanged";
  previousDate: string;
  currentDate: string;
}

export interface FXTimingSignal {
  signal: "good_time" | "neutral" | "wait";
  label: string;                   // "Favorable week to receive payments"
  reasoning: string;               // one sentence explanation
  comparedTo: "4_week_average";
  currentRate: number;
  fourWeekAverage: number;
  deltaFromAverage: number;
}

export interface PendingInvoiceResult {
  foreignAmount: number;
  currencyCode: string;
  inrValueToday: number;
  inrValueLastWeek: number;
  inrValueFourWeekAvg: number;
  deltaVsLastWeek: number;         // positive = better than last week
  deltaVsAverage: number;          // positive = better than 4-week average
  recommendation: string;          // deterministic one-sentence string
}

export interface FXApiResponse {
  rate: ExchangeRate;
  rateChange: ExchangeRateChange;
  timingSignal: FXTimingSignal;
}
