const inviteTracker = require("../services/inviteTracker");

module.exports = {
  name: "invites",
  aliases: ["inv"],
  async execute({ client, message }) {
    const target = message.mentions.users.first() || message.author;
    const s = inviteTracker.getStats(message.guild.id, target.id);

    await message.reply(
      `📨 **Invites de ${target}**\n` +
      `• Invités: **${s.joins}**\n` +
      `• Partis: **${s.leaves}**\n` +
      `• Actifs: **${s.active}**`
    );
  }
};