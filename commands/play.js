const { ChannelType } = require("discord.js");
const { useMainPlayer } = require("discord-player");

module.exports = {
  name: "play",
  aliases: ["p"],
  async execute({ client, message, args }) {
    const query = args.join(" ").trim();
    if (!query) return message.reply(`Usage: \`${client.config.prefix}play <url ou recherche>\``);

    const channel = message.member?.voice?.channel;
    if (!channel) return message.reply("❌ Tu dois être dans un salon vocal.");

    const player = useMainPlayer();

    try {
      // ✅ Si c'est un Stage, le bot peut être "suppressed" => aucun son.
      // On tentera de le mettre speaker après la connexion.
      const isStage = channel.type === ChannelType.GuildStageVoice;

      const vol = Math.round((client.config.music?.defaultVolume ?? 0.5) * 100);

	const queryRaw = args.join(" ").trim();
	const query = /^https?:\/\//i.test(queryRaw) ? queryRaw : `ytsearch:${queryRaw}`;
      const { track, queue } = await player.play(channel, query, {
        nodeOptions: {
          metadata: { channel: message.channel },
          // ✅ Désactive tous les auto-leave pendant le debug
          leaveOnEnd: false,
          leaveOnStop: false,
          leaveOnEmpty: false,

          // utile si ça galère à démarrer
          bufferingTimeout: 15_000,

          // garde volume
          volume: vol
        }
      });

      // ✅ Tentative unsuppress Stage
      if (isStage) {
        try {
          await message.guild.members.me.voice.setSuppressed(false);
        } catch (e) {
          // si pas les perms stage/modo stage, ça échoue mais on log pas dans le chat
        }
      }

      await message.reply(`🎶 Ajouté: **${track.cleanTitle}**`);
    } catch (e) {
      console.error("[PLAY ERROR]", e);
      await message.reply(`❌ Impossible de jouer: **${String(e?.message || e).slice(0, 180)}**`);
    }
  }
};