const { loadOpenAIConfig, chatCompletion } = require("./openaiClient");
const aiMemory = require("./aiMemory");
const { suggestLinks } = require("./siteLinks");
const { crawlSitemap, saveUrls } = require("./siteCrawler");

const sessions = new Map();
const cooldown = new Map();

function sessionKey(guildId, channelId, userId) {
  return `${guildId}:${channelId}:${userId}`;
}

function now() { return Date.now(); }

function cleanExpired() {
  const timeout = 180000;
  const t = now();
  for (const [k, s] of sessions.entries()) {
    if (t - s.lastActive > timeout) sessions.delete(k);
  }
}

function stripBotMention(content, botId) {
  return String(content || "").replace(new RegExp("<@!?" + botId + ">", "g"), "").trim();
}

async function maybeCrawlSite(client) {
  const cfg = client.config.ai && client.config.ai.site;
  if (!cfg || !cfg.autoCrawl) return;
  try {
    const urls = await crawlSitemap(cfg.baseUrl, cfg.maxUrls || 200);
    if (urls) saveUrls(urls);
  } catch (e) {}
}

async function handleAI(client, message) {
  const gc = client.config.getGuildConfig(message.guild && message.guild.id);
  const cfg = gc.ai;
  if (!cfg || !cfg.enabled) return false;
  if (!message.guild || !message.member) return false;
  if (message.author.bot) return false;

  if (message.mentions && message.mentions.everyone) return false;
  const msgText = message.content || "";
  if (msgText.indexOf("@everyone") !== -1 || msgText.indexOf("@here") !== -1) return false;

  const prefix = client.config.prefix || "+";
  if (message.content && message.content.startsWith(prefix)) return false;

  cleanExpired();

  const isSupportChannel = cfg.supportChannelId && message.channel.id === cfg.supportChannelId;
  const isMention = cfg.mentionMode && message.mentions && message.mentions.has(client.user);
  const key = sessionKey(message.guild.id, message.channel.id, message.author.id);
  const hasSession = sessions.has(key);

  if (!isSupportChannel && !isMention && !hasSession) return false;

  const last = cooldown.get(key) || 0;
  if (now() - last < (cfg.perUserCooldownMs || 4000)) return true;
  cooldown.set(key, now());

  const oa = loadOpenAIConfig();
  if (!oa || !oa.apiKey) {
    await message.reply("IA non configuree.");
    return true;
  }

  const model = oa.model || cfg.model || "gpt-4o-mini";
  const s = sessions.get(key) || { lastActive: 0, turns: [] };
  s.lastActive = now();

  const userText = stripBotMention(message.content, client.user.id);
  if (!userText) return true;

  const defaultPrompt = "Tu es MajestyBot, assistant support pour MajestyCraft et MajestyLauncher. Aide rapidement, pose 1-2 questions si necessaire. Ne devine pas.";
  const system = cfg.systemPrompt || defaultPrompt;

  const contextLines = [];

  if (cfg.learn && cfg.learn.enabled) {
    const mem = aiMemory.searchSimilar(userText, message.guild.id, 6);
    if (mem.length) {
      contextLines.push("Contexte appris:");
      for (const m of mem) contextLines.push("- " + m.authorName + ": " + m.content);
    }
  }

  if (cfg.site && cfg.site.autoCrawl) {
    const links = suggestLinks(userText);
    if (links.length) {
      contextLines.push("Liens utiles:");
      for (const l of links) contextLines.push("- " + l.title + ": " + l.url);
    }
  }

  const maxTurns = cfg.maxTurns || 12;
  s.turns = s.turns.slice(-maxTurns);

  const msgs = [{ role: "system", content: system }];
  if (contextLines.length) msgs.push({ role: "system", content: contextLines.join("\n") });
  for (const t of s.turns) msgs.push(t);
  msgs.push({ role: "user", content: userText });

  const temperature = cfg.temperature != null ? cfg.temperature : 0.2;

  var answer = null;
  try {
    answer = await chatCompletion({ apiKey: oa.apiKey, model: model, messages: msgs, temperature: temperature, maxTokens: 700 });
  } catch (e) {
    await message.reply("Erreur IA: " + String(e && e.message || e).slice(0, 180));
    return true;
  }

  if (!answer) return true;

  s.turns.push({ role: "user", content: userText });
  s.turns.push({ role: "assistant", content: answer });
  s.lastActive = now();
  sessions.set(key, s);

  await message.reply({ content: answer.slice(0, 1900), allowedMentions: { parse: [] } });
  return true;
}

function clearSessions() {
  sessions.clear();
  cooldown.clear();
}

module.exports = { handleAI: handleAI, maybeCrawlSite: maybeCrawlSite, clearSessions: clearSessions };