const { useQueue } = require("discord-player");

module.exports = {
  name: "pause",
  aliases: [],
  async execute({ client, message }) {
    const queue = useQueue(message.guild.id);
    if (!queue) return message.reply("❌ Rien à pause.");
    const paused = !queue.node.isPaused();
    queue.node.setPaused(paused);
    await message.reply(paused ? "⏸️ Pause." : "▶️ Reprise.");
  }
};