const { EmbedBuilder } = require("discord.js");
const { readJson, writeJson } = require("./storage");

const FILE = "mc_monitor.json";

function loadDb() {
  return readJson(FILE, { servers: {}, dashboard: { messageId: null } });
}
function saveDb(db) {
  writeJson(FILE, db);
}
function keyOf(s) {
  return `${s.address}:${s.port}`;
}

async function fetchStatus(address, port) {
  const addr = encodeURIComponent(`${address}:${port}`);
  const url = `https://api.mcstatus.io/v2/status/java/${addr}?query=true&timeout=5`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal });
    const latencyMs = Date.now() - t0;

    if (!res.ok) return { online: false, error: `HTTP ${res.status}`, latencyMs };

    const data = await res.json();
    return {
      online: Boolean(data.online),
      playersOnline: data?.players?.online ?? null,
      playersMax: data?.players?.max ?? null,
      version: data?.version?.name_clean || data?.version?.name || null,
      latencyMs
    };
  } catch (e) {
    return { online: false, error: String(e?.message || e), latencyMs: Date.now() - t0 };
  } finally {
    clearTimeout(timeout);
  }
}

function buildMention(cfg) {
  if (cfg.mentionEveryone) return "@everyone";
  const roles = Array.isArray(cfg.mentionRoleIds) ? cfg.mentionRoleIds.filter(Boolean) : [];
  return roles.length ? roles.map(id => `<@&${id}>`).join(" ") : "";
}

async function sendAlert(client, cfg, embed, mentionText) {
  const ch = await client.channels.fetch(cfg.notifyChannelId).catch(() => null);
  if (!ch || !ch.isTextBased()) return;

  await ch.send({
    content: mentionText || "",
    embeds: [embed],
    allowedMentions: cfg.mentionEveryone ? { parse: ["everyone"] } : { parse: ["roles"] }
  }).catch(() => {});
}

// ✅ Dashboard (1 message édité)
async function ensureDashboardMessage(client, cfg, db) {
  if (!cfg.dashboardChannelId) return null;
  const ch = await client.channels.fetch(cfg.dashboardChannelId).catch(() => null);
  if (!ch || !ch.isTextBased()) return null;

  if (db.dashboard?.messageId) {
    const msg = await ch.messages.fetch(db.dashboard.messageId).catch(() => null);
    if (msg) return msg;
    db.dashboard.messageId = null;
    saveDb(db);
  }

  const embed = new EmbedBuilder()
    .setTitle(cfg.dashboardTitle || "État des serveurs")
    .setDescription("Chargement de l'état des serveurs…")
    .setTimestamp(new Date());

  const msg = await ch.send({ embeds: [embed], allowedMentions: { parse: [] } });
  db.dashboard = db.dashboard || {};
  db.dashboard.messageId = msg.id;
  saveDb(db);
  return msg;
}

function statusEmoji(status) {
  if (status === "up") return "🟢";
  if (status === "degraded") return "🟠";
  return "🔴";
}

function makeDashboardEmbed(cfg, summary, lastUpdated) {
  const lines = summary.map(s => {
    const extraParts = [];
    if (s.playersText) extraParts.push(s.playersText);
    if (s.pingText) extraParts.push(s.pingText);
    const extra = extraParts.length ? ` — ${extraParts.join(" • ")}` : "";
    return `${statusEmoji(s.status)} **${s.name}**${extra}`;
  });

  return new EmbedBuilder()
    .setTitle(cfg.dashboardTitle || "État des serveurs")
    .setDescription(lines.join("\n") || "Aucun serveur configuré.")
    .addFields({ name: "Connexion", value: "Rejoins via **play.majestycraft.com**", inline: false })
    .setFooter({ text: "MajestyCraft • Status" })
    .setTimestamp(lastUpdated);
}

async function checkOnce(client) {
  const cfg = client.config.mcMonitor;
  if (!cfg?.enabled) return;

  const db = loadDb();
  const now = Date.now();
  const mention = buildMention(cfg);

  const summary = [];
  const degradedLatencyMs = cfg.degradedLatencyMs ?? 800;
  const degradedIfNoPlayerInfo = cfg.degradedIfNoPlayerInfo ?? true;

  for (const s of cfg.servers || []) {
    const k = keyOf(s);
    const state = db.servers[k] || { status: "unknown", fails: 0, lastNotify: 0 };

    const info = await fetchStatus(s.address, s.port);

    // ------- Dashboard status (3 états)
    let dashboardStatus = "down";
    if (info.online) {
      const missingPlayers = (info.playersOnline == null || info.playersMax == null);
      const highPing = (typeof info.latencyMs === "number" && info.latencyMs > degradedLatencyMs);

      if (highPing || (degradedIfNoPlayerInfo && missingPlayers)) dashboardStatus = "degraded";
      else dashboardStatus = "up";
    }

    const playersText =
      (info.playersOnline != null && info.playersMax != null)
        ? `${info.playersOnline}/${info.playersMax} joueurs`
        : null;

    const pingText =
      typeof info.latencyMs === "number"
        ? `ping ${info.latencyMs}ms`
        : null;

    summary.push({
      name: s.name,
      status: dashboardStatus,
      playersText,
      pingText: (dashboardStatus === "degraded" ? pingText : null)
    });

    // ------- Alertes staff (UP/DOWN uniquement)
    const was = state.status;
    const cooldownMs = (cfg.notifyCooldownMin || 10) * 60 * 1000;

    if (!info.online) {
      state.fails = (state.fails || 0) + 1;

      const shouldDeclareDown =
        (was === "up" || was === "unknown") &&
        state.fails >= (cfg.failThreshold || 2);

      const canNotify = (now - (state.lastNotify || 0)) >= cooldownMs;

      if (shouldDeclareDown && (canNotify || (was === "unknown" && cfg.notifyOnBootOffline))) {
        state.status = "down";
        state.lastNotify = now;

        const embed = new EmbedBuilder()
          .setTitle("🔴 Serveur DOWN")
          .setDescription(`**${s.name}** ne répond plus.`)
          .addFields(info.error ? [{ name: "Erreur", value: `\`${info.error}\`` }] : [])
          .setTimestamp(new Date());

        await sendAlert(client, cfg, embed, mention);
      }
    } else {
      state.fails = 0;

      if (was === "down") {
        state.status = "up";
        state.lastNotify = now;

        const embed = new EmbedBuilder()
          .setTitle("🟢 Serveur UP")
          .setDescription(`**${s.name}** est de nouveau en ligne.`)
          .addFields(
            info.version ? { name: "Version", value: `\`${info.version}\``, inline: true } : null,
            (info.playersOnline != null && info.playersMax != null)
              ? { name: "Joueurs", value: `**${info.playersOnline}/${info.playersMax}**`, inline: true }
              : null
          )
          .setTimestamp(new Date());

        embed.data.fields = (embed.data.fields || []).filter(Boolean);
        await sendAlert(client, cfg, embed, mention);
      } else if (was === "unknown") {
        state.status = "up";
      }
    }

    db.servers[k] = state;
  }

  // ✅ Update dashboard (1 message)
  if (cfg.dashboardChannelId) {
    const msg = await ensureDashboardMessage(client, cfg, db);
    if (msg) {
      const embed = makeDashboardEmbed(cfg, summary, new Date());
      await msg.edit({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
    }
  }

  saveDb(db);
}

let interval = null;

function start(client) {
  const cfg = client.config.mcMonitor;
  if (!cfg?.enabled) return;

  if (interval) clearInterval(interval);

  checkOnce(client).catch(() => {});
  interval = setInterval(() => checkOnce(client).catch(() => {}), (cfg.intervalSec || 60) * 1000);
}

module.exports = { start };