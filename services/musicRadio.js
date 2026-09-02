const https = require("https");
const http  = require("http");
const { ChannelType, PermissionsBitField } = require("discord.js");
const { useMainPlayer, createAudioResource, StreamType } = require("discord-player");

const radioState = new Map(); // guildId → { queue, cfg, stream }

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

// Fetch le stream HTTP/HTTPS et retourne le IncomingMessage (Readable)
function fetchStream(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, { timeout: 15_000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Suivi des redirections
        return fetchStream(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      resolve(res);
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Stream fetch timeout")); });
  });
}

async function playStream(queue, cfg) {
  // Annule l'ancien stream si existant
  const state = radioState.get(queue.guild.id);
  if (state?.stream) {
    try { state.stream.destroy(); } catch (_) {}
  }

  try {
    console.log("[Radio] Connexion au stream NRJ...");
    const stream = await fetchStream(cfg.streamUrl);
    if (state) state.stream = stream;

    // StreamType.Arbitrary = ffmpeg transcodera le MP3 en Opus
    const resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true
    });
    resource.volume?.setVolume((cfg.volume ?? 50) / 100);

    await queue.dispatcher.playStream(resource);
    console.log("[Radio] ▶ Stream NRJ en cours");
  } catch (e) {
    console.error("[Radio] Erreur playStream:", e?.message || e);
    setTimeout(() => playStream(queue, cfg), 10_000);
  }
}

async function startRadio(client, guild) {
  const gc = client.config.getGuildConfig(guild.id);
  const cfg = gc.radio;
  if (!cfg?.enabled || !cfg.streamUrl) return;

  const voiceChannel = await resolveVoiceChannel(guild, cfg);
  if (!voiceChannel) return console.warn("[Radio] Salon vocal introuvable.");

  cfg._resolvedVoiceChannelId = voiceChannel.id;

  const player = useMainPlayer();

  // Détruit le node existant si présent
  if (player.nodes.has(guild.id)) {
    try { player.nodes.delete(guild.id); } catch (_) {}
    await new Promise(r => setTimeout(r, 500));
  }

  const queue = player.nodes.create(guild, {
    metadata: { channel: null },
    leaveOnEnd:      false,
    leaveOnStop:     false,
    leaveOnEmpty:    false,
    volume:          cfg.volume ?? 50,
    disableHistory:  true,
    connectionTimeout: 60_000
  });

  // Connexion vocale
  await queue.connect(voiceChannel);
  radioState.set(guild.id, { queue, cfg, stream: null });

  // Relance quand le stream se termine
  queue.dispatcher.on("finish", () => {
    console.log("[Radio] Stream terminé, relance dans 3s...");
    setTimeout(() => playStream(queue, cfg), 3_000);
  });

  queue.dispatcher.on("error", (e) => {
    console.error("[Radio] Dispatcher error:", e?.message || e);
    setTimeout(() => playStream(queue, cfg), 5_000);
  });

  await playStream(queue, cfg);
  console.log(`[Radio] ✅ NRJ démarré dans "${voiceChannel.name}" (${guild.name})`);
}

module.exports = { startRadio };
