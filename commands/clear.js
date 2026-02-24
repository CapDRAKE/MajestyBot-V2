const { PermissionsBitField } = require("discord.js");

module.exports = {
  name: "clear",
  aliases: ["purge"],
  async execute({ client, message, args }) {
    // perms user
    const canUser =
      message.member.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
      message.member.permissions.has(PermissionsBitField.Flags.Administrator);

    if (!canUser) {
      await message.reply("❌ Tu n'as pas la permission **Manage Messages**.");
      return;
    }

    // perms bot
    const me = message.guild.members.me;
    const canBot = me?.permissions?.has(PermissionsBitField.Flags.ManageMessages);
    if (!canBot) {
      await message.reply("❌ Il me manque la permission **Manage Messages**.");
      return;
    }

    // parse amount (autorise +clear 20 ou +clear @user 20 ou +clear 20 @user)
    const mentionedUser = message.mentions.users.first() || null;
    const numArg = args.find(a => /^\d+$/.test(a));
    const amount = numArg ? parseInt(numArg, 10) : NaN;

    if (!Number.isFinite(amount) || amount < 1 || amount > 100) {
      await message.reply(`Usage: \`${client.config.prefix}clear 10\` ou \`${client.config.prefix}clear 20 @user\` (1 à 100)`);
      return;
    }

    // on supprime le message de commande (comme ça amount = "vrais" messages)
    await message.delete().catch(() => {});

    let deletedCount = 0;

    if (!mentionedUser) {
      // simple: supprime les N derniers messages
      const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);
      deletedCount = deleted?.size || 0;
    } else {
      // ciblé: supprime jusqu'à N messages de cet utilisateur, en scannant l'historique
      const toDelete = [];
      let lastId = null;

      while (toDelete.length < amount) {
        const batch = await message.channel.messages.fetch({ limit: 100, before: lastId || undefined }).catch(() => null);
        if (!batch || batch.size === 0) break;

        for (const m of batch.values()) {
          if (m.author?.id === mentionedUser.id) {
            toDelete.push(m);
            if (toDelete.length >= amount) break;
          }
        }
        lastId = batch.last().id;

        // sécurité: évite de scanner trop loin
        if (toDelete.length === 0 && batch.size < 100) break;
      }

      if (toDelete.length > 0) {
        const deleted = await message.channel.bulkDelete(toDelete, true).catch(() => null);
        deletedCount = deleted?.size || 0;
      }
    }

    const info =
      mentionedUser
        ? `🧹 Supprimé **${deletedCount}** message(s) de ${mentionedUser} (les messages > 14 jours sont ignorés).`
        : `🧹 Supprimé **${deletedCount}** message(s) (les messages > 14 jours sont ignorés).`;

    const confirm = await message.channel.send({ content: info, allowedMentions: { parse: [] } }).catch(() => null);
    if (confirm) setTimeout(() => confirm.delete().catch(() => {}), 6000);
  }
};