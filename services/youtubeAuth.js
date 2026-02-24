const fs = require("fs");
const path = require("path");

function getYouTubeCookie() {
  const p = path.join(__dirname, "..", "config", "yt_cookie.txt");
  if (!fs.existsSync(p)) return null;
  const c = fs.readFileSync(p, "utf8").trim();
  return c || null;
}

module.exports = { getYouTubeCookie };