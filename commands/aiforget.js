const { PermissionsBitField } = require("discord.js");
const aiMemory = require("../services/aiMemory");
const aiSupport = require("../services/aiSupport");

module.exports = {
  name: "aiforget",
  aliases: ["forgetai"],
  async execute({ client, message, args }) {
    const ok =
      message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
      message.member.permissions.has(PermissionsBitField.Flags.ManageGuild);

    if (!ok) {
      await message.reply("❌ Permission insuffisante. (Admin ou Manage Server requis)");
      return;
    }

    const user = message.mentions.users.first();
    if (!user) {
      await message.reply(`Usage: \`${client.config.prefix}aiforget @user\``);
      return;
    }

    aiMemory.forgetUser(message.guild.id, user.id);

    // Optionnel: purge sessions (pour éviter qu'il continue à “se souvenir” 3 min)
    if (aiSupport?.clearSessions) aiSupport.clearSessions();

    await message.reply(`✅ Mémoire IA supprimée pour ${user}.`);
  }
};