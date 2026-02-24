const antiSpam = require("../services/antiSpam");
const antiInsult = require("../services/antiInsult");
const aiMemory = require("../services/aiMemory");
const aiSupport = require("../services/aiSupport");
const antiAbuse = require("../services/antiAbuse");
const ticketForm = require("../services/ticketForm");

module.exports = {
  name: "messageCreate",
  once: false,
  async execute(client, message) {
    try {
      const allowed = client.config.allowedGuildIds;
      if (Array.isArray(allowed) && allowed.length && !allowed.includes(message.guild.id)) return;

      if (!message.guild) return;
      if (message.author.bot) return;

      // 1) Anti-insulte d'abord
      const insultStop = await antiInsult.handle(message);
      if (insultStop) return;

      // 2) Anti-spam ensuite
      if (antiSpam?.handle) {
        const stopped = await antiSpam.handle(message);
        if (stopped) return;
      }

      const abuseStop = await antiAbuse.handle(message);
      if (abuseStop) return;

      const handledForm = await ticketForm.handleMessage(client, message);
      if (handledForm) return;

      // 3) Apprentissage (mémoire) sur salons choisis
      const cfgAI = client.config.ai;
      if (cfgAI?.learn?.enabled && Array.isArray(cfgAI.learn.channelIds)) {
        if (cfgAI.learn.channelIds.includes(message.channel.id)) {
          const txt = (message.content || "").trim();
          const prefix = client.config.prefix || "+";
          // on évite de stocker les commandes
          if (txt && !txt.startsWith(prefix)) {
            aiMemory.addMessage(
              {
                guildId: message.guild.id,
                channelId: message.channel.id,
                authorId: message.author.id,
                authorName: message.member?.displayName || message.author.username,
                content: txt,
                createdAt: new Date().toISOString()
              },
              cfgAI.learn.maxStoredMessages || 5000
            );
          }
        }
      }

      const prefix = client.config.prefix || "+";

      // 4) Si c'est une commande => on exécute, puis on s'arrête
      if (message.content.startsWith(prefix)) {
        const raw = message.content.slice(prefix.length).trim();
        if (!raw) return;

        const parts = raw.split(/\s+/);
        const cmdName = (parts.shift() || "").toLowerCase();
        const args = parts;

        const cmd = client.commands.get(cmdName);
        if (!cmd) {
          await message.reply(`Commande inconnue. Tape \`${prefix}help\``);
          return;
        }

        // discord-player context si présent
        if (client.player?.context?.provide) {
          await client.player.context.provide({ guild: message.guild }, () =>
            cmd.execute({ client, message, args })
          );
        } else {
          await cmd.execute({ client, message, args });
        }
        return; // ✅ on ne lance pas l'IA sur une commande
      }

      // 5) Sinon : IA support (mention ou salon support)
      const handledByAI = await aiSupport.handleAI(client, message);
      if (handledByAI) return;

    } catch (e) {
      console.error("messageCreate error:", e?.message || e);
    }
  }
};