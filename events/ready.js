const tickets = require("../services/tickets");
const mcMonitor = require("../services/mcMonitor");
const voteReminder = require("../services/voteReminder");
const inviteTracker = require("../services/inviteTracker");
const memberCounters = require("../services/memberCounters");
const roleMenu = require("../services/roleMenu");

module.exports = {
  name: "clientReady",
  once: true,
  async execute(client) {

    const allowed = new Set(client.config.allowedGuildIds || []);
    for (const [id, g] of client.guilds.cache) {
      if (allowed.size && !allowed.has(id)) {
        console.log(`⚠️ Leaving unauthorized guild: ${g.name} (${id})`);
        await g.leave().catch(() => {});
      }
    }

    console.log(`✅ Guilds: ${client.guilds.cache.size}`);
    console.log(
      "Servers:",
      client.guilds.cache.map(g => `${g.name} (${g.id})`).join(" | ")
    );

    client.user.setPresence({
      activities: [{ name: "MajestyCraft", type: 0 }],
      status: "online"
    });

    try {
      // 1) ticket panel (si tu l'utilises)
      for (const guild of client.guilds.cache.values()) {
        await tickets.ensureTicketPanel(client, guild);
      }
    } catch (e) {
      console.error("Ticket panel init error:", e?.message || e);
    }

    try {
      // 2) monitor serveurs MC
      mcMonitor.start(client);
      console.log("✅ MC monitor started");
    } catch (e) {
      console.error("MC monitor init error:", e?.message || e);
    }

    voteReminder.start(client);
    console.log("✅ Vote reminder started");

    for (const guild of client.guilds.cache.values()) {
      await inviteTracker.initGuild(guild);
    }
    console.log("✅ Invite tracker ready");

    memberCounters.start(client);
    console.log("✅ Member counters started");

    for (const guild of client.guilds.cache.values()) {
      await roleMenu.ensureRoleMenu(client, guild);
    }
    console.log("✅ Role menu ready");
  }
};