import { Transaction, UserProfile } from "../types";

export type PatternAgentChartPoint = {
  date: string;
  actual: number;
  market_potential: number;
};

export type PatternAgentFlag = {
  type: "missed_surge" | "outperformed_market" | "low_demand_period" | "consistent_performer" | "demand_mismatch";
  dates: string[];
  magnitude: "low" | "medium" | "high";
  plain_text: string;
};

export type PatternAgentResult = {
  summary: string;
  performance_label: "beating_market" | "tracking_market" | "below_market";
  missed_earnings_estimate: number;
  chart_data: PatternAgentChartPoint[];
  flags: PatternAgentFlag[];
};

async function readSSEStream(
  response: Response,
  onStep: (text: string) => void
): Promise<PatternAgentResult> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: PatternAgentResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 2);

      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === "step") {
            onStep(event.text);
          } else if (event.type === "result") {
            result = event.data as PatternAgentResult;
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        } catch {
          // skip malformed lines
        }
      }
    }
  }

  if (!result) throw new Error("Pattern Agent produced no result");
  return result;
}

export async function runPatternAgent(options: {
  profile: UserProfile;
  transactions: Transaction[];
  platforms: string[];
  city?: string;
  onStep?: (text: string) => void;
}): Promise<PatternAgentResult> {
  const { profile, platforms, city, onStep = () => {} } = options;

  const response = await fetch("/api/pattern-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: profile.id,
      city: city ?? profile.city,
      platforms: platforms ?? ["swiggy", "ola"],
    }),
  });

  if (!response.ok) {
    throw new Error(`Pattern Agent API error: ${response.status}`);
  }

  return readSSEStream(response, onStep);
}
