import { AgentContext, AgentResponse, ReasoningStep, Alert } from "../types";
import { ReasoningLogger } from "./reasoning-logger";
import { toolsRegistry } from "./tool-registry";
import { callLLM } from "../llm/llm-client";
import { AGENT_SYSTEM_PROMPT, EXPLAIN_SYSTEM_PROMPT, FUEL_AGENT_PROMPT, FX_AGENT_PROMPT, TAX_ADVISOR_PROMPT } from "../llm/prompts";
// Memory kb fallback
import { retrieveRelevantTips } from "../memory/knowledge-base";
// Alert engine check
import { generateAlerts } from "../engine/alert-engine";
import { analyzeIncome } from "../engine/income-analyzer";
import { trackExpenses } from "../engine/expense-tracker";
import { planSavings } from "../engine/savings-planner";
import { forecastIncome } from "../engine/income-forecaster";
import { generateWeeklyDigest } from "../engine/weekly-digest";
import { parseWhatIfMessage } from "./what-if-parser";
import { fetchFuelPrice } from "../engine/external/mock-fuel-api";
import { fetchExchangeRate, detectPrimaryCurrency } from "../engine/external/mock-exchange-api";

// ── Helper: build the explain prompt with user-type augmentations ────────────
function buildExplainPrompt(
  toolResultsMap: Map<string, any>,
  userProfile: AgentContext["userProfile"]
): string {
  let prompt = EXPLAIN_SYSTEM_PROMPT;
  const FREELANCE_TYPES = ["freelance_designer", "freelance_developer", "freelance_writer", "freelancer"];

  if (userProfile.type === "ride_share_driver" && toolResultsMap.has("fetch_fuel_price")) {
    prompt += "\n\n" + FUEL_AGENT_PROMPT;
  }
  if (FREELANCE_TYPES.includes(userProfile.type) && toolResultsMap.has("fetch_exchange_rate")) {
    prompt += "\n\n" + FX_AGENT_PROMPT;
  }
  if (toolResultsMap.has("tax_advisor")) {
    const taxData = toolResultsMap.get("tax_advisor");
    if (taxData?.kb_entries?.length > 0) {
      const taxKBStr = taxData.kb_entries
        .map((e: { title: string; content: string }, i: number) => `[Tax Law ${i + 1}] ${e.title}: ${e.content}`)
        .join("\n\n");
      prompt += `\n\nRetrieved Tax Law (from knowledge base — ground every claim here):\n${taxKBStr}`;
    }
    prompt += "\n\n" + TAX_ADVISOR_PROMPT;
  }
  return prompt;
}

// ── JSON parse helper (module-level to satisfy strict-mode block rules) ──────
function tryParseJSON(str: string): any | null {
  try {
    const match = str.match(/\{[\s\S]*\}/);
    let jsonStr = match ? match[0] : str;
    jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export async function runAgentLoop(
  userMessage: string,
  context: AgentContext,
  logger: ReasoningLogger,
  maxIterations: number = 5
): Promise<AgentResponse> {
  let iterations = 0;
  const toolResultsMap = new Map<string, any>();
  const toolOutputSummaries: string[] = [];

  // Parse available tools for prompt
  const availableToolsStr = toolsRegistry.map(t =>
    `- ${t.name}: ${t.description} \n  Inputs: ${JSON.stringify(t.inputSchema)}`
  ).join("\n");

  const systemMessage = AGENT_SYSTEM_PROMPT
    .replace("{tools}", availableToolsStr)
    .replace("{userName}", context.userProfile.name)
    .replace("{userType}", context.userProfile.type.replace(/_/g, " "))
    .replace("{city}", context.userProfile.city)
    .replace("{goalTarget}", context.userProfile.savings_goal.target.toString())
    .replace("{goalLabel}", context.userProfile.savings_goal.label)
    .replace("{goalCurrent}", context.userProfile.savings_goal.current.toString());

  // Truncate history to last 6
  const history = context.conversationHistory.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

  let generatedAlerts: Alert[] = [];
  try {
    const income = analyzeIncome(context.transactions, context.userProfile);
    const exp = trackExpenses(context.transactions, context.userId);
    const plan = planSavings(income, exp, context.userProfile.savings_goal);
    const fore = forecastIncome(context.transactions, context.userId);
    generatedAlerts = generateAlerts(income, exp, plan, fore, context.userProfile);

    const isMonday = new Date().getDay() === 1;
    const isFirstMessage = context.conversationHistory.length === 0;
    const digest = generateWeeklyDigest(context.transactions, income);

    if (isMonday && isFirstMessage) {
      toolOutputSummaries.push(`[weekly_digest] Automatically generated weekly digest for Monday: ${JSON.stringify(digest)}`);
    } else {
      // Make digest data available in context just in case AI needs it for a summary
      toolOutputSummaries.push(`[weekly_digest] Current Weekly Digest Data: ${JSON.stringify(digest)}`);
    }
  } catch (e) { console.error("Alert generation error in loop init", e); }

  const enhancedSystemMessage = systemMessage;

  while (iterations < maxIterations) {
    iterations++;

    let gatheredResults = toolOutputSummaries.length > 0
      ? "Tool results gathered so far:\n" + toolOutputSummaries.join("\n")
      : "No tool results yet.";

    let responseObj;

    if (iterations === 1) {
      const parsedWhatIf = parseWhatIfMessage(userMessage);
      if (parsedWhatIf) {
        responseObj = { action: "tool_call", tool: "what_if_simulator", toolInput: parsedWhatIf, thought: "Parsed deterministic what-if scenario from user message." };
      }
    }

    if (!responseObj) {
      const thinkPromptForModel = `
History:
${history}

${gatheredResults}

User message: "${userMessage}"

You must respond ONLY in valid JSON. No markdown, no extra text.
Choose ONE of these two formats:

Format 1 (When you NEED to fetch data, like picking an API tool):
{
  "action": "tool_call",
  "tool": "<exactly_tool_name>",
  "toolInput": { "<param>": "<value>" },
  "thought": "<why you need this tool>"
}

Format 2 (Only when ALL data is collected and you are ready to give the final output to the user):
{
  "action": "final_answer",
  "thought": "<final summary context>",
  "answer": "<your immediate output>"
}

CRITICAL INSTRUCTION: If your thought is "I need to call a tool to get the exchange rate", you MUST use Format 1 ("tool_call"). Do NOT use Format 2 to say you are going to call a tool. Only use Format 2 when you are 100% finished calculating. You can only call ONE tool per step. If you need multiple, chain them through multiple steps by outputting Format 1 repeatedly.
      `;

      // temperature 0.1: think phase must be structured, not creative
      let rawJSONStr = await callLLM(enhancedSystemMessage, [{ role: "user", content: thinkPromptForModel }], { maxTokens: 800, temperature: 0.1 });

      responseObj = tryParseJSON(rawJSONStr);

      // ── Retry once with an explicit correction message ─────────────────────
      if (!responseObj) {
        console.warn("[react-loop] First JSON parse failed — retrying with correction prompt.");
        const correctionMessages: { role: "user" | "assistant"; content: string }[] = [
          { role: "user",      content: thinkPromptForModel },
          { role: "assistant", content: rawJSONStr },
          { role: "user",      content: "Your previous response was not valid JSON. You MUST respond with ONLY a valid JSON object — no markdown fences, no explanation, nothing else. Output the JSON object now." }
        ];
        const retryStr = await callLLM(enhancedSystemMessage, correctionMessages, { maxTokens: 400, temperature: 0.0 });
        responseObj = tryParseJSON(retryStr);

        // Final regex fallback if retry still fails
        if (!responseObj) {
          console.error("[react-loop] Retry also failed. Using regex salvage.", retryStr);
          const actionMatch = retryStr.match(/"action"\s*:\s*"([^"]+)"/i);
          const thoughtMatch = retryStr.match(/"thought"\s*:\s*"([^"]+)"/i);
          const toolMatch   = retryStr.match(/"tool"\s*:\s*"([^"]+)"/i);
          responseObj = actionMatch && thoughtMatch
            ? { action: actionMatch[1], thought: thoughtMatch[1], tool: toolMatch?.[1], toolInput: {} }
            : { action: "error", thought: "Persistent JSON parse failure.", errorMsg: "Could not parse AI output after retry." };
        }
      }
    }

    if (responseObj.action === "tool_call") {
      if (!responseObj.tool) {
        logger.log({ thought: responseObj.thought || "Attempted tool call without specifying a tool." });
        toolOutputSummaries.push("Error: You requested to call a tool but did not provide the 'tool' field. You must provide a tool name.");
        continue;
      }
      
      logger.log({
        thought: responseObj.thought,
        toolCalled: responseObj.tool,
        toolInput: responseObj.toolInput
      });

      const tool = toolsRegistry.find(t => t.name === responseObj.tool);
      if (!tool) {
        const errorMsg = `Error: Tool not found '${responseObj.tool}'. Please use a valid tool from the list.`;
        toolOutputSummaries.push(errorMsg);
        
        const currentSteps = logger.getLog();
        if (currentSteps.length > 0) {
          currentSteps[currentSteps.length - 1].toolOutput = errorMsg;
        }
      } else {
        const res = await tool.execute(responseObj.toolInput || {}, context);
        const resultString = `[${tool.name}] Result: ${res.summary}`;
        toolOutputSummaries.push(resultString);
        toolResultsMap.set(tool.name, res.data);

        // Update the log for the UI
        const currentSteps = logger.getLog();
        if (currentSteps.length > 0) {
          currentSteps[currentSteps.length - 1].toolOutput = res.summary;
        }
      }
    } else if (responseObj.action === "final_answer") {
      logger.log({
        thought: responseObj.thought
      });

      const finalThoughts = responseObj.answer || responseObj.thought || "Concluding based on available data.";
      const toolDataDump = toolOutputSummaries.join("\n");

      // If tax_advisor ran, its kb_entries are already injected via buildExplainPrompt —
      // skip re-retrieval to avoid duplication. Otherwise retrieve general tips.
      const taxData = toolResultsMap.get("tax_advisor");
      const kbTips = taxData?.kb_entries?.length
        ? [] // already in the prompt via buildExplainPrompt
        : retrieveRelevantTips(userMessage, 3);
      const kbTipsStr = kbTips.map((t, idx) => `[Tip ${idx + 1}] ${t.title}: ${t.content}`).join("\n");

      // buildExplainPrompt handles user-type augmentation (fuel/FX appends)
      const baseExplainPrompt = buildExplainPrompt(toolResultsMap, context.userProfile);

      const explainPromptFinal = baseExplainPrompt
        .replace("{userName}", context.userProfile.name)
        .replace("{collected_tool_results}", toolDataDump || "None")
        .replace("{knowledge_base_tips}", kbTipsStr || "No specific tips retrieved.")
        .replace("{userMessage}", userMessage)
        .replace("{thought_from_final_answer}", finalThoughts);

      // temperature 0.4: warm enough to sound human, tight enough to stay accurate
      let finalMessage = await callLLM(explainPromptFinal, [{ role: "user", content: "Please provide the final response to the user." }], { maxTokens: 800, temperature: 0.4 });

      let showBankingCard = false;
      const BANKING_TRIGGER = "[SHOW_BANKING_CARD]";
      if (finalMessage.includes(BANKING_TRIGGER)) {
        showBankingCard = true;
        finalMessage = finalMessage.replace(BANKING_TRIGGER, "").trim();

        const dataUpdateForOptions: AgentResponse["data"] = {};
        if (toolResultsMap.has("savings_planner")) dataUpdateForOptions.savingsPlan = toolResultsMap.get("savings_planner");

        logger.log({
          thought: "User wants to take action on savings. Cannot process transfer directly. Surfacing personalized banking redirect card.",
          toolCalled: "banking_redirect",
          toolOutput: `Triggered banking card.`
        });
      }

      // Build data package for UI update
      const dataUpdate: AgentResponse["data"] = {};
      if (toolResultsMap.has("income_analyzer")) dataUpdate.incomeStats = toolResultsMap.get("income_analyzer");
      if (toolResultsMap.has("expense_tracker")) dataUpdate.expenseStats = toolResultsMap.get("expense_tracker");
      if (toolResultsMap.has("savings_planner")) dataUpdate.savingsPlan = toolResultsMap.get("savings_planner");
      if (toolResultsMap.has("income_forecaster")) dataUpdate.forecast = toolResultsMap.get("income_forecaster");
      if (toolResultsMap.has("what_if_simulator")) dataUpdate.whatIfResult = toolResultsMap.get("what_if_simulator");
      if (toolResultsMap.has("compare_scenarios")) dataUpdate.scenarioResult = toolResultsMap.get("compare_scenarios");

      return {
        message: finalMessage,
        reasoningLog: logger.getLog(),
        alerts: generatedAlerts,
        showBankingCard,
        data: dataUpdate
      };
    } else {
      // Invalid action
      logger.log({ thought: responseObj.thought || "Generated an invalid action." });
      toolOutputSummaries.push(`Error: Invalid action '${responseObj.action}'. You must choose either 'tool_call' or 'final_answer'.`);
    }
  }

  // Force exit after max iterations — buildExplainPrompt is in scope (module-level helper)
  logger.log({ thought: "Max iterations reached. Forcing final answer." });
  const fallbackExplainPrompt = buildExplainPrompt(toolResultsMap, context.userProfile)
    .replace("{userName}", context.userProfile.name)
    .replace("{collected_tool_results}", toolOutputSummaries.join("\n") || "None")
    .replace("{knowledge_base_tips}", "")
    .replace("{userMessage}", userMessage)
    .replace("{thought_from_final_answer}", "I had to stop reasoning early but here is what I know.");

  let finalResponse = await callLLM(
    fallbackExplainPrompt,
    [{ role: "user", content: "Please provide the final response to the user." }],
    { maxTokens: 800, temperature: 0.4 }
  );

  let showBankingCard = false;
  const BANKING_TRIGGER = "[SHOW_BANKING_CARD]";
  if (finalResponse.includes(BANKING_TRIGGER)) {
    showBankingCard = true;
    finalResponse = finalResponse.replace(BANKING_TRIGGER, "").trim();
  }

  return {
    message: finalResponse,
    reasoningLog: logger.getLog(),
    alerts: generatedAlerts,
    showBankingCard
  };
}
