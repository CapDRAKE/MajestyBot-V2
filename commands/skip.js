const { useQueue } = require("discord-player");

module.exports = {
  name: "skip",
  aliases: ["s"],
  async execute({ client, message }) {
    const queue = useQueue(message.guild.id);
    if (!queue) return message.reply("❌ Rien à skip.");
    await queue.node.skip();
    await message.reply("⏭️ Skip.");
  }
};