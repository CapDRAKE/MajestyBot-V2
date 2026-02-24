const { PermissionsBitField } = require("discord.js");

function has(member, perm) {
  return Boolean(member?.permissions?.has(perm));
}

module.exports = {
  name: "help",
  aliases: ["h"],
  async execute({ client, message }) {
    const p = client.config.prefix || "+";

    const lines = [];
    lines.push(`📌 **Commandes disponibles**`);
    lines.push(`Prefix: \`${p}\``);

    // --- JOUEURS
    lines.push(`**Infos**`);
    lines.push(`- \`${p}help\``);
    lines.push("");

    lines.push(`**Support**`);
    lines.push(`- Mentionne le bot pour poser une question`);
    lines.push(`- Ou écris dans le salon support`);
    lines.push("");

    lines.push(`**Serveurs**`);
    lines.push(`- Dashboard auto dans #status (serveurs 🟢🟠🔴)`);
    lines.push("");

    lines.push(`**Vote**`);
    lines.push(`- \`${p}votecheck\` *(staff uniquement, voir plus bas)*`);
    lines.push("");

    // --- Musique (si tu la réactives un jour)
    // Si tu veux l'afficher uniquement si les commandes existent :
    // (on check vite fait la présence des commandes)
    const hasMusic =
      client.commands.has("play") ||
      client.commands.has("queue") ||
      client.commands.has("np");

    if (hasMusic) {
      lines.push(`**Musique**`);
      lines.push(`- \`${p}play <lien ou recherche>\``);
      if (client.commands.has("np")) lines.push(`- \`${p}np\``);
      if (client.commands.has("queue")) lines.push(`- \`${p}queue\``);
      if (client.commands.has("pause")) lines.push(`- \`${p}pause\` / \`${p}resume\``);
      if (client.commands.has("skip")) lines.push(`- \`${p}skip\``);
      if (client.commands.has("stop")) lines.push(`- \`${p}stop\``);
      if (client.commands.has("leave")) lines.push(`- \`${p}leave\``);
      if (client.commands.has("volume")) lines.push(`- \`${p}volume 50\``);
      lines.push("");
    }

    // --- STAFF (conditionnel)
    const canManageRoles = has(message.member, PermissionsBitField.Flags.ManageRoles);
    const canModerate = has(message.member, PermissionsBitField.Flags.ModerateMembers);
    const canBan = has(message.member, PermissionsBitField.Flags.BanMembers);
    const canManageMessages = has(message.member, PermissionsBitField.Flags.ManageMessages);
    const canManageGuild = has(message.member, PermissionsBitField.Flags.ManageGuild);
    const isAdmin = has(message.member, PermissionsBitField.Flags.Administrator);

    // Modération
    if (canModerate || canBan || canManageMessages) {
      lines.push(`**Modération (Staff)**`);
      if (canModerate) {
        lines.push(`- \`${p}warn @user [raison]\``);
        lines.push(`- \`${p}mute @user 10m [raison]\` (30s, 10m, 2h, 1d)`);
        lines.push(`- \`${p}unmute @user [raison]\``);
        lines.push(`- \`${p}history @user [N]\``);
      }
      if (canBan) {
        lines.push(`- \`${p}ban @user [raison]\``);
      }
      if (canManageMessages) {
        lines.push(`- \`${p}clear 20\``);
        lines.push(`- \`${p}clear 20 @user\``);
      }
      lines.push("");
    }

    // IA admin
    if (isAdmin || canManageGuild) {
      lines.push(`**IA (Staff/Admin)**`);
      lines.push(`- \`${p}aiclear\` : purge la mémoire IA`);
      lines.push(`- \`${p}aiforget @user\` : supprime la mémoire IA d’un user`);
      lines.push("");
    }

    // Vote reminder manual check
    if (isAdmin || canManageGuild) {
      lines.push(`**Votes (Staff/Admin)**`);
      lines.push(`- \`${p}votecheck\` : lance la vérif votes maintenant`);
      lines.push("");
    }

    // Invites
    // (invites = utile à tous, mais on peut l’afficher sans restriction)
    if (client.commands.has("invites") || client.commands.has("invitetop") || client.commands.has("invitedby")) {
      lines.push(`**Invitations**`);
      if (client.commands.has("invites")) lines.push(`- \`${p}invites\` : tes stats`);
      if (client.commands.has("invites")) lines.push(`- \`${p}invites @user\``);
      if (client.commands.has("invitedby")) lines.push(`- \`${p}invitedby\` : qui t’a invité`);
      if (client.commands.has("invitedby")) lines.push(`- \`${p}invitedby @user\``);
      if (client.commands.has("invitetop")) lines.push(`- \`${p}invitetop 10\` : classement`);
      lines.push("");
    }

    // Tickets (infos, pas de commandes pour le moment)
    lines.push(`**Tickets**`);
    lines.push(`- Réagis avec 🎫 dans #ticket-support pour créer un ticket`);
    lines.push("");

    await message.channel.send(lines.join("\n"));
  }
};