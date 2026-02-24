const inviteTracker = require("../services/inviteTracker");

module.exports = {
  name: "invitedby",
  aliases: ["whoinvited"],
  async execute({ client, message }) {
    const target = message.mentions.users.first() || message.author;
    const info = inviteTracker.getInviterOf(message.guild.id, target.id);

    if (!info) {
      await message.reply(`ℹ️ Pas d'info d'invitation pour ${target} (peut-être avant l'activation du tracker).`);
      return;
    }

    if (info.type === "vanity") {
      await message.reply(`ℹ️ ${target} est arrivé via **Vanity URL**.`);
      return;
    }

    await message.reply(`ℹ️ ${target} a été invité par <@${info.inviterId}> (code: \`${info.code || "?"}\`).`);
  }
};