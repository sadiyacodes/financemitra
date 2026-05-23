import { WhatIfInput } from "../types";

export function parseWhatIfMessage(message: string): WhatIfInput | null {
  const msg = message.toLowerCase();

  const saveMoreMatch = msg.match(/save \u20B9?(\d+) more per (week|month)/);
  if (saveMoreMatch) {
    return {
      type: "extra_saving",
      amount: parseInt(saveMoreMatch[1], 10),
      unit: saveMoreMatch[2] as "week" | "month",
      description: `save ₹${saveMoreMatch[1]} more per ${saveMoreMatch[2]}`
    };
  }

  const cutMatch = msg.match(/cut (\w+) by \u20B9?(\d+)/);
  if (cutMatch) {
    return {
      type: "expense_reduction",
      amount: parseInt(cutMatch[2], 10),
      unit: "month",
      description: `cut ${cutMatch[1]} by ₹${cutMatch[2]}`
    };
  }

  const earnMoreMatch = msg.match(/earn \u20B9?(\d+) more/);
  if (earnMoreMatch) {
    return {
      type: "income_change",
      amount: parseInt(earnMoreMatch[1], 10),
      unit: "month",
      description: `earn ₹${earnMoreMatch[1]} more`
    };
  }

  const raiseGoalMatch = msg.match(/raise my goal to \u20B9?(\d+)/);
  if (raiseGoalMatch) {
    return {
      type: "goal_change",
      amount: parseInt(raiseGoalMatch[1], 10),
      unit: "month",
      description: `raise goal to ₹${raiseGoalMatch[1]}`
    };
  }
  
  return null;
}
