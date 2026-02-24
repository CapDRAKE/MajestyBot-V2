const inviteTracker = require("../services/inviteTracker");
const memberCounters = require("../services/memberCounters");

module.exports = {
  name: "guildMemberAdd",
  once: false,
  async execute(client, member) {
    
    await inviteTracker.handleJoin(client, member);
    
    // 1) Ajout du rôle visiteur (sans reason = pas de log texte)
    try {
      const visitorRoleId = client.config.visitorRoleId;
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
      const ch = await member.guild.channels.fetch(client.config.welcomeChannelId);
      if (ch && ch.isTextBased()) {
        await ch.send(`👋 Bienvenue ${member} sur **${member.guild.name}** !`);
      }
    } catch (e) {
      console.error("Welcome error:", e?.message || e);
    }

    // 3) Ghost ping (ping puis suppression très rapide)
    try {
      const ghostChannelId = client.config.joinGhostPingChannelId || "845233355629002772";
      const ch = await member.guild.channels.fetch(ghostChannelId);
      if (ch && ch.isTextBased()) {
        const msg = await ch.send({
          content: `${member}`,
          allowedMentions: { users: [member.id] } // ping uniquement lui
        });

        // supprime très vite (l'utilisateur voit juste la notif)
        setTimeout(() => msg.delete().catch(() => {}), 800);
      }
    } catch (e) {
      console.error("Ghost ping error:", e?.message || e);
    }

   // 4) ✅ DM automatique bienvenue + vote
    try {
      const voteUrl = client.config.voteUrl || "https://majestycraft.com/vote";
      const joinIp = client.config.serverJoinIp || "play.majestycraft.com";

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