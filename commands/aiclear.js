const { PermissionsBitField } = require("discord.js");
const aiMemory = require("../services/aiMemory");
const aiSupport = require("../services/aiSupport");

module.exports = {
  name: "aiclear",
  aliases: ["clearai"],
  async execute({ client, message }) {
    // Permission: Admin ou ManageGuild (à toi de choisir)
    const ok =
      message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
      message.member.permissions.has(PermissionsBitField.Flags.ManageGuild);

    if (!ok) {
      await message.reply("❌ Permission insuffisante. (Admin ou Manage Server requis)");
      return;
    }

    // Purge mémoire
    aiMemory.clearAll();

    // Purge sessions (si dispo)
    if (aiSupport?.clearSessions) aiSupport.clearSessions();

    await message.reply("✅ Mémoire IA purgée (messages + sessions).");
  }
};