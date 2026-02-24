const { PermissionsBitField } = require("discord.js");
const { hasPerm } = require("../utils/permissions");
const modlog = require("../services/modlog");

module.exports = {
  name: "grade",
  aliases: [],
  async execute({ client, message, args }) {
    if (!hasPerm(message.member, PermissionsBitField.Flags.ManageRoles)) {
      await message.reply("? Tu n'as pas la permission **Manage Roles**.");
      return;
    }

    const sub = (args.shift() || "").toLowerCase();
    const target = message.mentions.members.first();
    if (!target) {
      await message.reply(`Usage: \`${client.config.prefix}grade add @user\` ou \`${client.config.prefix}grade remove @user\``);
      return;
    }

    const role = message.guild.roles.cache.get(client.config.gradeRoleId);
    if (!role) {
      await message.reply("? Rôle grade introuvable (vérifie l'ID dans config).");
      return;
    }

    try {
      if (sub === "add") {
        await target.roles.add(role, `Grade donné par ${message.author.tag}`);
        modlog.addEvent({ guildId: message.guild.id, action: "GRADE_ADD", userId: target.id, modId: message.author.id, reason: "Grade add" });
        await message.reply(`? Grade donné à ${target}.`);
        return;
      }

      if (sub === "remove") {
        await target.roles.remove(role, `Grade retiré par ${message.author.tag}`);
        modlog.addEvent({ guildId: message.guild.id, action: "GRADE_REMOVE", userId: target.id, modId: message.author.id, reason: "Grade remove" });
        await message.reply(`? Grade retiré à ${target}.`);
        return;
      }

      await message.reply(`Usage: \`${client.config.prefix}grade add @user\` ou \`${client.config.prefix}grade remove @user\``);
    } catch {
      await message.reply("? Impossible de modifier le rôle (hiérarchie des rôles / perms du bot).");
    }
  }
};