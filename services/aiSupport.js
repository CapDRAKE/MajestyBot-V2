const { loadOpenAIConfig, chatCompletion } = require("./openaiClient");
const aiMemory = require("./aiMemory");
const { suggestLinks } = require("./siteLinks");
const { crawlSitemap, saveUrls } = require("./siteCrawler");

const sessions = new Map(); // key -> { lastActive, turns: [{role,content}] }
const cooldown = new Map(); // key -> lastMs

function sessionKey(guildId, channelId, userId) {
  return `${guildId}:${channelId}:${userId}`;
}

function now() { return Date.now(); }

function cleanExpired(client) {
  const timeout = client.config.ai?.sessionTimeoutMs ?? 180000;
  const t = now();
  for (const [k, s] of sessions.entries()) {
    if (t - s.lastActive > timeout) sessions.delete(k);
  }
}

function stripBotMention(content, botId) {
  return String(content || "").replace(new RegExp(`<@!?${botId}>`, "g"), "").trim();
}

async function maybeCrawlSite(client) {
  const cfg = client.config.ai?.site;
  if (!cfg?.autoCrawl) return;
  try {
    const urls = await crawlSitemap(cfg.baseUrl, cfg.maxUrls || 200);
    if (urls) saveUrls(urls);
  } catch {
    // ignore (sitemap absent / fetch bloqué)
  }
}

async function handleAI(client, message) {
  const cfg = client.config.ai;
  if (!cfg?.enabled) return false;
  if (!message.guild || !message.member) return false;
  if (message.author.bot) return false;
  
  // Ne jamais répondre aux messages qui ping @everyone/@here
  if (message.mentions?.everyone) return false;
  if (/@everyone|@here/.test(message.content || "")) return false;

  // Ne répond pas aux commandes
  const prefix = client.config.prefix || "+";
  if (message.content?.startsWith(prefix)) return false;

  cleanExpired(client);

  const isSupportChannel = message.channel.id === cfg.supportChannelId;
  const isMention = cfg.mentionMode && message.mentions?.has(client.user);

  const key = sessionKey(message.guild.id, message.channel.id, message.author.id);
  const hasSession = sessions.has(key);

  // Déclenchement :
  // - mention => start/refresh session
  // - support channel => always
  // - session active => continue
  if (!isSupportChannel && !isMention && !hasSession) return false;

  // cooldown anti-spam IA
  const last = cooldown.get(key) || 0;
  if (now() - last < (cfg.perUserCooldownMs || 4000)) return true;
  cooldown.set(key, now());

  // load OpenAI config
  const oa = loadOpenAIConfig();
  if (!oa?.apiKey) {
    await message.reply("⚠️ IA non configurée (config/openai.json manquant).");
    return true;
  }

  const model = oa.model || cfg.model || "gpt-4o-mini";

  // session init / refresh
  const s = sessions.get(key) || { lastActive: 0, turns: [] };
  s.lastActive = now();

  const userText = stripBotMention(message.content, client.user.id);
  if (!userText) return true;

  // Récup “mémoire” pertinente
  const mem = aiMemory.searchSimilar(userText, message.guild.id, 6);

  // Liens suggérés
  const links = suggestLinks(userText);

  const system = `
Tu es MajestyBot, assistant support pour le serveur MajestyCraft et MajestyLauncher.
Objectif: aider rapidement (étapes courtes), poser 1-2 questions si nécessaire, et proposer des liens utiles.
Ne devine pas. Si tu n'es pas sûr, dis-le et propose une marche à suivre.
`.trim();

  const contextLines = [];
  if (mem.length) {
    contextLines.push("Contexte appris du serveur (extraits):");
    for (const m of mem) {
      contextLines.push(`- [#${m.channelId}] ${m.authorName}: ${m.content}`);
    }
  }
  if (links.length) {
    contextLines.push("\nLiens utiles possibles:");
    for (const l of links) contextLines.push(`- ${l.title}: ${l.url}`);
  }

  // Historique session (limité)
  const maxTurns = cfg.maxTurns || 12;
  s.turns = s.turns.slice(-maxTurns);

  const messages = [
    { role: "system", content: system },
    ...(contextLines.length ? [{ role: "system", content: contextLines.join("\n") }] : []),
    ...s.turns,
    { role: "user", content: userText }
  ];

  const answer = await chatCompletion({
    apiKey: oa.apiKey,
    model,
    messages,
    temperature: 0.2,
    maxTokens: 700
  }).catch(async (e) => {
    await message.reply(`❌ IA: ${String(e?.message || e).slice(0, 180)}`);
    return null;
  });

  if (!answer) return true;

  // update history
  s.turns.push({ role: "user", content: userText });
  s.turns.push({ role: "assistant", content: answer });
  s.lastActive = now();
  sessions.set(key, s);

  // Répondre sans ping tout le monde
  await message.reply({
    content: answer.slice(0, 1900),
    allowedMentions: { parse: [] }
  });

  return true;
}

function clearSessions() {
  sessions.clear();
  cooldown.clear();
}

module.exports = { handleAI, maybeCrawlSite, clearSessions };