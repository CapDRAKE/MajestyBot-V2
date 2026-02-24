const { useQueue } = require("discord-player");

module.exports = {
  name: "stop",
  aliases: [],
  async execute({ client, message }) {
    const queue = useQueue(message.guild.id);
    if (!queue) return message.reply("❌ Rien à stop.");
    queue.delete();
    await message.reply("⏹️ Stop + file supprimée.");
  }
};