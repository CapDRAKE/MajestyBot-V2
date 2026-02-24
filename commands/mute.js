const { PermissionsBitField, EmbedBuilder } = require("discord.js");
const { hasPerm } = require("../utils/permissions");
const { parseDuration, msToHuman } = require("../utils/duration");
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
  name: "mute",
  aliases: ["timeout"],
  async execute({ client, message, args }) {
    if (!hasPerm(message.member, PermissionsBitField.Flags.ModerateMembers)) {
      await message.reply("? Tu n'as pas la permission **Moderate Members**.");
      return;
    }

    const target = message.mentions.members.first();
    if (!target) {
      await message.reply(`Usage: \`${client.config.prefix}mute @user 10m [raison]\``);
      return;
    }

    const durStr = args.find(a => /^[0-9]+[smhd]$/i.test(a));
    const durationMs = parseDuration(durStr);
    if (!durationMs) {
      await message.reply(`? Durée invalide. Exemple: \`${client.config.prefix}mute @user 10m spam\``);
      return;
    }

    const reason = args.join(" ")
      .replace(/^<@!?(\d+)>/, "")
      .replace(durStr, "")
      .trim() || "Aucune raison";

    try {
      await target.timeout(durationMs, reason);

      modlog.addEvent({
        guildId: message.guild.id,
        action: "MUTE",
        userId: target.id,
        modId: message.author.id,
        reason,
        durationMs
      });

      await message.reply(`?? ${target} mute **${msToHuman(durationMs)}**. Raison: **${reason}**`);

      const embed = new EmbedBuilder()
        .setTitle("Mute (timeout) d'un utilisateur")
        .setDescription(`**User:** ${target}\n**Modérateur:** ${message.author}\n**Durée:** ${msToHuman(durationMs)}\n**Raison:** ${reason}`)
        .setTimestamp(new Date());

      await sendModLog(client, embed);
    } catch {
      await message.reply("? Impossible de mute (permissions du bot / hiérarchie).");
    }
  }
};