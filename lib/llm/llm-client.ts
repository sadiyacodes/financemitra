import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

export async function callLLM(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const ollamaModel = process.env.OLLAMA_MODEL || "llama3";
  const maxTokens = options?.maxTokens ?? 800;
  const temperature = options?.temperature ?? 0.7;

  const awsKeyId = process.env.AWS_ACCESS_KEY_ID;
  const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
  const awsRegion = process.env.AWS_REGION || "us-east-1";
  const bedrockModel = process.env.BEDROCK_MODEL || "qwen.qwen3-32b-v1:0";

  if (awsKeyId && awsSecret) {
    try {
      const client = new BedrockRuntimeClient({
        region: awsRegion,
        credentials: {
          accessKeyId: awsKeyId,
          secretAccessKey: awsSecret,
          ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}),
        },
      });

      const bedrockMessages = messages.map(m => ({
        role: m.role as "user" | "assistant",
        content: [{ text: m.content }],
      }));

      const command = new ConverseCommand({
        modelId: bedrockModel,
        system: [{ text: systemPrompt }],
        messages: bedrockMessages,
        inferenceConfig: { maxTokens, temperature },
      });

      const response = await client.send(command);
      const bedrockContent = response.output?.message?.content;
      const text = bedrockContent
        ? bedrockContent
            .map(block => typeof block === "object" && "text" in block && typeof block.text === "string" ? block.text : "")
            .filter(Boolean)
            .join("\n")
        : undefined;

      if (text) {
        console.log(`[LLM] Bedrock (${bedrockModel}) responded`);
        return text;
      }

      console.warn(
        `Bedrock (${bedrockModel}) returned no text in response; falling back to Ollama...`,
        JSON.stringify(response.output?.message?.content ?? response.output, null, 2)
      );
    } catch (error) {
      console.warn("Bedrock unavailable, falling back to Ollama...", error);
    }
  } else {
    console.warn("AWS credentials not set. Skipping Bedrock...");
  }

  // 1. Try Ollama (local fallback)
  try {
    const ollamaMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    const ollamaResponse = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        messages: ollamaMessages,
        stream: false,
        options: { temperature }
      }),
      signal: AbortSignal.timeout(120000)
    });

    if (ollamaResponse.ok) {
      const data = await ollamaResponse.json();
      if (data.message?.content) {
        return data.message.content;
      }
    } else {
      console.warn(`Ollama responded with status: ${ollamaResponse.status}`);
    }
  } catch (error) {
    console.warn("Ollama unavailable or timed out. Falling back to Claude...", error);
  }

  // 4. Try Claude / Anthropic API (Third cloud fallback)
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey && anthropicKey !== "your-anthropic-api-key-here") {
    try {
      const claudeModel = process.env.CLAUDE_MODEL || "claude-sonnet-4-5";

      const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: claudeModel,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages,
        }),
      });

      if (claudeResponse.ok) {
        const data = await claudeResponse.json();
        if (data.content?.[0]?.text) {
          return data.content[0].text;
        }
        return "Error: Empty response from Claude API.";
      } else {
        const errText = await claudeResponse.text();
        console.error("Claude API error:", errText);
        console.warn(`Claude responded with status ${claudeResponse.status}. Falling back to Gemini...`);
      }
    } catch (error) {
      console.warn("Claude fallback failed. Trying Gemini...", error);
    }
  } else {
    console.warn("ANTHROPIC_API_KEY not configured. Skipping Claude, falling back to Gemini...");
  }

  // 5. Try Gemini (Final fallback)
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || geminiKey === "your_gemini_api_key_here") {
      return "Error: Ollama is unreachable and neither ANTHROPIC_API_KEY nor GEMINI_API_KEY is configured.";
    }

    // Gemini uses "user" / "model" roles
    const geminiContents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const geminiPayload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: geminiContents,
      generationConfig: { temperature },
    };

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      }
    );

    if (geminiResponse.ok) {
      const data = await geminiResponse.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
      return "Error: Empty response from Gemini API.";
    } else {
      const errText = await geminiResponse.text();
      console.error("Gemini failed:", errText);
      return `Error: Gemini API error (${geminiResponse.status})`;
    }
  } catch (error) {
    console.error("Gemini fallback failed:", error);
    return "Error: All LLM providers failed (Ollama, Claude, Gemini). Check your configuration.";
  }
}
