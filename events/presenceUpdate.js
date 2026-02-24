const memberCounters = require("../services/memberCounters");

module.exports = {
  name: "presenceUpdate",
  once: false,
  async execute(client, oldPresence, newPresence) {
    const guild = newPresence?.guild || oldPresence?.guild;
    if (!guild) return;
    memberCounters.scheduleUpdate(client, guild.id);
  }
};