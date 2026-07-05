const { PermissionsBitField } = require("discord.js");
const api = require("../services/minestrator");
const { resolveServer } = require("../services/minestratorHelper");

module.exports = {
  name: "serverconsole",
  aliases: ["srvconsole", "srvcmd"],
  async execute({ client, message, args }) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Commande reservee aux admins.");
    }
    const cfg = client.config.mcMonitor;
    const apiKey = process.env.MINESTRATOR_API_KEY || (cfg && cfg.apiKey);
    const boxId = cfg && cfg.boxId;
    if (!apiKey) return message.reply("Cle API Minestrator non configuree.");
    if (args.length < 2) return message.reply("Usage: `+serverconsole <nom> <commande>`");

    await message.channel.sendTyping();
    const { found } = await resolveServer(apiKey, boxId, cfg && cfg.servers, args[0]);
    if (!found) return message.reply("Serveur introuvable. Utilise `+serverlist` pour voir les noms.");
    if (!found.id) return message.reply("Ce serveur n a pas d ID.");

    const cmd = args.slice(1).join(" ");
    try {
      await api.sendCommand(apiKey, found.id, cmd);
      await message.reply("✅ Commande envoyee a **" + found.name + "**: `" + cmd + "`");
    } catch (e) {
      await message.reply("Erreur API: " + (e.message || e).slice(0, 200));
    }
  }
};