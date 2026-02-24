const { useQueue } = require("discord-player");

module.exports = {
  name: "leave",
  aliases: ["dc", "disconnect"],
  async execute({ client, message }) {
    const queue = useQueue(message.guild.id);
    if (queue) queue.delete();
    await message.reply("👋 Déconnecté.");
  }
};