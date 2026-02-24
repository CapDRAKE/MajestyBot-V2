const { PermissionsBitField, EmbedBuilder } = require("discord.js");
const { hasPerm } = require("../utils/permissions");
const modlog = require("../services/modlog");

async function sendModLog(client, embed) {
  const id = client.config.modLogChannelId;
  if (!id) return;
  try {
    const ch = await client.channels.fetch(id);
    if (ch && ch.isTextBased()) await ch.send({ embeds: [embed] });
  } catch {}
}

module.exports = {
  name: "ban",
  aliases: [],
  async execute({ client, message, args }) {
    if (!hasPerm(message.member, PermissionsBitField.Flags.BanMembers)) {
      await message.reply("? Tu n'as pas la permission **Ban Members**.");
      return;
    }

    const targetUser = message.mentions.users.first();
    if (!targetUser) {
      await message.reply(`Usage: \`${client.config.prefix}ban @user [raison]\``);
      return;
    }

    const reason = args.join(" ").replace(/^<@!?(\d+)>/, "").trim() || "Aucune raison";

    try {
      await message.guild.members.ban(targetUser.id, { reason });

      modlog.addEvent({
        guildId: message.guild.id,
        action: "BAN",
        userId: targetUser.id,
        modId: message.author.id,
        reason
      });

      await message.reply(`?? ${targetUser} banni. Raison: **${reason}**`);

      const embed = new EmbedBuilder()
        .setTitle("Ban d'un utilisateur")
        .setDescription(`**User:** <@${targetUser.id}>\n**Modérateur:** ${message.author}\n**Raison:** ${reason}`)
        .setTimestamp(new Date());

      await sendModLog(client, embed);
    } catch {
      await message.reply("? Impossible de ban (permissions du bot / hiérarchie / rôle trop haut?).");
    }
  }
};