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
      if (!message.guild) return;
      if (message.author.bot) return;

      const allowed = client.config.allowedGuildIds;
      if (Array.isArray(allowed) && allowed.length && !allowed.includes(message.guild.id)) return;

      const gc = client.config.getGuildConfig(message.guild.id);

      // 1) Moderation (per-guild : skip si desactive)
      if (gc.antiInsult && gc.antiInsult.enabled !== false) {
        const insultStop = await antiInsult.handle(message);
        if (insultStop) return;
      }

      if (gc.antiSpam && gc.antiSpam.enabled !== false) {
        if (antiSpam && antiSpam.handle) {
          const stopped = await antiSpam.handle(message);
          if (stopped) return;
        }
      }

      if (gc.antiAbuse && gc.antiAbuse.enabled !== false) {
        const abuseStop = await antiAbuse.handle(message);
        if (abuseStop) return;
      }

      const handledForm = await ticketForm.handleMessage(client, message);
      if (handledForm) return;

      // 2) Apprentissage memoire (per-guild)
      const cfgAI = gc.ai;
      if (cfgAI && cfgAI.learn && cfgAI.learn.enabled && Array.isArray(cfgAI.learn.channelIds)) {
        if (cfgAI.learn.channelIds.includes(message.channel.id)) {
          const txt = (message.content || "").trim();
          const prefix = client.config.prefix || "+";
          if (txt && !txt.startsWith(prefix)) {
            aiMemory.addMessage(
              {
                guildId: message.guild.id,
                channelId: message.channel.id,
                authorId: message.author.id,
                authorName: (message.member && message.member.displayName) || message.author.username,
                content: txt,
                createdAt: new Date().toISOString()
              },
              cfgAI.learn.maxStoredMessages || 5000
            );
          }
        }
      }

      const prefix = client.config.prefix || "+";

      // 3) Commandes
      if (message.content && message.content.startsWith(prefix)) {
        const raw = message.content.slice(prefix.length).trim();
        if (!raw) return;

        const parts = raw.split(/\s+/);
        const cmdName = (parts.shift() || "").toLowerCase();
        const args = parts;

        const cmd = client.commands.get(cmdName);
        if (!cmd) {
          await message.reply("Commande inconnue. Tape `" + prefix + "help`");
          return;
        }

        if (client.player && client.player.context && client.player.context.provide) {
          await client.player.context.provide({ guild: message.guild }, function() {
            return cmd.execute({ client: client, message: message, args: args });
          });
        } else {
          await cmd.execute({ client: client, message: message, args: args });
        }
        return;
      }

      // 4) IA support
      await aiSupport.handleAI(client, message);

    } catch (e) {
      console.error("messageCreate error:", e && e.message || e);
    }
  }
};