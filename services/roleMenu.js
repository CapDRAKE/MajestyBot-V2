const { EmbedBuilder } = require("discord.js");
const { readJson, writeJson } = require("./storage");

const FILE = "role_menu.json";
const MARKER = "";

const locks = new Map(); // guildId -> Promise

function loadDb() {
  return readJson(FILE, { guilds: {} });
}
function saveDb(db) {
  writeJson(FILE, db);
}
function getGuildDb(db, guildId) {
  db.guilds[guildId] ||= { messageId: null };
  return db.guilds[guildId];
}

function buildEmbed(cfg) {
  const lines = (cfg.roles || []).map(r => `${r.emoji} **${r.label}**`).join("\n");

  return new EmbedBuilder()
    .setTitle(cfg.title || "📣 Notifications")
    .setDescription(`${cfg.description || ""}\n\n${lines}\n\n*${MARKER}*`)
    .setFooter({ text: "MajestyCraft • Notifications" })
    .setTimestamp(new Date());
}

async function findExistingPanel(channel, botId) {
  const msgs = await channel.messages.fetch({ limit: 30 }).catch(() => null);
  if (!msgs) return null;

  // On cherche un message du bot dont l'embed contient le marker
  for (const m of msgs.values()) {
    if (m.author?.id !== botId) continue;
    const emb = m.embeds?.[0];
    const desc = emb?.description || "";
    if (desc.includes(MARKER)) return m;
  }
  return null;
}

async function ensureRoleMenu(client, guild) {
  const cfg = client.config.roleMenu;
  if (!cfg?.enabled) return;
  if (!cfg.channelId) return;

  if (locks.has(guild.id)) {
    await locks.get(guild.id);
    return;
  }

  const job = (async () => {
    const channel = await client.channels.fetch(cfg.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const db = loadDb();
    const gdb = getGuildDb(db, guild.id);

    // 1) message déjà connu
    if (gdb.messageId) {
      const msg = await channel.messages.fetch(gdb.messageId).catch(() => null);
      if (msg) {
        // s'assure que les réactions existent
        for (const r of cfg.roles || []) {
          try { await msg.react(r.emoji); } catch {}
        }
        return;
      }
      gdb.messageId = null;
      saveDb(db);
    }

    // 2) adopter un panel existant
    const existing = await findExistingPanel(channel, client.user.id);
    if (existing) {
      gdb.messageId = existing.id;
      saveDb(db);
      for (const r of cfg.roles || []) {
        try { await existing.react(r.emoji); } catch {}
      }
      return;
    }

    // 3) créer
    const embed = buildEmbed(cfg);
    const msg = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });

    for (const r of cfg.roles || []) {
      try { await msg.react(r.emoji); } catch {}
    }

    gdb.messageId = msg.id;
    saveDb(db);
  })();

  locks.set(guild.id, job);
  try { await job; } finally { locks.delete(guild.id); }
}

function getRoleByEmoji(cfg, emojiName) {
  return (cfg.roles || []).find(r => r.emoji === emojiName) || null;
}

async function isRoleMenuMessage(client, message) {
  const cfg = client.config.roleMenu;
  if (!cfg?.enabled) return false;
  if (!message || !message.guild) return false;
  if (message.channel?.id !== cfg.channelId) return false;

  const db = loadDb();
  const gdb = db.guilds?.[message.guild.id];
  if (!gdb?.messageId) return false;

  return message.id === gdb.messageId;
}

module.exports = {
  ensureRoleMenu,
  isRoleMenuMessage,
  getRoleByEmoji
};