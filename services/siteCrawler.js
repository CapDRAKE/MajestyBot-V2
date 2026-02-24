const { readJson, writeJson } = require("./storage");

const FILE = "site_urls.json";

async function crawlSitemap(baseUrl, maxUrls = 200) {
  const sitemapUrl = `${baseUrl.replace(/\/$/, "")}/sitemap.xml`;
  const res = await fetch(sitemapUrl).catch(() => null);
  if (!res || !res.ok) return null;

  const xml = await res.text();
  // extraction simple <loc>URL</loc>
  const urls = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) && urls.length < maxUrls) {
    const u = m[1].trim();
    if (u.startsWith(baseUrl)) urls.push(u);
  }
  return urls.length ? urls : null;
}

function saveUrls(urls) {
  writeJson(FILE, { urls, updatedAt: new Date().toISOString() });
}

function loadUrls() {
  return readJson(FILE, { urls: [], updatedAt: null });
}

module.exports = { crawlSitemap, saveUrls, loadUrls };