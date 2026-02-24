const fs = require("fs");
const path = require("path");

function loadCommands() {
  const commands = new Map();
  const commandsPath = path.join(__dirname, "..", "commands");
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

  for (const file of files) {
    const cmd = require(path.join(commandsPath, file));
    if (!cmd?.name || typeof cmd.execute !== "function") continue;

    commands.set(cmd.name, cmd);
    if (Array.isArray(cmd.aliases)) {
      for (const a of cmd.aliases) commands.set(a, cmd);
    }
  }

  console.log(`✅ Loaded ${new Set([...commands.values()]).size} command modules`);
  return commands;
}

module.exports = { loadCommands };