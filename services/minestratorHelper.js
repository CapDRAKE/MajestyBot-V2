const api = require("./minestrator");

async function resolveServer(apiKey, boxId, cfgServers, nameArg) {
  let servers = [];
  if (apiKey && boxId) {
    try { servers = await api.getBoxServers(apiKey, boxId); } catch {}
  }
  if (!servers.length) servers = cfgServers || [];

  if (!nameArg) return { servers: servers, found: null };
  const n = nameArg.toLowerCase();
  const found = servers.find(function(s) { return s.name.toLowerCase().includes(n); });
  return { servers: servers, found: found || null };
}

module.exports = { resolveServer: resolveServer };