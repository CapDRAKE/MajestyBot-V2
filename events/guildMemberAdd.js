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

   // 4) DM automatique bienvenue + vote (seulement si configuré)
    try {
      const voteUrl = gc.voteUrl;
      const joinIp = gc.serverJoinIp;
      if (!voteUrl || !joinIp) return;

      const dmText =
`👋 Salut ${member.user.username} !

Bienvenue sur le Discord **${member.guild.name}** 😊

⚡ **En 20 secondes :**
• Si tu as besoin d’aide (Launcher / serveur), va dans le salon support ou mentionne le bot.
• Pour rejoindre le serveur Minecraft : **${joinIp}**

⭐ **Petit coup de main :**
Pense à voter (ça aide énormément le serveur) :
${voteUrl}

Merci et bon jeu ! 🟩`;

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