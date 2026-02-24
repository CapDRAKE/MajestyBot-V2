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
  name: "warn",
  aliases: [],
  async execute({ client, message, args }) {
    if (!hasPerm(message.member, PermissionsBitField.Flags.ModerateMembers)) {
      await message.reply("Tu n'as pas la permission **Moderate Members**.");
      return;
    }

    const target = message.mentions.members.first();
    if (!target) {
      await message.reply(`Usage: \`${client.config.prefix}warn @user [raison]\``);
      return;
    }

    const reason = args.join(" ").replace(/^<@!?(\d+)>/, "").trim() || "Aucune raison";

    modlog.addEvent({
      guildId: message.guild.id,
      action: "WARN",
      userId: target.id,
      modId: message.author.id,
      reason
    });

    await message.reply(`${target} a été warn. Raison: **${reason}**`);

    const embed = new EmbedBuilder()
      .setTitle("Un utilisateur a reçu un avertissement")
      .setDescription(`**User:** ${target}\n**Moderateur:** ${message.author}\n**Raison:** ${reason}`)
      .setTimestamp(new Date());

    await sendModLog(client, embed);
  }
};