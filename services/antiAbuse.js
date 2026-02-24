const { PermissionsBitField, EmbedBuilder } = require("discord.js");
const { isStaff } = require("../utils/permissions");
const modlog = require("./modlog");

// --- state slowmode ---
const channelEvents = new Map(); // channelId -> [{t, uid}]
const slowState = new Map(); // channelId -> { active, prev, revertTimer, lastApplied }

function now() { return Date.now(); }

function neutralizeMentions(text) {
  return String(text || "")
    .replace(/@everyone/g, "@\u200beveryone")
    .replace(/@here/g, "@\u200bhere")
    .replace(/<@/g, "<@\u200b")
    .slice(0, 1200);
}

async function sendModLog(client, embed) {
  const id = client.config.modLogChannelId;
  if (!id) return;
  try {
    const ch = await client.channels.fetch(id);
    if (ch && ch.isTextBased()) await ch.send({ embeds: [embed] });
  } catch {}
}

// ---------- Anti @everyone/@here + mentions mass ----------
async function handleMentions(message, cfg) {
  const mcfg = cfg.mentions || {};
  const blockEveryoneHere = mcfg.blockEveryoneHere !== false;

  const everyoneHere = Boolean(message.mentions?.everyone); // true si @everyone ou @here
  const userMentions = message.mentions?.users?.size || 0;
  const roleMentions = message.mentions?.roles?.size || 0;

  const tooManyUsers = mcfg.maxUserMentions ? userMentions >= mcfg.maxUserMentions : false;
  const tooManyRoles = mcfg.maxRoleMentions ? roleMentions >= mcfg.maxRoleMentions : false;

  if ((blockEveryoneHere && everyoneHere) || tooManyUsers || tooManyRoles) {
    // delete
    if (message.deletable) {
      try { await message.delete(); } catch {}
    }

    modlog.addEvent({
      guildId: message.guild.id,
      action: "ANTI_MENTION",
      userId: message.author.id,
      modId: message.client.user.id,
      reason: "Auto-mod: mention abusive",
      extra: { everyoneHere, userMentions, roleMentions }
    });

    const embed = new EmbedBuilder()
      .setTitle("🚫 Auto-mod : mention abusive")
      .setDescription(
        `**User :** ${message.author} (\`${message.author.id}\`)\n` +
        `**Salon :** <#${message.channel.id}>\n` +
        `**@everyone/@here :** ${everyoneHere ? "oui" : "non"}\n` +
        `**Mentions users :** ${userMentions}\n` +
        `**Mentions rôles :** ${roleMentions}`
      )
      .addFields({ name: "Message", value: `\`\`\`\n${neutralizeMentions(message.content)}\n\`\`\`` })
      .setTimestamp(new Date());

    await sendModLog(message.client, embed);

    // petit warn discret (auto delete)
    try {
      const warn = await message.channel.send({
        content: `⚠️ ${message.author} évite les mentions massives.`,
        allowedMentions: { parse: [] }
      });
      setTimeout(() => warn.delete().catch(() => {}), 6000);
    } catch {}

    return true;
  }

  return false;
}

// ---------- Anti-lien pour comptes récents ----------
function extractUrls(text) {
  const s = String(text || "");
  const out = [];

  // http(s)
  const re = /https?:\/\/[^\s<>()]+/gi;
  let m;
  while ((m = re.exec(s))) out.push(m[0]);

  // discord invites sans http
  const re2 = /\bdiscord\.gg\/[a-z0-9-]+\b/gi;
  while ((m = re2.exec(s))) out.push(`https://${m[0]}`);

  const re3 = /\bdiscord\.com\/invite\/[a-z0-9-]+\b/gi;
  while ((m = re3.exec(s))) out.push(`https://${m[0]}`);

  return out;
}

function hostAllowed(host, whitelist) {
  const h = String(host || "").toLowerCase().replace(/^www\./, "");
  for (const d of whitelist || []) {
    const dom = String(d).toLowerCase().replace(/^www\./, "");
    if (h === dom || h.endsWith("." + dom)) return true;
  }
  return false;
}

async function handleLinks(message, cfg) {
  const lcfg = cfg.antiLinksNewAccounts;
  if (!lcfg?.enabled) return false;

  const minDays = lcfg.minAccountAgeDays ?? 7;
  const ageMs = now() - message.author.createdAt.getTime();
  const minMs = minDays * 24 * 60 * 60 * 1000;

  // pas un compte récent => on ne filtre pas
  if (ageMs >= minMs) return false;

  const urls = extractUrls(message.content);
  if (!urls.length) return false;

  const whitelist = Array.isArray(lcfg.whitelistDomains) ? lcfg.whitelistDomains : [];

  // si au moins 1 url n'est pas whitelist => bloc
  let blocked = false;
  let badHost = null;

  for (const u of urls) {
    try {
      const host = new URL(u).hostname;
      if (!hostAllowed(host, whitelist)) {
        blocked = true;
        badHost = host;
        break;
      }
    } catch {
      blocked = true;
      badHost = "invalid-url";
      break;
    }
  }

  if (!blocked) return false;

  if (message.deletable) {
    try { await message.delete(); } catch {}
  }

  modlog.addEvent({
    guildId: message.guild.id,
    action: "ANTI_LINK_NEW_ACCOUNT",
    userId: message.author.id,
    modId: message.client.user.id,
    reason: "Auto-mod: lien interdit (compte récent)",
    extra: { badHost, urls: urls.slice(0, 5) }
  });

  const embed = new EmbedBuilder()
    .setTitle("🔗 Auto-mod : lien bloqué (compte récent)")
    .setDescription(
      `**User :** ${message.author} (\`${message.author.id}\`)\n` +
      `**Salon :** <#${message.channel.id}>\n` +
      `**Compte :** ~${Math.floor(ageMs / 86400000)} jour(s)\n` +
      `**Domaine :** \`${badHost}\``
    )
    .addFields({ name: "Message", value: `\`\`\`\n${neutralizeMentions(message.content)}\n\`\`\`` })
    .setTimestamp(new Date());

  await sendModLog(message.client, embed);

  // warn discret
  try {
    const warn = await message.channel.send({
      content: `⚠️ ${message.author} les liens sont bloqués pour les comptes de moins de ${minDays} jours.`,
      allowedMentions: { parse: [] }
    });
    setTimeout(() => warn.delete().catch(() => {}), 7000);
  } catch {}

  return true;
}

// ---------- Auto slowmode anti-raid ----------
async function applySlowmode(client, channel, cfg, reason) {
  if (!channel || typeof channel.setRateLimitPerUser !== "function") return false;

  const me = channel.guild.members.me;
  const can = me?.permissions?.has(PermissionsBitField.Flags.ManageChannels);
  if (!can) return false;

  const scfg = cfg.slowmodeRaid;
  const state = slowState.get(channel.id) || { active: false, prev: channel.rateLimitPerUser || 0, revertTimer: null, lastApplied: 0 };

  const cooldownMs = (scfg.cooldownMin || 10) * 60 * 1000;
  if (now() - (state.lastApplied || 0) < cooldownMs) return false;

  const newSlow = scfg.slowmodeSec || 8;
  const current = channel.rateLimitPerUser || 0;

  // si déjà >= slowmode demandé, on ne touche pas
  if (current >= newSlow && state.active) return false;

  // stocke slowmode actuel pour restore
  state.prev = current;
  state.active = true;
  state.lastApplied = now();

  // clear old timer
  if (state.revertTimer) clearTimeout(state.revertTimer);

  await channel.setRateLimitPerUser(newSlow, reason).catch(() => null);

  // log staff
  const embed = new EmbedBuilder()
    .setTitle("🐢 Auto-mod : slowmode activé")
    .setDescription(
      `Salon: <#${channel.id}>\n` +
      `Slowmode: **${newSlow}s** pour **${scfg.durationMin || 5} min**\n` +
      `Raison: ${reason}`
    )
    .setTimestamp(new Date());
  await sendModLog(client, embed);

  if (scfg.announceInChannel) {
    try {
      const m = await channel.send({ content: `🐢 Slowmode activé (${newSlow}s) suite à un spam.`, allowedMentions: { parse: [] } });
      setTimeout(() => m.delete().catch(() => {}), 8000);
    } catch {}
  }

  // revert
  state.revertTimer = setTimeout(async () => {
    try {
      const latest = slowState.get(channel.id);
      if (!latest?.active) return;

      await channel.setRateLimitPerUser(latest.prev || 0, "Auto-mod: fin slowmode").catch(() => null);

      const emb2 = new EmbedBuilder()
        .setTitle("✅ Auto-mod : slowmode désactivé")
        .setDescription(`Salon: <#${channel.id}>\nRetour à **${latest.prev || 0}s**`)
        .setTimestamp(new Date());
      await sendModLog(client, emb2);
    } finally {
      slowState.delete(channel.id);
    }
  }, (scfg.durationMin || 5) * 60 * 1000);

  slowState.set(channel.id, state);
  return true;
}

async function handleSlowmode(message, cfg) {
  const scfg = cfg.slowmodeRaid;
  if (!scfg?.enabled) return false;

  // only guild text-like channels
  const ch = message.channel;
  if (!ch || typeof ch.id !== "string") return false;

  const windowMs = (scfg.windowSec || 10) * 1000;
  const arr = channelEvents.get(ch.id) || [];
  arr.push({ t: now(), uid: message.author.id });

  // clean old
  while (arr.length && now() - arr[0].t > windowMs) arr.shift();
  channelEvents.set(ch.id, arr);

  const total = arr.length;
  const uniq = new Set(arr.map(x => x.uid)).size;

  if (total >= (scfg.msgThreshold || 18) && uniq >= (scfg.uniqueUsersThreshold || 7)) {
    await applySlowmode(message.client, ch, cfg, `Spam raid détecté (${total} msg / ${uniq} users en ${scfg.windowSec || 10}s)`);
    return true;
  }

  return false;
}

// ---------- Main handler ----------
async function handle(message) {
  const cfg = message.client.config.antiAbuse;
  if (!cfg?.enabled) return false;
  if (!message.guild || !message.member) return false;
  if (message.author.bot) return false;

  if (cfg.ignoreStaff && isStaff(message.member)) return false;

  // 1) Mentions
  const stopMentions = await handleMentions(message, cfg);
  if (stopMentions) return true;

  // 2) Liens comptes récents
  const stopLinks = await handleLinks(message, cfg);
  if (stopLinks) return true;

  // 3) Slowmode anti-raid (ne bloque pas forcément le message, juste active slowmode)
  await handleSlowmode(message, cfg);

  return false;
}

module.exports = { handle };