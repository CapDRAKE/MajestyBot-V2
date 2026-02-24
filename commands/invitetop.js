const inviteTracker = require("../services/inviteTracker");

module.exports = {
  name: "invitetop",
  aliases: ["topinv", "invitestop"],
  async execute({ client, message, args }) {
    const n = Math.min(Math.max(parseInt(args[0] || "10", 10) || 10, 3), 20);
    const top = inviteTracker.getTop(message.guild.id, n);

    if (!top.length) {
      await message.reply("📭 Aucun data d'invites pour le moment.");
      return;
    }

    const lines = top.map((r, i) =>
      `**${i + 1}.** <@${r.id}> — Actifs **${r.active}** (Invités ${r.joins} / Partis ${r.leaves})`
    );

    await message.reply(`🏆 **Classement invites (Top ${n})**\n` + lines.join("\n"));
  }
};