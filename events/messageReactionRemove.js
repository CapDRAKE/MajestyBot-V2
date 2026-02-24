const roleMenu = require("../services/roleMenu");

module.exports = {
  name: "messageReactionRemove",
  once: false,
  async execute(client, reaction, user) {
    try {
      if (user.bot) return;

      if (reaction.partial) await reaction.fetch().catch(() => null);
      const msg = reaction.message.partial ? await reaction.message.fetch().catch(() => null) : reaction.message;
      if (!msg || !msg.guild) return;

      const isPanel = await roleMenu.isRoleMenuMessage(client, msg);
      if (!isPanel) return;

      const cfg = client.config.roleMenu;
      const emojiName = reaction.emoji?.name;
      const entry = roleMenu.getRoleByEmoji(cfg, emojiName);
      if (!entry) return;

      const member = await msg.guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      const role = msg.guild.roles.cache.get(entry.roleId);
      if (!role) return;

      await member.roles.remove(role).catch(() => {});
    } catch (e) {
      console.error("roleMenu reactionRemove error:", e?.message || e);
    }
  }
};