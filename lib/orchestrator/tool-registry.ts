import { AgentTool, AgentContext, ToolResult, IncomeStats, ExpenseStats, SavingsPlan, IncomeForecast } from "../types";
import { analyzeIncome } from "../engine/income-analyzer";
import { trackExpenses } from "../engine/expense-tracker";
import { planSavings } from "../engine/savings-planner";
import { forecastIncome } from "../engine/income-forecaster";
import { generateAlerts } from "../engine/alert-engine";
import { simulateWhatIf } from "../engine/what-if-simulator";
import { compareScenarios } from "../engine/scenario-comparison";
import { fetchFuelPrice } from "../engine/external/mock-fuel-api";
import { fetchExchangeRate, detectPrimaryCurrency } from "../engine/external/mock-exchange-api";
import { retrieveRelevantTips } from "../memory/knowledge-base";

// ── Tax calculation helpers ───────────────────────────────────────────────────

function calcNewRegimeTax(taxableIncome: number): number {
  if (taxableIncome <= 300_000) return 0;
  if (taxableIncome <= 700_000) return Math.round((taxableIncome - 300_000) * 0.05);
  if (taxableIncome <= 1_000_000) return 20_000 + Math.round((taxableIncome - 700_000) * 0.10);
  if (taxableIncome <= 1_200_000) return 50_000 + Math.round((taxableIncome - 1_000_000) * 0.15);
  if (taxableIncome <= 1_500_000) return 80_000 + Math.round((taxableIncome - 1_200_000) * 0.20);
  return 140_000 + Math.round((taxableIncome - 1_500_000) * 0.30);
}

export const toolsRegistry: AgentTool[] = [
  {
    name: "income_analyzer",
    description: `Call this FIRST before ANY financial recommendation.
Analyzes the user's income history from their transaction data.
Returns: averageMonthly (₹), lowestMonth { amount, month }, volatilityScore (0–100, higher = more irregular), healthScore (0–100), bestDayOfWeek, totalIncome.
Required input: none.`,
    inputSchema: { period: "30d | 60d | 90d — how far back to analyze (default: 90d)" },
    execute: async (input, context): Promise<ToolResult> => {
      try {
        const stats = analyzeIncome(context.transactions, context.userProfile);
        return {
          toolName: "income_analyzer",
          success: true,
          data: stats,
          summary: `Avg monthly ₹${stats.averageMonthly} | Volatility: ${stats.volatilityScore} | Worst month: ₹${stats.lowestMonth.amount} | Best Day: ${stats.bestDayOfWeek}`
        };
      } catch (err: any) {
        return { toolName: "income_analyzer", success: false, data: null, summary: "Failed to analyze income", error: err.message };
      }
    }
  },
  {
    name: "expense_tracker",
    description: `Analyzes the user's spending habits. Call when you need expense data or when making any budget recommendation.
Returns: fixedExpenses (₹/mo), variableExpenses (₹/mo), totalExpenses (₹/mo), categoryBreakdown (object by category), trend ('up' | 'down' | 'stable'), topCategory.
Required input: none.`,
    inputSchema: { period: "30d | 60d | 90d — how far back to analyze (default: 90d)" },
    execute: async (input, context): Promise<ToolResult> => {
      try {
        const stats = trackExpenses(context.transactions, context.userId);
        return {
          toolName: "expense_tracker",
          success: true,
          data: stats,
          summary: `Fixed expenses ₹${stats.fixedExpenses}/mo | Variable ₹${stats.variableExpenses}/mo | Trend: ${stats.trend}`
        };
      } catch (err: any) {
        return { toolName: "expense_tracker", success: false, data: null, summary: "Failed to track expenses", error: err.message };
      }
    }
  },
  {
    name: "savings_planner",
    description: `Computes a savings plan against the user's active goal. Call after income_analyzer + expense_tracker to advise on budgeting or goal feasibility.
Returns: currentSurplus (₹), recommendedMonthlySaving (₹), monthsToGoal (number), isGoalRealistic (boolean), savingsRate (%).
Required input: none.`,
    inputSchema: {},
    execute: async (input, context): Promise<ToolResult> => {
      try {
        const income = analyzeIncome(context.transactions, context.userProfile);
        const expenses = trackExpenses(context.transactions, context.userId);
        const plan = planSavings(income, expenses, context.userProfile.savings_goal);
        return {
          toolName: "savings_planner",
          success: true,
          data: plan,
          summary: `Surplus: ₹${plan.currentSurplus} | Recommended: ₹${plan.recommendedMonthlySaving}/mo | Realistic: ${plan.isGoalRealistic ? 'Yes' : 'No'}`
        };
      } catch (err: any) {
        return { toolName: "savings_planner", success: false, data: null, summary: "Failed to plan savings", error: err.message };
      }
    }
  },
  {
    name: "income_forecaster",
    description: `Forecasts next month's income using historical trends. Call when user asks about future earnings or whether a slow month is coming.
Returns: nextMonthEstimate { low, mid, high } (₹), confidenceLevel ('high' | 'medium' | 'low'), trend ('rising' | 'falling' | 'stable').
Required input: none.`,
    inputSchema: {},
    execute: async (input, context): Promise<ToolResult> => {
      try {
        const forecast = forecastIncome(context.transactions, context.userId);
        return {
          toolName: "income_forecaster",
          success: true,
          data: forecast,
          summary: `Next month est: ₹${forecast.nextMonthEstimate.mid} (low: ₹${forecast.nextMonthEstimate.low}) | Confidence: ${forecast.confidenceLevel}`
        };
      } catch (err: any) {
        return { toolName: "income_forecaster", success: false, data: null, summary: "Failed to forecast income", error: err.message };
      }
    }
  },
  {
    name: "alert_engine",
    description: `Generates proactive risk alerts based on current financial state. Call to check for urgent warnings the user should know about.
Returns: array of Alert objects, each with { type, message, severity ('urgent' | 'warning' | 'info') }.
Required input: none.`,
    inputSchema: {},
    execute: async (input, context): Promise<ToolResult> => {
      try {
        const income = analyzeIncome(context.transactions, context.userProfile);
        const expenses = trackExpenses(context.transactions, context.userId);
        const plan = planSavings(income, expenses, context.userProfile.savings_goal);
        const forecast = forecastIncome(context.transactions, context.userId);
        const alerts = generateAlerts(income, expenses, plan, forecast, context.userProfile);
        
        return {
          toolName: "alert_engine",
          success: true,
          data: alerts,
          summary: `Generated ${alerts.length} alerts. ${alerts.filter(a => a.severity === 'urgent').length} urgent.`
        };
      } catch (err: any) {
        return { toolName: "alert_engine", success: false, data: null, summary: "Failed to generate alerts", error: err.message };
      }
    }
  },
  {
    name: "what_if_simulator",
    description: `Simulates the financial impact of a hypothetical change. Call whenever the user asks a what-if or hypothetical question ("what if I save ₹500 more", "if I cut food spending").
Returns: { isRealistic (boolean), current { savingsRate, monthlySurplus, monthsToGoal, healthScore }, simulated { same fields }, monthsToGoalChange (negative = faster) }.
Required input: type, amount, unit, description.`,
    inputSchema: {
      type: "extra_saving | expense_reduction | income_change | goal_change",
      amount: "numeric amount of the change",
      unit: "week | month",
      description: "plain English description of what's changing"
    },
    execute: async (input, context): Promise<ToolResult> => {
      try {
        const income = analyzeIncome(context.transactions, context.userProfile);
        const expenses = trackExpenses(context.transactions, context.userId);
        const plan = planSavings(income, expenses, context.userProfile.savings_goal);
        const result = simulateWhatIf(input as any, income, expenses, plan, context.userProfile);
        return {
           toolName: "what_if_simulator",
           success: true,
           data: result,
           summary: `Simulated ${input.description}. Realistic: ${result.isRealistic}. New surplus: ₹${result.simulated.monthlySurplus}`
        };
      } catch(err: any) {
        return { toolName: "what_if_simulator", success: false, data: null, summary: "Failed to simulate", error: err.message }; 
      }
    }
  },
  {
    name: "compare_scenarios",
    description: `Compares two financial paths side-by-side (EMI vs save-up). Call when user is deciding between two approaches, asks 'should I buy or save', or uses words like 'compare', 'vs', 'which is better', 'EMI or upfront'.
Returns: { optionA { label, totalCost, monthlyImpact, timeMonths }, optionB { same }, verdict (string), tooRiskyForBoth (boolean) }.
Required input: itemName, itemCost. Optional: emiAmount, emiMonths, interestRate.`,
    inputSchema: {
      itemName: "name of the item or decision",
      itemCost: "full purchase price in INR",
      emiAmount: "monthly EMI amount if known — optional",
      emiMonths: "loan duration in months if known — optional",
      interestRate: "annual interest rate as decimal — optional, defaults to 0.18"
    },
    execute: async (input, context): Promise<ToolResult> => {
      try {
        if (!input.itemCost) {
          return { toolName: "compare_scenarios", success: false, data: { needsClarification: true }, summary: "Ask the user: What's the full price of the item?" };
        }
        const income = analyzeIncome(context.transactions, context.userProfile);
        const expenses = trackExpenses(context.transactions, context.userId);
        const plan = planSavings(income, expenses, context.userProfile.savings_goal);
        const result = compareScenarios(input as any, income, expenses, plan);
        return {
           toolName: "compare_scenarios",
           success: true,
           data: result,
           summary: `Scenario comparison: Option A (EMI) costs ₹${result.optionA.totalCost}. Option B (Save up) costs ₹${result.optionB.totalCost}. Verdict: ${result.verdict}`
        };
      } catch(err: any) { 
        return { toolName: "compare_scenarios", success: false, data: null, summary: "Failed to compare scenarios", error: err.message }; 
      }
    }
  },
  {
    name: "fetch_fuel_price",
    description: `Fetches current petrol price for the user's city and computes monthly budget impact. Call ONLY for ride_share_driver users — never for any other user type.
Call when: user asks about fuel/petrol costs, driving expenses, or when building a budget update for a driver.
Returns: { price { petrol (₹/litre), city, lastUpdated }, driverImpact { currentMonthlyCost (₹), monthlyDelta (₹), isCostIncreased (bool), budgetRecommendation (string) } }.
Required input: city.`,
    inputSchema: {
      city: "the user's city — pull from userProfile.city"
    },
    execute: async (input, context) => {
      if (context.userProfile.type !== "ride_share_driver") {
        return {
          toolName: "fetch_fuel_price",
          success: false,
          data: null,
          summary: "Fuel price tool is only available for driver profiles.",
          error: "Wrong user type"
        };
      }
      const result = fetchFuelPrice(input.city as string ?? context.userProfile.city);
      result.driverImpact.updatedMonthlyExpense =
        context.userProfile.monthly_fixed_expenses + result.driverImpact.currentMonthlyCost;

      return {
        toolName: "fetch_fuel_price",
        success: true,
        data: result,
        summary: `Petrol in ${result.price.city}: ₹${result.price.petrol}/litre. 
                Monthly fuel cost: ₹${result.driverImpact.currentMonthlyCost} 
                (${result.driverImpact.isCostIncreased ? "+" : ""}₹${result.driverImpact.monthlyDelta} vs last revision).`
      };
    }
  },
  {
    name: "fetch_exchange_rate",
    description: `Fetches current exchange rate for a foreign currency against INR. Call when user asks about FX rates, how much an invoice is worth in INR, or whether it's a good time to receive payment.
Returns: { rate { currencyCode, currentRate (₹), fourWeekAvg (₹), delta (₹) }, timingSignal { signal ('good_time' | 'wait' | 'neutral'), label, reasoning (string to use verbatim) } }.
Required input: currencyCode (e.g. USD, EUR, GBP).`,
    inputSchema: {
      currencyCode: "3-letter currency code, e.g. USD, EUR, GBP"
    },
    execute: async (input, context) => {
      const currency =
        (input.currencyCode as string) ??
        detectPrimaryCurrency(context.transactions);

      // Sanitize in case LLM passes 'USD, EUR' or 'USD and EUR'
      const sanitizedCurrency = currency.includes(' ') || currency.includes(',')
        ? currency.split(/[\s,]+/)[0]
        : currency;

      const result = fetchExchangeRate(sanitizedCurrency);

      return {
        toolName: "fetch_exchange_rate",
        success: true,
        data: result,
        summary: `1 ${result.rate.currencyCode} = ₹${result.rate.currentRate}.
                Rate is ${result.timingSignal.signal === "good_time" ? "above" : result.timingSignal.signal === "wait" ? "below" : "near"}
                4-week average. Signal: ${result.timingSignal.label}.
                Reasoning: ${result.timingSignal.reasoning}`
      };
    }
  },
  {
    name: "tax_advisor",
    description: `Computes the user's personal tax position using their actual transaction data and retrieves relevant Indian tax law from the knowledge base.
Call this for ANY tax-related question: advance tax, Section 44ADA, tax regime choice, TDS, ITR form, GST, or general tax obligations.
Returns: projected_annual_income, estimated_tds_deducted (1% platform TDS under Section 194O), qualifies_44ADA, taxable_income_under_44ADA, taxable_after_std_deduction, estimated_tax_liability, tax_after_tds, needs_advance_tax, recommended_regime, itr_form, kb_entries (retrieved tax law).
Required input: none.`,
    inputSchema: {},
    execute: async (_input, context): Promise<ToolResult> => {
      try {
        // ── Step 1: Compute income metrics from actual transactions ──────────
        const incomeTxns = context.transactions.filter(t => t.type === "income");
        const totalIncome91Days = incomeTxns.reduce((s, t) => s + t.amount, 0);
        const activeDays = new Set(incomeTxns.map(t => t.date.slice(0, 10))).size;

        // Project annual from the available data window
        const dataWindowDays = Math.max(91, activeDays > 0 ? 91 : 1);
        const projectedAnnual = Math.round((totalIncome91Days / dataWindowDays) * 365);

        // ── Step 2: Platform TDS estimate (Section 194O: 1% on gross payouts) ─
        const estimatedTDS = Math.round(totalIncome91Days * 0.01);

        // ── Step 3: Tax calculations under new regime + Section 44ADA ────────
        const qualifies44ADA = projectedAnnual <= 75_00_000; // ₹75 lakh limit
        const taxableUnder44ADA = qualifies44ADA ? Math.round(projectedAnnual * 0.5) : projectedAnnual;
        const STD_DEDUCTION = 75_000;
        const taxableAfterStd = Math.max(0, taxableUnder44ADA - STD_DEDUCTION);

        // New regime slabs + Section 87A rebate (income ≤ ₹7L → zero tax)
        const grossTax = taxableAfterStd <= 700_000 ? 0 : calcNewRegimeTax(taxableAfterStd);
        const finalTax = Math.round(grossTax * 1.04); // 4% health + education cess
        const taxAfterTDS = Math.max(0, finalTax - estimatedTDS);
        const needsAdvanceTax = finalTax > 10_000;

        // Old regime rough estimate (for comparison — skip deductions for simplicity)
        const oldRegimeTax = Math.round(calcNewRegimeTax(Math.max(0, projectedAnnual - 50_000)) * 1.04);
        const betterRegime = finalTax <= oldRegimeTax ? "new" : "old";

        // ── Step 4: Retrieve tax law from knowledge base (RAG) ───────────────
        const kbEntries = retrieveRelevantTips(
          "tax 44ADA presumptive advance tax ITR regime TDS gig worker 194O",
          6
        );

        const data = {
          projected_annual_income: projectedAnnual,
          total_income_91_days: Math.round(totalIncome91Days),
          estimated_tds_deducted: estimatedTDS,
          qualifies_44ADA: qualifies44ADA,
          taxable_income_under_44ADA: taxableUnder44ADA,
          taxable_after_std_deduction: taxableAfterStd,
          estimated_tax_new_regime: finalTax,
          estimated_tax_old_regime: oldRegimeTax,
          recommended_regime: betterRegime,
          tax_after_tds: taxAfterTDS,
          needs_advance_tax: needsAdvanceTax,
          itr_form: qualifies44ADA ? "ITR-4 (Sugam)" : "ITR-3",
          kb_entries: kbEntries,
        };

        return {
          toolName: "tax_advisor",
          success: true,
          data,
          summary: [
            `Projected annual income: ₹${projectedAnnual.toLocaleString()}`,
            `44ADA eligible: ${qualifies44ADA ? "Yes" : "No"}`,
            `Taxable income (after 44ADA + std deduction): ₹${taxableAfterStd.toLocaleString()}`,
            `Estimated tax (new regime): ₹${finalTax.toLocaleString()}`,
            `TDS already deducted by platform: ₹${estimatedTDS.toLocaleString()}`,
            `Net tax payable: ₹${taxAfterTDS.toLocaleString()}`,
            `Advance tax needed: ${needsAdvanceTax ? "Yes" : "No"}`,
            `Recommended ITR form: ${data.itr_form}`,
            `Retrieved ${kbEntries.length} tax law entries from knowledge base`,
          ].join(" | "),
        };
      } catch (err: any) {
        return { toolName: "tax_advisor", success: false, data: null, summary: "Failed to compute tax position", error: err.message };
      }
    }
  }
];
