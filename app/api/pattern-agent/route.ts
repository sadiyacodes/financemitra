import { NextRequest } from 'next/server';
import { getUserTransactions, getUserProfile } from '../../../lib/memory/profile-store';
import {
  get_user_earnings,
  get_market_signals,
  get_local_events,
  flag_insight,
} from '../../../lib/services/market-data';

const PATTERN_AGENT_SYSTEM_PROMPT = `You are the Pattern Agent for GigFloat, a financial app for gig workers in India.

Your job is to compare a gig worker's actual daily earnings against market-level demand signals and surface insights that help them understand their performance relative to the market. These insights should build financial literacy — not through lectures, but through specific, personal observations.

RULES:
1. Always call get_user_earnings first. Never skip this.
2. Always call get_market_signals after. Use the same date range.
3. Call get_local_events to explain any demand spikes you notice.
4. Call flag_insight for EACH significant observation (missed surges, outperformance days, low-demand periods). Be specific about dates.
5. After flagging all insights, produce a final JSON output (no markdown, no prose wrapper) in this exact shape:

{
  "summary": "<2-3 sentences max. Plain language. Tell the worker what the market did and how they did against it. No jargon.>",
  "performance_label": "beating_market" | "tracking_market" | "below_market",
  "missed_earnings_estimate": <number in INR, your best estimate of what was left on the table>,
  "chart_data": [
    {
      "date": "YYYY-MM-DD",
      "actual": <number from get_user_earnings>,
      "market_potential": <number from get_market_signals>
    }
  ],
  "flags": [
    {
      "type": "<insight type>",
      "dates": ["YYYY-MM-DD"],
      "magnitude": "low|medium|high",
      "plain_text": "<one sentence>"
    }
  ]
}

TONE: You are writing for someone who may not read well and checks their phone between rides. Be direct, specific, and encouraging when warranted. Say "You earned ₹400 on a day the market was offering ₹1,200" not "suboptimal utilization of demand capacity."

For chart_data: include ALL days from the date range. Use the exact "market_potential" value returned by get_market_signals for each date.

NEVER produce output before calling all relevant tools. NEVER hallucinate market data — only use what the tools return.`;

const patternAgentTools = [
  {
    name: "get_user_earnings",
    description: "Fetch the gig worker's daily earnings for a given date range from the local earnings store. Always call this first before fetching market data.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "ISO date string YYYY-MM-DD" },
        end_date: { type: "string", description: "ISO date string YYYY-MM-DD" },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "get_market_signals",
    description: "Fetch market-level demand signals for the city. Returns demand_index, surge_active, event_flag, and market_potential for each day. Use this after fetching user earnings.",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name e.g. Bengaluru" },
        platforms: { type: "array", items: { type: "string" }, description: "e.g. ['swiggy','ola','uber']" },
        start_date: { type: "string" },
        end_date: { type: "string" },
      },
      required: ["city", "platforms", "start_date", "end_date"],
    },
  },
  {
    name: "get_local_events",
    description: "Fetch local events that historically spike demand — IPL matches, concerts, festivals, holidays. Use this to explain demand spikes the user may have missed.",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string" },
        start_date: { type: "string" },
        end_date: { type: "string" },
      },
      required: ["city", "start_date", "end_date"],
    },
  },
  {
    name: "flag_insight",
    description: "Flag a specific insight you have identified. Call this for EACH significant finding before producing the final summary. Do not batch multiple insights into one call.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["missed_surge", "outperformed_market", "low_demand_period", "consistent_performer", "demand_mismatch"],
        },
        dates: { type: "array", items: { type: "string" }, description: "Specific dates this insight applies to" },
        magnitude: { type: "string", enum: ["low", "medium", "high"] },
        plain_text: { type: "string", description: "One sentence in simple language a gig worker understands. No finance jargon." },
      },
      required: ["type", "dates", "magnitude", "plain_text"],
    },
  },
];

function buildMockResult(
  earnings: { date: string; earnings: number }[],
  signals: { date: string; market_potential: number }[]
) {
  const signalMap = new Map(signals.map(s => [s.date, s.market_potential]));
  const chart_data = earnings.map(e => ({
    date: e.date,
    actual: e.earnings,
    market_potential: signalMap.get(e.date) ?? 0,
  }));

  const totalActual = chart_data.reduce((s, p) => s + p.actual, 0);
  const totalMarket = chart_data.reduce((s, p) => s + p.market_potential, 0);
  const ratio = totalActual / Math.max(totalMarket, 1);
  const performance_label =
    ratio >= 0.9 ? "tracking_market" : ratio >= 0.7 ? "beating_market" : "below_market";

  const missedDays = chart_data.filter(p => p.actual < p.market_potential * 0.6);
  const missedEst = missedDays.reduce((s, p) => s + Math.round((p.market_potential - p.actual) * 0.45), 0);

  return {
    summary:
      ratio >= 0.9
        ? `You matched the market closely over the last 91 days. A few strong weekend days helped keep your earnings stable.`
        : ratio >= 0.7
        ? `You were close to market potential most days, but missed a few high-demand windows — there is still room to capture more surge earnings.`
        : `The market offered stronger demand than your earnings on many days. A few missed surge days cost you a noticeable amount.`,
    performance_label,
    missed_earnings_estimate: Math.max(0, missedEst),
    chart_data,
    flags: missedDays.length
      ? [
          {
            type: "missed_surge",
            dates: missedDays.slice(-3).map(p => p.date),
            magnitude: "high",
            plain_text: `You earned much less than the market was offering on ${missedDays.length} days — most recently around ${missedDays.slice(-1)[0]?.date}.`,
          },
        ]
      : [],
  };
}

export async function POST(request: NextRequest) {
  const { userId, city, platforms } = await request.json();

  const profile = getUserProfile(userId);
  if (!profile) {
    return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
  }

  const transactions = getUserTransactions(userId);

  // Anchor date range to latest transaction date (same logic as Heatmap)
  const incomeDates = transactions
    .filter(t => t.type === "income")
    .map(t => t.date.slice(0, 10))
    .sort();
  const latestDate = incomeDates.length ? incomeDates[incomeDates.length - 1] : new Date().toISOString().slice(0, 10);
  const endDate = new Date(latestDate);
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 90);

  const dateRange = {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  };

  const resolvedCity = city || profile.city;
  const resolvedPlatforms = platforms || ['swiggy', 'ola'];

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const useRealAI = anthropicKey && anthropicKey !== 'your-anthropic-api-key-here';

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        if (!useRealAI) {
          // ── Mock fallback (no API key) ──────────────────────────────────────
          send({ type: 'step', text: '[Pattern Agent] Fetching your 91-day earnings history...' });
          await new Promise(r => setTimeout(r, 400));
          send({ type: 'step', text: `[Pattern Agent] Fetching market signals for ${resolvedCity}...` });
          await new Promise(r => setTimeout(r, 400));
          send({ type: 'step', text: '[Pattern Agent] Fetching local events (IPL, concerts, holidays)...' });
          await new Promise(r => setTimeout(r, 400));
          send({ type: 'step', text: '[Pattern Agent] Flagging missed surge days...' });
          await new Promise(r => setTimeout(r, 400));
          send({ type: 'step', text: '[Pattern Agent] Flagging outperformance days...' });
          await new Promise(r => setTimeout(r, 400));
          send({ type: 'step', text: '[Pattern Agent] Generating final analysis...' });
          await new Promise(r => setTimeout(r, 500));

          const earnings = get_user_earnings(
            { start_date: dateRange.start, end_date: dateRange.end },
            transactions
          );
          const signals = get_market_signals(
            { city: resolvedCity, platforms: resolvedPlatforms, start_date: dateRange.start, end_date: dateRange.end }
          );
          send({ type: 'result', data: buildMockResult(earnings, signals) });
          controller.close();
          return;
        }

        // ── Real Claude agentic loop ────────────────────────────────────────
        const toolHandlers: Record<string, (input: Record<string, unknown>) => unknown> = {
          get_user_earnings: (input) =>
            get_user_earnings(input as { start_date: string; end_date: string }, transactions),
          get_market_signals: (input) =>
            get_market_signals(input as { city: string; platforms: string[]; start_date: string; end_date: string }),
          get_local_events: (input) =>
            get_local_events(input as { city: string; start_date: string; end_date: string }),
          flag_insight: (input) =>
            flag_insight(input as { type: string; dates: string[]; magnitude: string; plain_text: string }),
        };

        const messages: { role: string; content: unknown }[] = [
          {
            role: 'user',
            content: `Analyze my earnings performance against the market for ${resolvedCity}. Platforms I work on: ${resolvedPlatforms.join(', ')}. Date range: ${dateRange.start} to ${dateRange.end}. Run your full analysis and produce the JSON output.`,
          },
        ];

        let finalResult = null;
        let iterations = 0;

        while (iterations < 12) {
          iterations++;

          const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': anthropicKey!,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
              max_tokens: 8192,
              system: PATTERN_AGENT_SYSTEM_PROMPT,
              tools: patternAgentTools,
              messages,
            }),
          });

          if (!claudeRes.ok) {
            const errText = await claudeRes.text();
            throw new Error(`Claude API error ${claudeRes.status}: ${errText}`);
          }

          const data = await claudeRes.json();
          messages.push({ role: 'assistant', content: data.content });

          if (data.stop_reason === 'end_turn') {
            const textBlock = data.content?.find((b: { type: string }) => b.type === 'text');
            if (textBlock) {
              const match = textBlock.text.match(/\{[\s\S]*\}/);
              if (match) {
                try { finalResult = JSON.parse(match[0]); } catch { /* keep null */ }
              }
            }
            break;
          }

          if (data.stop_reason === 'tool_use') {
            const toolResults: { type: string; tool_use_id: string; content: string }[] = [];
            for (const block of data.content) {
              if (block.type !== 'tool_use') continue;
              send({ type: 'step', text: `[Pattern Agent] Calling ${block.name}…` });
              const handler = toolHandlers[block.name];
              const result = handler ? handler(block.input) : { error: `Unknown tool: ${block.name}` };
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result),
              });
            }
            messages.push({ role: 'user', content: toolResults });
          }
        }

        // Server-side fallback: if agent didn't produce chart_data, compute it
        if (finalResult && (!finalResult.chart_data || finalResult.chart_data.length === 0)) {
          const earnings = get_user_earnings(
            { start_date: dateRange.start, end_date: dateRange.end },
            transactions
          );
          const signals = get_market_signals(
            { city: resolvedCity, platforms: resolvedPlatforms, start_date: dateRange.start, end_date: dateRange.end }
          );
          const signalMap = new Map(signals.map(s => [s.date, s.market_potential]));
          finalResult.chart_data = earnings.map(e => ({
            date: e.date,
            actual: e.earnings,
            market_potential: signalMap.get(e.date) ?? 0,
          }));
        }

        if (!finalResult) {
          // Complete fallback to mock
          const earnings = get_user_earnings(
            { start_date: dateRange.start, end_date: dateRange.end },
            transactions
          );
          const signals = get_market_signals(
            { city: resolvedCity, platforms: resolvedPlatforms, start_date: dateRange.start, end_date: dateRange.end }
          );
          finalResult = buildMockResult(earnings, signals);
        }

        send({ type: 'result', data: finalResult });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        send({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
