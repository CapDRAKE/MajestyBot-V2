const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(fileName, defaultValue) {
  ensureDir();
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) return defaultValue;

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return defaultValue;
  }
}

function writeJson(fileName, data) {
  ensureDir();
  const filePath = path.join(DATA_DIR, fileName);
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}

module.exports = { readJson, writeJson };