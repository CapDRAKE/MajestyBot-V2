const fs = require("fs");
const path = require("path");
const { loadUrls } = require("./siteCrawler");

function loadManualLinks() {
  const p = path.join(__dirname, "..", "config", "site_links.json");
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return [];
  }
}

function suggestLinks(text) {
  const t = String(text || "").toLowerCase();
  const manual = loadManualLinks();

  // 1) mapping manuel (prioritaire)
  const hits = [];
  for (const item of manual) {
    const keys = Array.isArray(item.keywords) ? item.keywords : [];
    if (keys.some(k => t.includes(String(k).toLowerCase()))) hits.push(item);
  }
  if (hits.length) return hits.slice(0, 4);

  // 2) sinon, on propose 2-3 URLs du sitemap (si dispo) en mode “générique”
  const { urls } = loadUrls();
  if (!urls?.length) return [];

  // exemple: si le texte parle de "vote" / "boutique" etc, on filtre
  const candidates = urls.filter(u => {
    if (t.includes("vote")) return u.toLowerCase().includes("vote");
    if (t.includes("boutique") || t.includes("shop") || t.includes("store")) return /shop|store|boutique/i.test(u);
    if (t.includes("launcher")) return u.toLowerCase().includes("launcher");
    if (t.includes("regle") || t.includes("rules")) return /regle|rules/i.test(u);
    return false;
  });

  return (candidates.length ? candidates : urls).slice(0, 3).map(u => ({
    title: "Lien MajestyCraft",
    url: u,
    keywords: []
  }));
}

module.exports = { suggestLinks };