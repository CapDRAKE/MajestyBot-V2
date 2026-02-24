const path = require("path");
const { readJson, writeJson } = require("./storage");

const FILE = "ai_memory.json";

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadDb() {
  return readJson(FILE, { messages: [] });
}

function saveDb(db) {
  writeJson(FILE, db);
}

function addMessage({ guildId, channelId, authorId, authorName, content, createdAt }, maxStoredMessages) {
  const db = loadDb();
  db.messages.push({
    guildId, channelId, authorId, authorName,
    content: String(content || "").slice(0, 600),
    createdAt
  });
  if (db.messages.length > maxStoredMessages) {
    db.messages = db.messages.slice(db.messages.length - maxStoredMessages);
  }
  saveDb(db);
}

function searchSimilar(query, guildId, limit = 6) {
  const q = normalize(query);
  if (!q) return [];
  const qTokens = new Set(q.split(" ").filter(w => w.length >= 3));

  const db = loadDb();
  const scored = [];

  for (const m of db.messages) {
    if (m.guildId !== guildId) continue;
    const text = normalize(m.content);
    if (!text) continue;

    const tokens = new Set(text.split(" ").filter(w => w.length >= 3));
    let score = 0;
    for (const t of qTokens) if (tokens.has(t)) score++;

    if (score > 0) scored.push({ score, m });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(x => x.m);
}

function clearAll() {
  saveDb({ messages: [] });
}

function forgetUser(guildId, userId) {
  const db = loadDb();
  db.messages = db.messages.filter(m => !(m.guildId === guildId && m.authorId === userId));
  saveDb(db);
  return true;
}

module.exports = { addMessage, searchSimilar, clearAll, forgetUser };