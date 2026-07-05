const fs = require("fs");
const path = require("path");

function loadOpenAIConfig() {
  if (process.env.GROQ_API_KEY) {
    return { apiKey: process.env.GROQ_API_KEY, model: "llama-3.3-70b-versatile" };
  }
  const p = path.join(__dirname, "..", "config", "openai.json");
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

async function chatCompletion({ model, apiKey, messages, temperature, maxTokens }) {
  model = model || "llama-3.3-70b-versatile";

  const body = {
    model: model,
    messages: messages,
    temperature: temperature != null ? temperature : 0.7,
    max_tokens: maxTokens || 700
  };

  const controller = new AbortController();
  const t = setTimeout(function() { controller.abort(); }, 25000);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const txt = await res.text().catch(function() { return ""; });
      throw new Error("Groq HTTP " + res.status + ": " + txt.slice(0, 300));
    }

    const data = await res.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return (content || "").trim();
  } finally {
    clearTimeout(t);
  }
}

module.exports = { loadOpenAIConfig: loadOpenAIConfig, chatCompletion: chatCompletion };