const { PermissionsBitField, ChannelType } = require("discord.js");

let interval = null;
const debounce = new Map(); // guildId -> timeout
let targetGuildId = null;

function formatFR(n) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

async function safeSetName(channel, name) {
  if (!channel) return;
  if (channel.name === name) return;
  await channel.setName(name).catch(() => {});
}

async function resolveTargetGuild(client) {
  const cfg = client.config.memberCounters;
  if (!cfg?.enabled) return null;

  // On prend le guild qui possède le channel "total"
  const totalCh = await client.channels.fetch(cfg.totalChannelId).catch(() => null);
  if (!totalCh || !totalCh.guild) return null;

  targetGuildId = totalCh.guild.id;
  return totalCh.guild;
}

async function computeOnlineCount(guild) {
  // Essaie d'avoir un cache presence fiable (serveur ~200 => OK)
  try {
    // Nécessite Presence Intent activé dans le Dev Portal + GuildPresences intent côté code
    await guild.members.fetch({ withPresences: true });
  } catch {
    // si pas possible, on retombe sur le cache existant
  }

  const pres = guild.presences?.cache;
  if (!pres) return null;

  return pres.filter(p => p?.status && p.status !== "offline").size;
}

async function updateGuild(client, guild) {
  const cfg = client.config.memberCounters;
  if (!cfg?.enabled) return;

  const me = guild.members.me;
  if (!me?.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;

  const total = guild.memberCount || 0;
  const online = await computeOnlineCount(guild); // peut être null si pas de presence intent

  const totalName = (cfg.totalName || "👥 Membres : {count}")
    .replace("{count}", formatFR(total));

  const onlineName = (cfg.onlineName || "🟢 En ligne : {count}")
    .replace("{count}", online == null ? "?" : formatFR(online));

  const totalCh = await client.channels.fetch(cfg.totalChannelId).catch(() => null);
  const onlineCh = await client.channels.fetch(cfg.onlineChannelId).catch(() => null);

  // Sécurité : on ne modifie que si ça appartient bien au même serveur
  if (totalCh?.guildId !== guild.id || onlineCh?.guildId !== guild.id) return;

  if (totalCh?.type === ChannelType.GuildVoice) await safeSetName(totalCh, totalName);
  if (onlineCh?.type === ChannelType.GuildVoice) await safeSetName(onlineCh, onlineName);
}

function scheduleUpdate(client, guildId) {
  if (debounce.has(guildId)) return;
  debounce.set(
    guildId,
    setTimeout(async () => {
      debounce.delete(guildId);
      const g = client.guilds.cache.get(guildId);
      if (g) await updateGuild(client, g);
    }, 3000)
  );
}

async function start(client) {
  const cfg = client.config.memberCounters;
  if (!cfg?.enabled) return;

  if (interval) clearInterval(interval);

  const guild = await resolveTargetGuild(client);
  if (!guild) return;

  await updateGuild(client, guild).catch(() => {});

  interval = setInterval(() => {
    const g = client.guilds.cache.get(targetGuildId);
    if (g) updateGuild(client, g).catch(() => {});
  }, (cfg.updateIntervalSec || 120) * 1000);
}

module.exports = { start, updateGuild, scheduleUpdate };