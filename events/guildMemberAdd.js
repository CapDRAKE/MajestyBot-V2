const inviteTracker = require("../services/inviteTracker");
const memberCounters = require("../services/memberCounters");

module.exports = {
  name: "guildMemberAdd",
  once: false,
  async execute(client, member) {
    const gc = client.config.getGuildConfig(member.guild.id);

    await inviteTracker.handleJoin(client, member);

    // 1) Ajout du rôle visiteur
    try {
      const visitorRoleId = gc.visitorRoleId;
      if (visitorRoleId) {
        const role = member.guild.roles.cache.get(visitorRoleId);
        if (role) {
          await member.roles.add(role);
        }
      }
    } catch (e) {
      console.error("Visitor role add error:", e?.message || e);
    }

    // 2) Message de bienvenue
    try {
      if (gc.welcomeChannelId) {
        const ch = await member.guild.channels.fetch(gc.welcomeChannelId);
        if (ch && ch.isTextBased()) {
          const msg = gc.welcomeMessage
            ? gc.welcomeMessage.replace("{user}", `${member}`).replace("{guild}", member.guild.name)
            : `👋 Bienvenue ${member} sur **${member.guild.name}** !`;
          await ch.send(msg);
        }
      }
    } catch (e) {
      console.error("Welcome error:", e?.message || e);
    }

    // 3) Ghost ping (ping puis suppression très rapide)
    try {
      const ghostChannelId = gc.joinGhostPingChannelId;
      if (ghostChannelId) {
        const ch = await member.guild.channels.fetch(ghostChannelId);
        if (ch && ch.isTextBased()) {
          const msg = await ch.send({
            content: `${member}`,
            allowedMentions: { users: [member.id] }
          });
          setTimeout(() => msg.delete().catch(() => {}), 800);
        }
      }
    } catch (e) {
      console.error("Ghost ping error:", e?.message || e);
    }

   // 4) DM automatique bienvenue
    try {
      const dmText =
`👋 Salut **${member.user.username}** !

Bienvenue sur le Discord **MajestyCorp** — la structure qui regroupe nos trois projets.

**⛏️ MajestyCraft**
Serveur Minecraft multi-modes : Survie, Créatif, PVP Box, MajestySky.
→ majestycraft.com

**🚀 MajestyLauncher**
Launcher Minecraft : toutes les versions, Forge, OptiFine, mises à jour auto.
→ majestylauncher.com

**🏆 MajestyChallenge**
Défis, événements et classements pour ceux qui veulent se dépasser.
→ majestychallenge.fr

——

🔔 **Pense à choisir tes rôles** dans le salon dédié pour recevoir uniquement les annonces qui t’intéressent.

À tout de suite !`;

      await member.send({
        content: dmText,
        allowedMentions: { parse: [] }
      });
    } catch (e) {
      console.log("DM failed for", member.user.tag, e?.message || e);
    }
    memberCounters.scheduleUpdate(client, member.guild.id);
  }
};