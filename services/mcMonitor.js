const { EmbedBuilder } = require("discord.js");
const { readJson, writeJson } = require("./storage");

const FILE = "mc_monitor.json";

function loadDb() {
  return readJson(FILE, { servers: {}, dashboard: { messageId: null } });
}

function saveDb(db) {
  writeJson(FILE, db);
}

function keyOf(server) {
  return `${server.address}:${server.port}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchStatusOnce(address, port) {
  const addr = encodeURIComponent(`${address}:${port}`);
  const url = `https://api.mcstatus.io/v2/status/java/${addr}?query=true&timeout=5`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const startedAt = Date.now();

  try {
    const res = await fetch(url, { signal: controller.signal });
    const latencyMs = Date.now() - startedAt;

    if (!res.ok) {
      return { online: false, error: `HTTP ${res.status}`, latencyMs, source: "http" };
    }

    const data = await res.json();
    return {
      online: Boolean(data.online),
      playersOnline: data?.players?.online ?? null,
      playersMax: data?.players?.max ?? null,
      version: data?.version?.name_clean || data?.version?.name || null,
      latencyMs,
      source: "mcstatus"
    };
  } catch (error) {
    return {
      online: false,
      error: String(error?.message || error),
      latencyMs: Date.now() - startedAt,
      source: "network"
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchStatus(address, port, cfg = {}) {
  const attempts = Math.max(1, cfg.requestAttempts || 3);
  const retryDelayMs = Math.max(0, cfg.requestRetryDelayMs || 1200);
  const results = [];

  for (let i = 0; i < attempts; i++) {
    const result = await fetchStatusOnce(address, port);
    results.push(result);

    if (result.online) {
      return {
        ...result,
        attemptsUsed: i + 1,
        transientFailure: i > 0,
        checks: results
      };
    }

    if (i < attempts - 1) {
      await wait(retryDelayMs);
    }
  }

  const errors = [...new Set(results.map((item) => item.error).filter(Boolean))];
  const last = results[results.length - 1] || { online: false, error: "unknown" };
  const explicitOffline = results.some((item) => item.online === false && !item.error);

  return {
    ...last,
    online: false,
    attemptsUsed: attempts,
    transientFailure: !explicitOffline,
    errors,
    checks: results
  };
}

function buildMention() {
  const roles = ["694904362438361140", "1234516986227068949"];
  return roles.map((id) => `<@&${id}>`).join(" ");
}

async function sendAlert(client, cfg, embed, mentionText) {
  const channel = await client.channels.fetch(cfg.notifyChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  await channel.send({
    content: mentionText || "",
    embeds: [embed],
    allowedMentions: { parse: ["roles"] }
  }).catch(() => {});
}

async function ensureDashboardMessage(client, cfg, db) {
  if (!cfg.dashboardChannelId) return null;

  const channel = await client.channels.fetch(cfg.dashboardChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return null;

  if (db.dashboard?.messageId) {
    const existing = await channel.messages.fetch(db.dashboard.messageId).catch(() => null);
    if (existing) return existing;

    db.dashboard.messageId = null;
    saveDb(db);
  }

  const embed = new EmbedBuilder()
    .setTitle(cfg.dashboardTitle || "Etat des serveurs")
    .setDescription("Chargement de l'etat des serveurs...")
    .setTimestamp(new Date());

  const message = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  db.dashboard = db.dashboard || {};
  db.dashboard.messageId = message.id;
  saveDb(db);
  return message;
}

function statusEmoji(status) {
  if (status === "up") return "🟢";
  if (status === "degraded") return "🟠";
  return "🔴";
}

function makeDashboardEmbed(cfg, summary, lastUpdated) {
  const lines = summary.map((item) => {
    const extraParts = [];
    if (item.playersText) extraParts.push(item.playersText);
    if (item.pingText) extraParts.push(item.pingText);
    if (item.note) extraParts.push(item.note);

    const extra = extraParts.length ? ` - ${extraParts.join(" | ")}` : "";
    return `${statusEmoji(item.status)} **${item.name}**${extra}`;
  });

  return new EmbedBuilder()
    .setTitle(cfg.dashboardTitle || "Etat des serveurs")
    .setDescription(lines.join("\n") || "Aucun serveur configure.")
    .addFields({ name: "Connexion", value: "Rejoins via **play.majestycraft.com**", inline: false })
    .setFooter({ text: "MajestyCraft | Status" })
    .setTimestamp(lastUpdated);
}

function dashboardStatusFromInfo(info, state, failThreshold, degradedLatencyMs, degradedIfNoPlayerInfo) {
  if (!info.online) {
    if (state.status === "down" || state.fails >= failThreshold) return "down";
    return "degraded";
  }

  const missingPlayers = info.playersOnline == null || info.playersMax == null;
  const highPing = typeof info.latencyMs === "number" && info.latencyMs > degradedLatencyMs;

  if (highPing || (degradedIfNoPlayerInfo && missingPlayers)) return "degraded";
  return "up";
}

function createDownEmbed(server, info) {
  const fields = [];

  if (info.error) {
    fields.push({ name: "Erreur", value: `\`${info.error}\`` });
  }

  fields.push({ name: "Essais", value: `**${info.attemptsUsed || 1}**`, inline: true });
  if (typeof info.latencyMs === "number") {
    fields.push({ name: "Dernier ping", value: `**${info.latencyMs}ms**`, inline: true });
  }

  return new EmbedBuilder()
    .setTitle("🔴 Serveur DOWN")
    .setDescription(`**${server.name}** ne repond plus apres plusieurs verifications.`)
    .addFields(fields)
    .setTimestamp(new Date());
}

function createUpEmbed(server, info) {
  const fields = [];

  if (info.version) {
    fields.push({ name: "Version", value: `\`${info.version}\``, inline: true });
  }

  if (info.playersOnline != null && info.playersMax != null) {
    fields.push({ name: "Joueurs", value: `**${info.playersOnline}/${info.playersMax}**`, inline: true });
  }

  if (typeof info.latencyMs === "number") {
    fields.push({ name: "Ping", value: `**${info.latencyMs}ms**`, inline: true });
  }

  return new EmbedBuilder()
    .setTitle("🟢 Serveur UP")
    .setDescription(`**${server.name}** est de nouveau en ligne.`)
    .addFields(fields)
    .setTimestamp(new Date());
}

async function checkOnce(client) {
  const cfg = client.config.mcMonitor;
  if (!cfg?.enabled) return;

  const db = loadDb();
  const now = Date.now();
  const mention = buildMention();
  const summary = [];

  const failThreshold = Math.max(1, cfg.failThreshold ?? 3);
  const cooldownMs = (cfg.notifyCooldownMin || 10) * 60 * 1000;
  const degradedLatencyMs = cfg.degradedLatencyMs ?? 800;
  const degradedIfNoPlayerInfo = cfg.degradedIfNoPlayerInfo ?? true;
  const servers = cfg.servers || [];
  const infos = await Promise.all(
    servers.map((server) => fetchStatus(server.address, server.port, cfg))
  );

  for (let index = 0; index < servers.length; index++) {
    const server = servers[index];
    const info = infos[index];
    const key = keyOf(server);
    const state = db.servers[key] || { status: "unknown", fails: 0, lastNotify: 0 };
    const was = state.status;

    if (!info.online) {
      state.fails = (state.fails || 0) + 1;
      if (was === "down" || state.fails >= failThreshold) {
        state.status = "down";
      }
    } else {
      state.fails = 0;
      state.status = "up";
    }

    const dashboardStatus = dashboardStatusFromInfo(
      info,
      state,
      failThreshold,
      degradedLatencyMs,
      degradedIfNoPlayerInfo
    );

    const playersText =
      info.playersOnline != null && info.playersMax != null
        ? `${info.playersOnline}/${info.playersMax} joueurs`
        : null;

    const pingText = typeof info.latencyMs === "number" ? `ping ${info.latencyMs}ms` : null;

    let note = null;
    if (!info.online && state.fails < failThreshold) {
      note = `echec ${state.fails}/${failThreshold}`;
    } else if (!info.online && info.transientFailure) {
      note = "reponse instable";
    }

    summary.push({
      name: server.name,
      status: dashboardStatus,
      playersText,
      pingText: dashboardStatus !== "up" ? pingText : null,
      note
    });

    const canNotify = (now - (state.lastNotify || 0)) >= cooldownMs;

    if (!info.online) {
      const shouldDeclareDown =
        was !== "down" &&
        state.status === "down" &&
        state.fails >= failThreshold;

      if (shouldDeclareDown && (canNotify || (was === "unknown" && cfg.notifyOnBootOffline))) {
        state.lastNotify = now;
        await sendAlert(client, cfg, createDownEmbed(server, info), mention);
      }
    } else if (was === "down") {
      state.lastNotify = now;
      await sendAlert(client, cfg, createUpEmbed(server, info), mention);
    }

    db.servers[key] = state;
  }

  if (cfg.dashboardChannelId) {
    const message = await ensureDashboardMessage(client, cfg, db);
    if (message) {
      const embed = makeDashboardEmbed(cfg, summary, new Date());
      await message.edit({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
    }
  }

  saveDb(db);
}

let interval = null;
let running = false;

function start(client) {
  const cfg = client.config.mcMonitor;
  if (!cfg?.enabled) return;

  if (interval) clearInterval(interval);

  const run = async () => {
    if (running) return;
    running = true;

    try {
      await checkOnce(client);
    } catch {}
    finally {
      running = false;
    }
  };

  run().catch(() => {});
  interval = setInterval(() => run().catch(() => {}), (cfg.intervalSec || 60) * 1000);
}

module.exports = {
  start,
  _internals: {
    fetchStatus,
    fetchStatusOnce,
    dashboardStatusFromInfo
  }
};
