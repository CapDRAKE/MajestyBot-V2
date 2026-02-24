const fs = require("fs");
const path = require("path");

function loadOpenAIConfig() {
  const p = path.join(__dirname, "..", "config", "openai.json");
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

async function chatCompletion({ model, apiKey, messages, temperature = 0.2, maxTokens = 600 }) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens
      })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`OpenAI HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return (content || "").trim();
  } finally {
    clearTimeout(t);
  }
}

module.exports = { loadOpenAIConfig, chatCompletion };