const { EmbedBuilder } = require("discord.js");
const { readJson, writeJson } = require("./storage");

const FILE   = "role_menu.json";
const MARKER = "ROLES — MAJESTYCORP";

const locks = new Map();

function loadDb()    { return readJson(FILE, { guilds: {} }); }
function saveDb(db)  { writeJson(FILE, db); }
function getGuildDb(db, guildId) {
  db.guilds[guildId] ||= { messageId: null };
  return db.guilds[guildId];
}

function buildEmbed(cfg) {
  const projectLines = (cfg.projectRoles || [])
    .map(r => `> ${r.emoji}  **${r.label}**`)
    .join("\n");

  const gamemodeLines = (cfg.roles || [])
    .map(r => `> ${r.emoji}  **${r.label}**`)
    .join("\n");

  const desc = [
    "Reagis avec l'emoji correspondant pour obtenir un role.",
    "Retire ta reaction pour le supprimer.",
    "",
    "**――――――  PROJETS  ――――――**",
    "",
    projectLines,
    "",
    "**―――  MODES DE JEU MAJESTYCRAFT  ―――**",
    "_Exclusifs aux membres MajestyCraft_",
    "",
    gamemodeLines,
  ].join("\n");

  return new EmbedBuilder()
    .setTitle("ROLES — MAJESTYCORP")
    .setDescription(desc)
    .setColor(0x5865F2)
    .setFooter({ text: "MajestyCorp • Cliquez pour choisir vos roles" })
    .setTimestamp(new Date());
}

function allRoles(cfg) {
  return [...(cfg.projectRoles || []), ...(cfg.roles || [])];
}

async function findExistingPanel(channel, botId) {
  const msgs = await channel.messages.fetch({ limit: 30 }).catch(() => null);
  if (!msgs) return null;
  for (const m of msgs.values()) {
    if (m.author?.id !== botId) continue;
    const title = m.embeds?.[0]?.title || "";
    if (title === MARKER) return m;
  }
  return null;
}

async function ensureRoleMenu(client, guild) {
  const cfg = client.config.getGuildConfig(guild.id).roleMenu;
  if (!cfg?.enabled) return;
  if (!cfg.channelId) return;

  if (locks.has(guild.id)) {
    await locks.get(guild.id);
    return;
  }

  const job = (async () => {
    const channel = await client.channels.fetch(cfg.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const db   = loadDb();
    const gdb  = getGuildDb(db, guild.id);
    const roles = allRoles(cfg);

    if (gdb.messageId) {
      const msg = await channel.messages.fetch(gdb.messageId).catch(() => null);
      if (msg) {
        await msg.edit({ embeds: [buildEmbed(cfg)] }).catch(() => {});
        for (const r of roles) {
          try { await msg.react(r.emoji); } catch {}
        }
        return;
      }
      gdb.messageId = null;
      saveDb(db);
    }

    const existing = await findExistingPanel(channel, client.user.id);
    if (existing) {
      await existing.edit({ embeds: [buildEmbed(cfg)] }).catch(() => {});
      gdb.messageId = existing.id;
      saveDb(db);
      for (const r of roles) {
        try { await existing.react(r.emoji); } catch {}
      }
      return;
    }

    const msg = await channel.send({ embeds: [buildEmbed(cfg)], allowedMentions: { parse: [] } });
    for (const r of roles) {
      try { await msg.react(r.emoji); } catch {}
    }
    gdb.messageId = msg.id;
    saveDb(db);
  })();

  locks.set(guild.id, job);
  try { await job; } finally { locks.delete(guild.id); }
}

function getRoleByEmoji(cfg, emojiName) {
  return allRoles(cfg).find(r => r.emoji === emojiName) || null;
}

async function isRoleMenuMessage(client, message) {
  if (!message?.guild) return false;
  const cfg = client.config.getGuildConfig(message.guild.id).roleMenu;
  if (!cfg?.enabled) return false;
  if (message.channel?.id !== cfg.channelId) return false;

  const db  = loadDb();
  const gdb = db.guilds?.[message.guild.id];
  if (!gdb?.messageId) return false;
  return message.id === gdb.messageId;
}

module.exports = { ensureRoleMenu, isRoleMenuMessage, getRoleByEmoji };
