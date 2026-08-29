const { ChannelType, PermissionsBitField } = require("discord.js");
const { useMainPlayer, useQueue } = require("discord-player");

// guildId → voiceChannel (en cache pour les reconnexions)
const radioChannels = new Map();
// évite les boucles de reconnexion simultanées
const reconnecting = new Set();

async function resolveVoiceChannel(guild, cfg) {
  if (cfg.voiceChannelId) {
    const ch = await guild.channels.fetch(cfg.voiceChannelId).catch(() => null);
    if (ch && ch.type === ChannelType.GuildVoice) return ch;
  }

  const name = cfg.voiceChannelName || "🎵 Radio";
  const existing = guild.channels.cache.find(
    c => c.type === ChannelType.GuildVoice && c.name === name
  );
  if (existing) return existing;

  return guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    permissionOverwrites: [{
      id: guild.roles.everyone.id,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect]
    }]
  }).catch(() => null);
}

async function playFallback(player, voiceChannel, cfg) {
  if (!cfg.fallbackUrl) return;
  const guildId = voiceChannel.guild.id;
  if (reconnecting.has(guildId)) return;
  reconnecting.add(guildId);

  try {
    await player.play(voiceChannel, cfg.fallbackUrl, {
      nodeOptions: {
        metadata: { channel: null },
        leaveOnEnd:   false,
        leaveOnStop:  false,
        leaveOnEmpty: false,
        volume: cfg.volume ?? 50,
        bufferingTimeout: 20_000
      },
      requestedBy: voiceChannel.guild.client.user
    });
  } catch (e) {
    console.error("[Radio] playFallback error:", e?.message || e);
    // Retry après 30s
    setTimeout(() => playFallback(player, voiceChannel, cfg), 30_000);
  } finally {
    reconnecting.delete(guildId);
  }
}

// Enregistre les events une seule fois par player
let eventsRegistered = false;

function setupEvents(player) {
  if (eventsRegistered) return;
  eventsRegistered = true;

  // Queue vide → rejoue le fallback
  player.events.on("emptyQueue", async (queue) => {
    const guildId = queue.guild.id;
    const entry = radioChannels.get(guildId);
    if (!entry) return;
    await new Promise(r => setTimeout(r, 2000)); // petit délai
    const current = useQueue(guildId);
    if (current && current.size > 0) return; // déjà remplie
    await playFallback(player, entry.voiceChannel, entry.cfg);
  });

  // Erreur → log + retry
  player.events.on("playerError", async (queue, error) => {
    console.error("[Radio] playerError:", error?.message || error);
    const guildId = queue.guild.id;
    const entry = radioChannels.get(guildId);
    if (!entry) return;
    setTimeout(() => playFallback(player, entry.voiceChannel, entry.cfg), 10_000);
  });
}

async function startRadio(client, guild) {
  const gc = client.config.getGuildConfig(guild.id);
  const cfg = gc.radio;
  if (!cfg?.enabled || !cfg.fallbackUrl) return;

  const voiceChannel = await resolveVoiceChannel(guild, cfg);
  if (!voiceChannel) {
    console.warn("[Radio] Impossible de trouver/créer le salon vocal.");
    return;
  }

  // Sauvegarde l'ID pour la commande +play
  cfg._resolvedVoiceChannelId = voiceChannel.id;
  radioChannels.set(guild.id, { voiceChannel, cfg });

  const player = useMainPlayer();
  setupEvents(player);

  await playFallback(player, voiceChannel, cfg);
  console.log(`[Radio] ✅ Connecté dans "${voiceChannel.name}" (${guild.name})`);
}

module.exports = { startRadio };
