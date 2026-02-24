const { readJson, writeJson } = require("./storage");

const FILE = "modlog.json";

function loadDb() {
  return readJson(FILE, { lastId: 0, events: [] });
}

function saveDb(db) {
  writeJson(FILE, db);
}

function addEvent({ guildId, action, userId, modId, reason, durationMs, extra }) {
  const db = loadDb();
  db.lastId += 1;

  db.events.push({
    id: db.lastId,
    guildId,
    action,
    userId,
    modId,
    reason: reason || "",
    durationMs: durationMs || 0,
    extra: extra || null,
    createdAt: new Date().toISOString()
  });

  if (db.events.length > 5000) db.events = db.events.slice(-5000);

  saveDb(db);
  return db.lastId;
}

function getHistory(guildId, userId, limit = 10) {
  const db = loadDb();
  return db.events
    .filter(e => e.guildId === guildId && e.userId === userId)
    .slice(-limit)
    .reverse();
}

module.exports = { addEvent, getHistory };