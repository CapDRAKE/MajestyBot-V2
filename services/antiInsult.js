const { PermissionsBitField, EmbedBuilder } = require("discord.js");
const { isStaff } = require("../utils/permissions");
const modlog = require("./modlog");

const state = new Map(); // userId -> { strikes: number[] }

function cleanOld(arr, cutoffMs) {
  const now = Date.now();
  while (arr.length && now - arr[0] > cutoffMs) arr.shift();
}

function neutralizeMentions(text) {
  // évite de ping @everyone, @here et les mentions <@...> dans le salon staff
  return String(text || "")
    .replace(/@everyone/g, "@\u200beveryone")
    .replace(/@here/g, "@\u200bhere")
    .replace(/<@/g, "<@\u200b");
}

function normalizeSpaced(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // accents
    // mini leetspeak
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    .replace(/0/g, "o")
    .replace(/[1!]/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const RULES = [
  // FR
  { key: "connard", re: /\bconnard(s|e|es)?\b/ },
  { key: "encule", re: /\bencul(e|es|ee|ees|er|ers)?\b/ },
  { key: "salope", re: /\bsalope(s)?\b/ },
  { key: "pute", re: /\bpute(s)?\b/ },
  { key: "fdp", re: /\bfdp\b/ },
  { key: "filsdepute", re: /\bfils de pute\b/ },
  { key: "ntm", re: /\bntm\b/ },
  { key: "niquetamere", re: /\bnique ta mere\b/ },
  { key: "tagueule", re: /\bta gueule\b|\btg\b/ },
  { key: "batard", re: /\bbatard(s|e|es)?\b/ },

  // EN
  { key: "fuck", re: /\bfuck(ing|er|ers|ed)?\b/ },
  { key: "shit", re: /\bshit(s|ty)?\b/ },
  { key: "bitch", re: /\bbitch(es)?\b/ },
  { key: "asshole", re: /\basshole(s)?\b/ },
  { key: "cunt", re: /\bcunt(s)?\b/ },
  { key: "dick", re: /\bdick(s)?\b/ },
  { key: "motherfucker", re: /\bmotherfuck(er|ers|ing)?\b/ },
  { key: "stfu", re: /\bstfu\b/ },

  // Slurs (à toi de garder/retirer)
  { key: "faggot", re: /\bfaggot(s)?\b/ },
  { key: "nword", re: /\bnigg(er|a|as|ers)\b/ }
];

const COMPACT_TERMS = [
  "fuck", "motherfucker", "asshole",
  "connard", "encule", "salope", "filsdepute",
  "niquetamere", "tagueule", "fdp", "ntm"
];

function detectInsult(content) {
  const spaced = normalizeSpaced(content);
  if (!spaced) return null;

  for (const r of RULES) {
    if (r.re.test(spaced)) return r.key;
  }

  const compact = spaced.replace(/\s+/g, "");
  for (const t of COMPACT_TERMS) {
    if (compact.includes(t)) return t;
  }
  return null;
}

async function sendModLog(client, embed) {
  const id = client.config.modLogChannelId;
  if (!id) return;
  try {
    const ch = await client.channels.fetch(id);
    if (ch && ch.isTextBased()) await ch.send({ embeds: [embed] });
  } catch {}
}

async function handle(message) {
  const cfg = message.client.config.antiInsult;
  if (!cfg?.enabled) return false;
  if (!message.guild || !message.member) return false;
  if (message.author.bot) return false;

  if (cfg.ignoreStaff && isStaff(message.member)) return false;
  if (Array.isArray(cfg.ignoredChannelIds) && cfg.ignoredChannelIds.includes(message.channel.id)) return false;

  if (Array.isArray(cfg.ignoredRoleIds) && cfg.ignoredRoleIds.length) {
    const hasIgnoredRole = message.member.roles.cache.some(r => cfg.ignoredRoleIds.includes(r.id));
    if (hasIgnoredRole) return false;
  }

  const match = detectInsult(message.content);
  if (!match) return false;

  const original = message.content || "";
  const safeOriginal = neutralizeMentions(original).slice(0, 1200); // évite les embeds énormes

  // Delete message si demandé
  if (cfg.deleteMessage && message.deletable) {
    try { await message.delete(); } catch {}
  }

  // Historique fichier
  modlog.addEvent({
    guildId: message.guild.id,
    action: "INSULT",
    userId: message.author.id,
    modId: message.client.user.id,
    reason: "Auto-mod: insulte détectée",
    extra: {
      rule: match,
      channelId: message.channel.id,
      message: original.slice(0, 2000)
    }
  });

  // ✅ LOG STAFF : qui + où + quoi (avec anti-ping)
  const embed = new EmbedBuilder()
    .setTitle("🚫 Auto-mod : insulte détectée")
    .setDescription(
      `**User :** ${message.author} (\`${message.author.id}\`)\n` +
      `**Salon :** <#${message.channel.id}>\n` +
      `**Règle :** \`${match}\``
    )
    .addFields({
      name: "Message",
      value: safeOriginal.length ? `\`\`\`\n${safeOriginal}\n\`\`\`` : "*Message vide*"
    })
    .setTimestamp(new Date());

  await sendModLog(message.client, embed);

  // Strike en mémoire + timeout si récidive
  const uid = message.author.id;
  const now = Date.now();
  const s = state.get(uid) || { strikes: [] };
  s.strikes.push(now);
  cleanOld(s.strikes, (cfg.strikeWindowMinutes || 10) * 60 * 1000);
  state.set(uid, s);

  // Warn public (auto delete)
  const warnText = (cfg.warnMessage || "⚠️ {user} évite les insultes, merci.").replace("{user}", `${message.author}`);
  try {
    const m = await message.channel.send(warnText);
    setTimeout(() => m.delete().catch(() => {}), 8000);
  } catch {}

  if (s.strikes.length >= (cfg.strikesToTimeout || 3)) {
    const timeoutMs = (cfg.timeoutMinutes || 10) * 60 * 1000;

    // reset strikes après sanction
    s.strikes = [];
    state.set(uid, s);

    if (message.guild.members.me?.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      try {
        await message.member.timeout(timeoutMs, "Auto-mod: insultes répétées");

        modlog.addEvent({
          guildId: message.guild.id,
          action: "INSULT_TIMEOUT",
          userId: uid,
          modId: message.client.user.id,
          reason: "Auto-mod: insultes répétées",
          durationMs: timeoutMs
        });

        const emb2 = new EmbedBuilder()
          .setTitle("⏳ Auto-mod : timeout (insultes)")
          .setDescription(`**User :** <@${uid}>\n**Durée :** ${cfg.timeoutMinutes || 10} min\n**Raison :** insultes répétées`)
          .setTimestamp(new Date());

        await sendModLog(message.client, emb2);
      } catch {}
    }
  }

  return true; // stop traitement (anti-spam/commands)
}

module.exports = { handle };