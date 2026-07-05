const { PermissionsBitField } = require("discord.js");
const api = require("../services/minestrator");
const { resolveServer } = require("../services/minestratorHelper");

module.exports = {
  name: "serverstart",
  srvstartes: ["srvstart"],
  async execute({ client, message, args }) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Commande reservee aux admins.");
    }
    const cfg = client.config.mcMonitor;
    const apiKey = process.env.MINESTRATOR_API_KEY || (cfg && cfg.apiKey);
    const boxId = cfg && cfg.boxId;
    if (!apiKey) return message.reply("Cle API Minestrator non configuree.");
    if (!args.length) return message.reply("Precise le nom du serveur. Ex: `+serverstart Survie`");

    await message.channel.sendTyping();
    const { found } = await resolveServer(apiKey, boxId, cfg && cfg.servers, args.join(" "));
    if (!found) return message.reply("Serveur introuvable. Utilise `+serverlist` pour voir les noms.");
    if (!found.id) return message.reply("Ce serveur n a pas d ID.");

    try {
      await api.start(apiKey, found.id, "start");
      await message.reply("▶️ **Demarrage** de **" + found.name + "** envoye.");
    } catch (e) {
      await message.reply("Erreur API: " + (e.message || e).slice(0, 200));
    }
  }
};