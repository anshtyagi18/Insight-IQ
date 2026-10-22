// Downloads/1-main/src/services/insightAnalyst.ts

export interface InsightIQResponse {
  summary: string;
  cleaningSteps: string[];
  insights: string[];
}

export async function askInsightIQ(datasetInfo: any, userPrompt: string): Promise<InsightIQResponse> {
  const systemPrompt = `You are INSIGHTiQ, an autonomous analytics engine.
Dataset Details: ${JSON.stringify(datasetInfo)}

User Request: "${userPrompt}"

Answer strictly in this valid JSON format:
{
  "summary": "Direct executive summary answering the question.",
  "cleaningSteps": ["Step 1", "Step 2"],
  "insights": ["Key metric finding 1", "Trend finding 2"]
}
Do not write any markdown blocks or text outside the JSON.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000); // 35 second timeout

    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "llama3.2:3b", // Lightweight, instant on 8GB RAM
        prompt: systemPrompt,
        stream: false,
        format: "json",
        options: {
          temperature: 0.1,
          num_ctx: 1024,
          num_thread: 3 // Laptop freeze nahi hoga
        }
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    return JSON.parse(data.response);
  } catch (err: any) {
    console.error("INSIGHTiQ execution error:", err);
    return {
      summary: "Model connection timeout ya Ollama band hai. Check terminal.",
      cleaningSteps: [],
      insights: [err.message || "Failed to fetch response"]
    };
  }
}