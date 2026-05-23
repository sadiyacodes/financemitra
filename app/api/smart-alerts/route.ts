import { NextResponse } from 'next/server';
import { getUserTransactions, getUserProfile } from '../../../lib/memory/profile-store';
import { detectTriggers, SmartTrigger } from '../../../lib/engine/smart-alert-engine';

export interface SmartAlert {
  id: string;
  kind: "opportunity" | "warning" | "positive" | "info";
  icon: string;
  title: string;
  message: string;
  chat_query: string;
  triggered_at: string;
}

// ── Build mock alerts deterministically when LLM isn't available ──────────────

function buildMockAlerts(triggers: SmartTrigger[], name: string): SmartAlert[] {
  const now = new Date().toISOString();
  return triggers.map((t, i): SmartAlert => {
    const id = `sa_${Date.now()}_${i}`;

    if (t.kind === "upcoming_event") {
      const d = t.data;
      return {
        id, kind: "opportunity", icon: "🏏", triggered_at: now,
        title: `${d.event_name} in ${d.days_away} day${(d.days_away as number) > 1 ? "s" : ""}`,
        message: `High-demand event incoming — market surge of ${d.demand_multiplier}× expected. ${d.avg_past_event_earning ? `Your past event earnings average ₹${(d.avg_past_event_earning as number).toLocaleString()} — you can do better with earlier positioning.` : `Start earlier than usual and target high-density areas.`}`,
        chat_query: `There's a big event coming up in ${d.days_away} days. How should I prepare as a Grab driver to maximise my earnings?`,
      };
    }

    if (t.kind === "weekly_pace") {
      const d = t.data;
      if (d.is_ahead) {
        return {
          id, kind: "positive", icon: "📈", triggered_at: now,
          title: "Strong week — ${Math.round(d.pace_pct as number)}% above pace",
          message: `You're ₹${(d.surplus as number).toLocaleString()} ahead of your weekly average pace. ${(d.days_left as number) > 0 ? `With ${d.days_left} days left, consider stashing the extra into savings.` : "Great finish to the week."}`,
          chat_query: `I'm having a great week — ${(d.surplus as number).toLocaleString()} above target. How should I use this surplus?`,
        };
      }
      return {
        id, kind: "warning", icon: "⚠️", triggered_at: now,
        title: `${100 - (d.pace_pct as number)}% behind your weekly pace`,
        message: `You've earned ₹${(d.week_earnings as number).toLocaleString()} so far this week — ₹${(d.deficit as number).toLocaleString()} short of your average pace. ${(d.days_left as number) > 0 ? `${d.days_left} days remain to recover.` : ""}`,
        chat_query: `I'm behind my weekly earnings pace by ₹${(d.deficit as number).toLocaleString()}. What can I do to recover in the remaining days?`,
      };
    }

    if (t.kind === "day_opportunity") {
      const d = t.data;
      if (d.is_high) {
        return {
          id, kind: "opportunity", icon: "⚡", triggered_at: now,
          title: `${d.day_name}s are your best days`,
          message: `Your average ${d.day_name} earnings are ₹${(d.today_avg as number).toLocaleString()} — ${d.diff_pct}% above your daily average. Don't leave this opportunity on the table.`,
          chat_query: `Today is ${d.day_name} and historically my best earning day. How can I maximise my earnings today?`,
        };
      }
      return {
        id, kind: "info", icon: "💡", triggered_at: now,
        title: `${d.day_name}s are historically slow`,
        message: `${d.day_name}s tend to earn ${Math.abs(d.diff_pct as number)}% less than your daily average. Consider using downtime to plan your week or service your vehicle.`,
        chat_query: `It's a slow day historically. How should I spend this downtime productively as a gig worker?`,
      };
    }

    if (t.kind === "streak_risk") {
      const d = t.data;
      return {
        id, kind: "warning", icon: "🔴", triggered_at: now,
        title: "3 days with no income logged",
        message: `No earnings recorded for 3 consecutive days — that's roughly ₹${(d.missed_estimate as number).toLocaleString()} in missed income at your average rate.`,
        chat_query: "I haven't earned for 3 days. How do I get back on track quickly?",
      };
    }

    // post_event_gap
    const d = t.data;
    return {
      id, kind: "info", icon: "📊", triggered_at: now,
      title: `You missed the ${d.event_name} surge`,
      message: `During ${d.event_name} ${d.days_since} day${(d.days_since as number) > 1 ? "s" : ""} ago, the market potential was ₹${(d.market_potential as number).toLocaleString()} but you earned ₹${(d.earned as number).toLocaleString()}. Next similar event: plan ahead.`,
      chat_query: `I missed a high-demand event window. How do I prepare better for the next one?`,
    };
  });
}

// ── LLM alert generation ──────────────────────────────────────────────────────

async function generateWithLLM(
  triggers: SmartTrigger[],
  profile: ReturnType<typeof getUserProfile>,
  apiKey: string
): Promise<SmartAlert[]> {
  const now = new Date().toISOString();
  const triggersText = triggers.map((t, i) => `Trigger ${i + 1} [${t.kind}]: ${JSON.stringify(t.data)}`).join("\n");

  const prompt = `You are the FinanceMitra Smart Alert Agent. Write personalized, conversational alert messages for ${profile!.name}, a ${profile!.type.replace(/_/g, " ")} in ${profile!.city}.

Detected triggers:
${triggersText}

For each trigger, return a JSON object with:
- "kind": one of "opportunity" | "warning" | "positive" | "info"
- "icon": one relevant emoji
- "title": 4-7 words, punchy and specific (include numbers where possible)
- "message": 1-2 sentences, direct and actionable. Use ₹ figures. Address ${profile!.name.split(" ")[0]} directly. No generic advice — be specific to their data.
- "chat_query": a natural question the user would ask the chatbot about this situation

Return a JSON array only — no prose, no markdown, no explanation. Array length must equal number of triggers (${triggers.length}).`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error ${res.status}`);
  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "[]";
  const match = text.match(/\[[\s\S]*\]/);
  const parsed: Omit<SmartAlert, "id" | "triggered_at">[] = match ? JSON.parse(match[0]) : [];

  return parsed.map((a, i) => ({
    ...a,
    id: `sa_${Date.now()}_${i}`,
    triggered_at: now,
  }));
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const profile = getUserProfile(userId);
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const txns = getUserTransactions(userId);
  const triggers = detectTriggers(txns, profile);

  if (triggers.length === 0) return NextResponse.json({ alerts: [] });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const useMock = !apiKey || apiKey === "your_api_key_here";

  try {
    const alerts = useMock
      ? buildMockAlerts(triggers, profile.name)
      : await generateWithLLM(triggers, profile, apiKey!);
    return NextResponse.json({ alerts });
  } catch (err: any) {
    console.error("Smart alerts LLM error, falling back to mock:", err.message);
    return NextResponse.json({ alerts: buildMockAlerts(triggers, profile.name) });
  }
}
