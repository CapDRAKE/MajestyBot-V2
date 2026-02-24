// Polyfill WebCrypto pour discord-player (si crypto global n'existe pas)
if (!globalThis.crypto) {
  globalThis.crypto = require("node:crypto").webcrypto;
}

const { Client, GatewayIntentBits, Partials } = require("discord.js");
const config = require("./config/config");

const { loadCommands } = require("./handlers/commandHandler");
const { loadEvents } = require("./handlers/eventHandler");

const { Player } = require("discord-player");
const { YoutubeiExtractor } = require("discord-player-youtubei");
const { DefaultExtractors } = require("@discord-player/extractor");
const { getYouTubeCookie } = require("./services/youtubeAuth");

const TOKEN =
  process.env.DISCORD_TOKEN ||
  process.env.BOT_TOKEN ||
  process.env.TOKEN ||
  config.token;

if (!TOKEN || !TOKEN.trim()) {
  console.error("[FATAL] Missing bot token. Set env var DISCORD_TOKEN (recommended) or config/config.js token.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,      // welcome
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,    // prefix commands
    GatewayIntentBits.GuildVoiceStates,  // voice
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildPresences
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User]
});

// expose config to other modules
client.config = config;

// --- Discord Player ---
client.player = new Player(client);

// Logs utiles (une seule fois)
client.player.events.on("playerStart", (queue, track) => {
  console.log("[DP START]", track?.cleanTitle || track?.title);

  const ch = queue?.metadata?.channel;
  if (ch?.send) ch.send(`▶️ Lecture: **${track.cleanTitle}**`);
});

client.player.events.on("error", (queue, error) => {
  console.error("[DP ERROR]", error?.message || error);
});

client.player.events.on("connectionError", (queue, error) => {
  console.error("[DP VOICE ERROR]", error?.message || error);
});

// Ready
client.once("clientReady", async () => {
  await client.player.extractors.loadMulti(DefaultExtractors);

  const cookie = getYouTubeCookie?.() || null;

  await client.player.extractors.register(YoutubeiExtractor, {
    cookie: cookie || undefined,

    disablePlayer: true,

    // ✅ stream via client ANDROID
    streamOptions: {
      useClient: "ANDROID"
    }
  });

  console.log(`✅ Logged in as ${client.user.tag} (extractors loaded + youtubei)`);
});

// Commands + events
client.commands = loadCommands();
loadEvents(client);

client.login(TOKEN);