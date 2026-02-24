const tickets = require("../services/tickets");
const { readJson, writeJson } = require("../services/storage");
const roleMenu = require("../services/roleMenu");

const TICKET_PANEL_MARKER = "🎫 **Ticket Support**";

module.exports = {
  name: "messageReactionAdd",
  once: false,
  async execute(client, reaction, user) {
    try {
      if (user.bot) return;

      // Fetch partials
      if (reaction.partial) await reaction.fetch().catch(() => null);
      const message = reaction.message.partial
        ? await reaction.message.fetch().catch(() => null)
        : reaction.message;

      if (!message || !message.guild) return;

      // =========================
      // 1) ROLE MENU (prioritaire)
      // =========================
      if (client.config.roleMenu?.enabled) {
        const isRolePanel = await roleMenu.isRoleMenuMessage(client, message);
        if (isRolePanel) {
          const cfgRM = client.config.roleMenu;
          const emojiName = reaction.emoji?.name;

          const entry = roleMenu.getRoleByEmoji(cfgRM, emojiName);
          if (!entry) return;

          const member = await message.guild.members.fetch(user.id).catch(() => null);
          if (!member) return;

          const role = message.guild.roles.cache.get(entry.roleId);
          if (!role) return;

          await member.roles.add(role).catch(() => {});
          return; // ✅ important : on stop ici
        }
      }

      // =========================
      // 2) TICKETS
      // =========================
      const cfgT = client.config.ticket;
      if (!cfgT?.panelChannelId) return;

      // uniquement dans le salon panel tickets
      if (message.channel.id !== cfgT.panelChannelId) return;

      // uniquement les messages du bot qui sont des panels tickets
      if (message.author?.id !== client.user.id) return;
      if (!message.content?.startsWith(TICKET_PANEL_MARKER)) return;

      const wanted = cfgT.emoji || "🎫";
      if (reaction.emoji?.name !== wanted) return;

      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      // retire la réaction du user (ghost click)
      try { await reaction.users.remove(user.id); } catch {}

      // adopte ce message panel comme le bon
      const db = readJson("tickets.json", { guilds: {} });
      db.guilds[message.guild.id] ||= { panelMessageId: null, openTickets: {} };
      db.guilds[message.guild.id].panelMessageId = message.id;
      writeJson("tickets.json", db);

      const { channel, existed } = await tickets.createOrGetTicket(client, message.guild, member);

      const confirm = await message.channel.send(
        existed
          ? `ℹ️ ${member} tu as déjà un ticket ouvert : ${channel}`
          : `✅ ${member} ticket créé : ${channel}`
      );

      setTimeout(() => confirm.delete().catch(() => {}), 10_000);
    } catch (e) {
      console.error("messageReactionAdd error:", e?.message || e);
    }
  }
};