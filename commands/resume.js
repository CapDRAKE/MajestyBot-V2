const { useQueue } = require("discord-player");

module.exports = {
  name: "resume",
  aliases: ["r"],
  async execute({ client, message }) {
    const queue = useQueue(message.guild.id);
    if (!queue) return message.reply("❌ Rien à reprendre.");
    queue.node.setPaused(false);
    await message.reply("▶️ Reprise.");
  }
};