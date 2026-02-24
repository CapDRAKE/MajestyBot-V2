const { useQueue } = require("discord-player");

module.exports = {
  name: "np",
  aliases: ["nowplaying"],
  async execute({ client, message }) {
    const queue = useQueue(message.guild.id);
    const t = queue?.currentTrack;
    if (!t) return message.reply("📭 Rien en cours.");
    await message.reply(`🎧 En cours: **${t.cleanTitle}**`);
  }
};