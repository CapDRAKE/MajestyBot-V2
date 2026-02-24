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
  name: "unmute",
  aliases: ["untimeout"],
  async execute({ client, message, args }) {
    if (!hasPerm(message.member, PermissionsBitField.Flags.ModerateMembers)) {
      await message.reply("? Tu n'as pas la permission **Moderate Members**.");
      return;
    }

    const target = message.mentions.members.first();
    if (!target) {
      await message.reply(`Usage: \`${client.config.prefix}unmute @user [raison]\``);
      return;
    }

    const reason = args.join(" ").replace(/^<@!?(\d+)>/, "").trim() || "Aucune raison";

    try {
      await target.timeout(null, reason);

      modlog.addEvent({
        guildId: message.guild.id,
        action: "UNMUTE",
        userId: target.id,
        modId: message.author.id,
        reason
      });

      await message.reply(`?? ${target} unmute. Raison: **${reason}**`);

      const embed = new EmbedBuilder()
        .setTitle("Unmute d'un utilisateur")
        .setDescription(`**User:** ${target}\n**Modérateur:** ${message.author}\n**Raison:** ${reason}`)
        .setTimestamp(new Date());

      await sendModLog(client, embed);
    } catch {
      await message.reply("? Impossible de unmute (permissions du bot?).");
    }
  }
};