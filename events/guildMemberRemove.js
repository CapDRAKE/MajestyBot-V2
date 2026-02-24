const inviteTracker = require("../services/inviteTracker");
const memberCounters = require("../services/memberCounters");

module.exports = {
  name: "guildMemberRemove",
  once: false,
  async execute(client, member) {
    await inviteTracker.handleLeave(client, member);
    memberCounters.scheduleUpdate(client, member.guild.id);
  }
};