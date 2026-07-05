const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const { resolveServer } = require("../services/minestratorHelper");

module.exports = {
  name: "serverlist",
  aliases: ["srvlist"],
  async execute({ client, message }) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Commande reservee aux admins.");
    }
    const cfg = client.config.mcMonitor;
    const apiKey = process.env.MINESTRATOR_API_KEY || (cfg && cfg.apiKey);
    const boxId = cfg && cfg.boxId;
    if (!apiKey) return message.reply("Cle API non configuree.");
    if (!boxId) return message.reply("boxId non configure dans config.mcMonitor.boxId");

    await message.channel.sendTyping();
    const { servers } = await resolveServer(apiKey, boxId, [], null);
    if (!servers.length) return message.reply("Aucun serveur trouve dans la box " + boxId + ".");

    const embed = new EmbedBuilder().setTitle("Serveurs — Box " + boxId).setColor(0x5865F2);
    const lines = servers.map(function(s) {
      const emoji = (s.status === "running" || s.status === "up") ? "🟢" : "🔴";
      return emoji + " **" + s.name + "** — ID: `" + s.id + "` — " + s.status;
    });
    embed.setDescription(lines.join("\n"));
    await message.channel.send({ embeds: [embed] });
  }
};