const { PermissionsBitField } = require("discord.js");
const { readJson, writeJson } = require("./storage");

const FILE = "invite_tracker.json";

function loadDb() {
  return readJson(FILE, { guilds: {} });
}
function saveDb(db) {
  writeJson(FILE, db);
}
function gdb(db, guildId) {
  db.guilds[guildId] ||= {
    inviteUses: {},      // code -> uses
    invitedBy: {},       // memberId -> { inviterId, code, type, joinedAt }
    stats: {}            // inviterId -> { joins, leaves }
  };
  return db.guilds[guildId];
}

const cache = new Map(); // guildId -> Map(code -> uses)

async function fetchInvitesSafe(guild) {
  try {
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionsBitField.Flags.ManageGuild)) return null;
    const invites = await guild.invites.fetch();
    const map = new Map();
    invites.forEach(inv => map.set(inv.code, inv.uses ?? 0));
    return map;
  } catch {
    return null;
  }
}

async function initGuild(guild) {
  const inv = await fetchInvitesSafe(guild);
  if (inv) cache.set(guild.id, inv);

  // persist aussi pour reprise après reboot
  const db = loadDb();
  const gd = gdb(db, guild.id);
  if (inv) {
    gd.inviteUses = Object.fromEntries(inv.entries());
    saveDb(db);
  }
}

function addJoin(db, guildId, inviterId, memberId, code, type) {
  const gd = gdb(db, guildId);

  gd.stats[inviterId] ||= { joins: 0, leaves: 0 };
  gd.stats[inviterId].joins += 1;

  gd.invitedBy[memberId] = {
    inviterId,
    code: code || null,
    type,
    joinedAt: new Date().toISOString()
  };
}

function addLeave(db, guildId, memberId) {
  const gd = gdb(db, guildId);
  const info = gd.invitedBy[memberId];
  if (!info?.inviterId) return;

  gd.stats[info.inviterId] ||= { joins: 0, leaves: 0 };
  gd.stats[info.inviterId].leaves += 1;
}

async function logJoin(client, guild, member, text) {
  const chId = client.config.inviteTracker?.logChannelId || client.config.modLogChannelId;
  if (!chId) return;
  const ch = await client.channels.fetch(chId).catch(() => null);
  if (ch && ch.isTextBased()) {
    await ch.send({ content: text, allowedMentions: { parse: [] } }).catch(() => {});
  }
}

async function handleJoin(client, member) {
  const cfg = client.config.inviteTracker;
  if (!cfg?.enabled) return;

  const guild = member.guild;

  // snapshot old
  let old = cache.get(guild.id);
  if (!old) {
    // fallback depuis fichier si reboot
    const db0 = loadDb();
    const gd0 = gdb(db0, guild.id);
    old = new Map(Object.entries(gd0.inviteUses || {}).map(([c, u]) => [c, Number(u)]));
  }

  const fresh = await fetchInvitesSafe(guild);
  if (!fresh) {
    await logJoin(client, guild, member, `👤 ${member} a rejoint — **invitation inconnue** (pas d'accès invites).`);
    return;
  }

  // find used invite
  let used = null;
  for (const [code, uses] of fresh.entries()) {
    const prev = old.get(code) ?? 0;
    if (uses > prev) {
      used = { code, uses, diff: uses - prev };
      break;
    }
  }

  // update cache
  cache.set(guild.id, fresh);

  // persist uses
  const db = loadDb();
  const gd = gdb(db, guild.id);
  gd.inviteUses = Object.fromEntries(fresh.entries());

  if (used) {
    const inviteObj = await guild.invites.fetch(used.code).catch(() => null);
    const inviterId = inviteObj?.inviter?.id || "unknown";

    if (inviterId !== "unknown") {
      addJoin(db, guild.id, inviterId, member.id, used.code, "invite");
      saveDb(db);

      await logJoin(
        client,
        guild,
        member,
        `✅ ${member} a rejoint via **${inviteObj.inviter.tag}** (code \`${used.code}\`)`
      );
      return;
    }
  }

  // Vanity URL fallback
  // (si serveur a vanity, parfois l'invite utilisée n'apparaît pas)
  try {
    const v = await guild.fetchVanityData();
    if (v?.uses != null) {
      saveDb(db);
      await logJoin(client, guild, member, `✅ ${member} a rejoint via **Vanity URL** (vanity).`);
      return;
    }
  } catch {
    // ignore
  }

  saveDb(db);
  await logJoin(client, guild, member, `👤 ${member} a rejoint — **invitation inconnue**.`);
}

async function handleLeave(client, member) {
  const cfg = client.config.inviteTracker;
  if (!cfg?.enabled) return;

  const db = loadDb();
  addLeave(db, member.guild.id, member.id);
  saveDb(db);
}

function getStats(guildId, userId) {
  const db = loadDb();
  const gd = gdb(db, guildId);
  const s = gd.stats[userId] || { joins: 0, leaves: 0 };
  const active = Math.max(0, s.joins - s.leaves);
  return { joins: s.joins, leaves: s.leaves, active };
}

function getInviterOf(guildId, memberId) {
  const db = loadDb();
  const gd = gdb(db, guildId);
  return gd.invitedBy[memberId] || null;
}

function getTop(guildId, limit = 10) {
  const db = loadDb();
  const gd = gdb(db, guildId);
  const rows = Object.entries(gd.stats || {}).map(([id, s]) => ({
    id,
    joins: s.joins || 0,
    leaves: s.leaves || 0,
    active: Math.max(0, (s.joins || 0) - (s.leaves || 0))
  }));
  rows.sort((a, b) => b.active - a.active || b.joins - a.joins);
  return rows.slice(0, limit);
}

module.exports = {
  initGuild,
  handleJoin,
  handleLeave,
  getStats,
  getInviterOf,
  getTop
};