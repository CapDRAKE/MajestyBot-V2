const { PermissionsBitField } = require("discord.js");
const voteReminder = require("../services/voteReminder");

module.exports = {
  name: "votecheck",
  aliases: ["checkvote", "vcheck"],
  async execute({ client, message }) {
    const can =
      message.member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
      message.member.permissions.has(PermissionsBitField.Flags.Administrator);

    if (!can) {
      await message.reply("❌ Permission insuffisante. (Manage Server ou Admin requis)");
      return;
    }

    await message.reply("🔎 Vérification des votes en cours…");

    try {
      await voteReminder.runCheck(client);
      await message.channel.send("✅ Votecheck terminé.");
    } catch (e) {
      console.error("[VOTECHECK ERROR]", e?.message || e);
      await message.channel.send(`❌ Erreur votecheck: ${String(e?.message || e).slice(0, 180)}`);
    }
  }
};