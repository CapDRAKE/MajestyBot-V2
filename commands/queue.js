const { useQueue } = require("discord-player");

module.exports = {
  name: "queue",
  aliases: ["q"],
  async execute({ client, message }) {
    const queue = useQueue(message.guild.id);
    if (!queue || !queue.currentTrack) return message.reply("📭 File vide.");

    const current = queue.currentTrack;
    const next = queue.tracks.toArray().slice(0, 10);

    let txt = `🎧 **En cours:** ${current.cleanTitle}\n`;
    if (next.length) {
      txt += `\n📜 **À suivre:**\n`;
      txt += next.map((t, i) => `${i + 1}. ${t.cleanTitle}`).join("\n");
      if (queue.tracks.size > 10) txt += `\n... +${queue.tracks.size - 10}`;
    }
    await message.reply(txt);
  }
};