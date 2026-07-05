const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const api = require("../services/minestrator");
const { resolveServer } = require("../services/minestratorHelper");

module.exports = {
  name: "serverstatus",
  aliases: ["srvstatus", "srvstat"],
  async execute({ client, message, args }) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Commande reservee aux admins.");
    }
    const cfg = client.config.mcMonitor;
    const apiKey = process.env.MINESTRATOR_API_KEY || (cfg && cfg.apiKey);
    const boxId = cfg && cfg.boxId;
    if (!apiKey) return message.reply("Cle API Minestrator non configuree.");

    await message.channel.sendTyping();
    const nameArg = args.join(" ");
    const { servers, found } = await resolveServer(apiKey, boxId, cfg && cfg.servers, nameArg || null);
    const toCheck = found ? [found] : servers;
    if (!toCheck.length) return message.reply("Aucun serveur trouve.");

    const embed = new EmbedBuilder().setTitle("Status des serveurs").setColor(0x57F287).setTimestamp();
    const lines = [];
    for (const s of toCheck) {
      if (!s.id) { lines.push("⚫ **" + s.name + "** - pas d ID"); continue; }
      try {
        const live = await api.getServerLive(apiKey, s.id);
        const emoji = live.online ? "🟢" : "🔴";
        const cpu = live.cpu != null ? live.cpu.toFixed(1) + "% CPU" : "?";
        const ram = live.ram != null ? Math.round(live.ram) + "Mo RAM" : "?";
        const pl = live.players != null ? live.players + " joueurs" : "";
        lines.push(emoji + " **" + s.name + "** | " + cpu + " | " + ram + (pl ? " | " + pl : ""));
      } catch (e) {
        lines.push("❓ **" + s.name + "** - " + (e.message || "").slice(0, 60));
      }
    }
    embed.setDescription(lines.join("\n"));
    await message.channel.send({ embeds: [embed] });
  }
};