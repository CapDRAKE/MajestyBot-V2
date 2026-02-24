const { useQueue } = require("discord-player");

module.exports = {
  name: "volume",
  aliases: ["vol"],
  async execute({ client, message, args }) {
    const queue = useQueue(message.guild.id);
    if (!queue) return message.reply("❌ Rien en cours.");

    const n = Number(args[0]);
    if (Number.isNaN(n)) return message.reply(`Usage: \`${client.config.prefix}volume 50\` (0-200)`);

    const v = Math.max(0, Math.min(200, n));
    queue.node.setVolume(v);
    await message.reply(`🔊 Volume: **${v}**`);
  }
};