const BASE = "https://mine.sttr.io";

function getHeaders(apiKey) {
  return { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" };
}

async function apiCall(apiKey, method, path, body) {
  const opts = { method: method, headers: getHeaders(apiKey) };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  if (!res.ok) throw new Error("Minestrator " + res.status + ": " + text.slice(0, 200));
  try { return JSON.parse(text); } catch { return text; }
}

async function getBoxServers(apiKey, boxId) {
  const raw = await apiCall(apiKey, "GET", "/mybox/" + boxId);
  // La reponse peut etre { servers: [...] } ou { api: { data: { servers: [...] } } }
  let list = [];
  if (Array.isArray(raw && raw.servers)) list = raw.servers;
  else if (raw && raw.api && raw.api.data && Array.isArray(raw.api.data.servers)) list = raw.api.data.servers;

  return list.map(function(s) {
    const isActive = !s.disabled && !s.is_expired && !s.is_suspended;
    return {
      id:     String(s.id || ""),
      name:   s.name || "?",
      status: isActive ? "active" : "inactive",
      cpu:    s.cpu  || null,
      ram:    s.ram  || null
    };
  });
}

async function getServerLive(apiKey, serverId) {
  const raw = await apiCall(apiKey, "GET", "/server/" + serverId + "/live");
  // Structure : raw.api.data.state + raw.api.data.stats
  const d = (raw && raw.api && raw.api.data) || raw || {};
  const stats = d.stats || {};
  const cpu    = stats.cpu    || {};
  const memory = stats.memory || {};
  const players = stats.players || {};

  return {
    online:  d.state === "online",
    cpu:     cpu.percent     != null ? cpu.percent     : null,
    ram:     memory.current  != null ? memory.current  : null,
    ramPct:  memory.percent  != null ? memory.percent  : null,
    players: players.current != null ? players.current : null
  };
}

async function powerAction(apiKey, serverId, action) {
  return apiCall(apiKey, "PUT", "/server/" + serverId + "/poweraction", { poweraction: action });
}

async function sendCommand(apiKey, serverId, command) {
  return apiCall(apiKey, "PUT", "/server/" + serverId + "/command", { command: command });
}

async function getConsoleLogs(apiKey, serverId) {
  return apiCall(apiKey, "GET", "/server/" + serverId + "/console/logs");
}

module.exports = {
  _raw: apiCall,
  getBoxServers: getBoxServers,
  getServerLive: getServerLive,
  powerAction: powerAction,
  sendCommand: sendCommand,
  getConsoleLogs: getConsoleLogs
};