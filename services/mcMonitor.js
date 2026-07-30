const { EmbedBuilder } = require("discord.js");
const { readJson, writeJson } = require("./storage");
const api = require("./minestrator");

const FILE = "mc_monitor.json";
function loadDb() { return readJson(FILE, { servers: {}, dashboard: { messageId: null } }); }
function saveDb(db) { writeJson(FILE, db); }

function buildMention(cfg) {
  const parts = [];
  if (cfg.mentionEveryone) parts.push("@everyone");
  for (const r of (cfg.mentionRoleIds || [])) parts.push("<@&" + r + ">");
  return parts.join(" ");
}

async function sendAlert(client, cfg, embed, mention) {
  const ch = await client.channels.fetch(cfg.notifyChannelId).catch(() => null);
  if (!ch || !ch.isTextBased()) return;
  await ch.send({ content: mention || "", embeds: [embed], allowedMentions: { parse: ["everyone", "roles"] } }).catch(() => {});
}

async function ensureDashboard(client, cfg, db) {
  if (!cfg.dashboardChannelId) return null;
  const ch = await client.channels.fetch(cfg.dashboardChannelId).catch(() => null);
  if (!ch || !ch.isTextBased()) return null;
  if (db.dashboard && db.dashboard.messageId) {
    const existing = await ch.messages.fetch(db.dashboard.messageId).catch(() => null);
    if (existing) return existing;
    db.dashboard.messageId = null;
    saveDb(db);
  }
  const msg = await ch.send({
    embeds: [new EmbedBuilder().setTitle("MajestyCorp — Etat des services").setDescription("Chargement...").setTimestamp()],
    allowedMentions: { parse: [] }
  });
  db.dashboard = db.dashboard || {};
  db.dashboard.messageId = msg.id;
  saveDb(db);
  return msg;
}

async function checkWebsite(url) {
  const ctrl = new AbortController();
  const t = setTimeout(function() { ctrl.abort(); }, 8000);
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, method: "GET" });
    const latency = Date.now() - start;
    return { online: res.ok || res.status < 500, status: res.status, latency: latency };
  } catch (e) {
    return { online: false, latency: null };
  } finally { clearTimeout(t); }
}

function fmtLatency(ms) {
  if (ms == null) return "";
  if (ms < 400) return ms + "ms";
  if (ms < 1000) return "⚠️ " + ms + "ms";
  return "🐌 " + ms + "ms";
}

const DOWN_DELAY_MS = 5 * 60 * 1000; // 5 min avant d'alerter

async function checkAndAlert(client, cfg, db, key, name, url, online, mention, now, cooldownMs) {
  if (!db.servers[key]) db.servers[key] = { status: "unknown", lastNotify: 0 };
  const state = db.servers[key];
  const wasDown = state.status === "down";
  const canNotify = (now - (state.lastNotify || 0)) >= cooldownMs;

  if (!online) {
    if (state.status !== "down") {
      // Premier tick offline : on démarre le timer sans alerter
      if (!state.downSince) {
        state.downSince = now;
      } else if (now - state.downSince >= DOWN_DELAY_MS && canNotify) {
        // Toujours offline après 5 min → alerte
        state.status = "down";
        state.lastNotify = now;
        await sendAlert(client, cfg,
          new EmbedBuilder().setColor(0xED4245).setTitle("🔴 Service DOWN").setDescription("**" + name + "**" + (url ? " (`" + url + "`)" : "") + " est hors ligne.").setTimestamp(),
          mention);
      }
    }
    // déjà "down" et alerté : rien à faire
  } else {
    // Retour en ligne
    state.downSince = null;
    if (wasDown) {
      state.status = "up";
      state.lastNotify = now;
      await sendAlert(client, cfg,
        new EmbedBuilder().setColor(0x57F287).setTitle("🟢 Service UP").setDescription("**" + name + "**" + (url ? " (`" + url + "`)" : "") + " est de nouveau en ligne.").setTimestamp(),
        mention);
    } else {
      state.status = "up";
    }
  }

  db.servers[key] = state;
  return state.status;
}

async function checkOnce(client) {
  const cfg = client.config.mcMonitor;
  if (!cfg || !cfg.enabled) return;

  const apiKey = process.env.MINESTRATOR_API_KEY || cfg.apiKey;
  const boxId = cfg.boxId;
  const db = loadDb();
  const now = Date.now();
  const mention = buildMention(cfg);
  const cooldownMs = (cfg.notifyCooldownMin || 10) * 60 * 1000;

  // ── Serveurs MC ───────────────────────────────────────────────
  let mcServers = [];
  if (apiKey && boxId) {
    try { mcServers = await api.getBoxServers(apiKey, boxId); }
    catch (e) { console.error("[Monitor] getBoxServers:", e.message); }
  }

  const mcLines = [];
  for (const srv of mcServers) {
    let online = false; let detail = "";
    try {
      const live = await api.getServerLive(apiKey, srv.id);
      online = live.online;
      const cpu = live.cpu != null ? live.cpu.toFixed(1) + "% CPU" : null;
      const ram = live.ram != null ? Math.round(live.ram) + "Mo RAM" : null;
      const pl  = live.players != null ? live.players + " joueurs" : null;
      detail = [cpu, ram, pl].filter(Boolean).join("  •  ");
    } catch {}
    await checkAndAlert(client, cfg, db, "mc_" + srv.id, srv.name, null, online, mention, now, cooldownMs);
    const emoji = online ? "🟢" : "🔴";
    mcLines.push(emoji + " **" + srv.name + "**" + (detail ? "\n┗ `" + detail + "`" : ""));
  }

  // ── Sites web ─────────────────────────────────────────────────
  async function checkSite(name, url) {
    const r = await checkWebsite(url);
    const status = await checkAndAlert(client, cfg, db, "web_" + name, name, url, r.online, mention, now, cooldownMs);
    const emoji = r.online ? "🟢" : "🔴";
    const lat = r.latency != null ? "  `" + fmtLatency(r.latency) + "`" : "";
    return emoji + " **" + name + "**" + lat;
  }

  const corpLine   = await checkSite("majestycorp.fr", "https://majestycorp.fr");
  const craftLine  = await checkSite("majestycraft.com", "https://majestycraft.com");
  const launchLine = await checkSite("majestylauncher.com", "https://majestylauncher.com");
  const chalLine   = await checkSite("majestychallenge.fr", "https://majestychallenge.fr");
  const chalApiLine= await checkSite("api.majestychallenge.fr", "https://api.majestychallenge.fr");

  // ── Dashboard embed ───────────────────────────────────────────
  const dashMsg = await ensureDashboard(client, cfg, db);
  if (dashMsg) {
    const sep = "​";
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("📡  MajestyCorp — État des services")
      .setTimestamp()
      .setFooter({ text: "Dernière mise à jour" });

    embed.addFields(
      {
        name: "🏢  MajestyCorp",
        value: corpLine,
        inline: false
      },
      { name: sep, value: sep, inline: false },
      {
        name: "⛏️  MajestyCraft",
        value: craftLine + "\n" + (mcLines.length ? mcLines.join("\n") : "_Aucun serveur_") + "\n\n🔗 `play.majestycraft.com`",
        inline: false
      },
      { name: sep, value: sep, inline: false },
      {
        name: "🚀  MajestyLauncher",
        value: launchLine,
        inline: false
      },
      { name: sep, value: sep, inline: false },
      {
        name: "🏆  MajestyChallenge",
        value: chalLine + "\n" + chalApiLine,
        inline: false
      }
    );

    await dashMsg.edit({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
  }

  saveDb(db);
}

let interval = null;
let running = false;

function start(client) {
  const cfg = client.config.mcMonitor;
  if (!cfg || !cfg.enabled) return;
  if (interval) clearInterval(interval);
  const run = async function() {
    if (running) return;
    running = true;
    try { await checkOnce(client); } catch (e) { console.error("[Monitor]", e.message || e); }
    finally { running = false; }
  };
  run().catch(() => {});
  interval = setInterval(function() { run().catch(() => {}); }, (cfg.intervalSec || 60) * 1000);
}

module.exports = { start: start };