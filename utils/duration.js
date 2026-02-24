function parseDuration(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d+)(s|m|h|d)$/i);
  if (!m) return null;

  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult = unit === "s" ? 1000 : unit === "m" ? 60000 : unit === "h" ? 3600000 : 86400000;
  return n * mult;
}

function msToHuman(ms) {
  if (!ms || ms <= 0) return "0s";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

module.exports = { parseDuration, msToHuman };