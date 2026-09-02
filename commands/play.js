const { useMainPlayer, useQueue, QueryType } = require("discord-player");

module.exports = {
  name: "play",
  aliases: ["p"],
  async execute({ client, message, args }) {
    const queryRaw = args.join(" ").trim();
    if (!queryRaw) return message.reply(`Usage: \`${client.config.prefix}play <titre ou URL>\``);

    const player = useMainPlayer();
    const gc = client.config.getGuildConfig(message.guild.id);
    const radioCfg = gc.radio;

    // Détermine le salon vocal cible :
    // 1) Le salon où est l'utilisateur
    // 2) Sinon le salon radio si le bot y est déjà connecté
    let voiceChannel = message.member?.voice?.channel;

    if (!voiceChannel && radioCfg?.enabled) {
      const radioChannelId = radioCfg._resolvedVoiceChannelId || radioCfg.voiceChannelId;
      const queue = useQueue(message.guild.id);
      if (queue && radioChannelId) {
        voiceChannel = await message.guild.channels.fetch(radioChannelId).catch(() => null);
      }
    }

    if (!voiceChannel) {
      return message.reply("❌ Rejoins un salon vocal ou le salon radio pour proposer une musique.");
    }

    const query = queryRaw;
    const vol = radioCfg?.volume ?? Math.round((gc.music?.defaultVolume ?? 0.5) * 100);

    const textChannel = radioCfg?.textChannelId
      ? await message.guild.channels.fetch(radioCfg.textChannelId).catch(() => null)
      : message.channel;

    try {
      const isUrl = /^https?:\/\//i.test(query);
      const { track } = await player.play(voiceChannel, query, {
        searchEngine: isUrl ? undefined : QueryType.SOUNDCLOUD_SEARCH,
        nodeOptions: {
          metadata: { channel: textChannel || message.channel },
          leaveOnEnd:   false,
          leaveOnStop:  false,
          leaveOnEmpty: false,
          volume: vol,
          bufferingTimeout: 15_000
        },
        requestedBy: message.author
      });

      const queue = useQueue(message.guild.id);
      const pos = queue ? queue.size : "?";
      const isNext = pos <= 1;

      await message.reply(
        isNext
          ? `▶️ **${track.cleanTitle}** — lecture immédiate !`
          : `🎵 **${track.cleanTitle}** ajouté à la file (position ${pos})`
      );
    } catch (e) {
      console.error("[PLAY ERROR]", e);
      await message.reply(`❌ Impossible de jouer : **${String(e?.message || e).slice(0, 180)}**`);
    }
  }
};
