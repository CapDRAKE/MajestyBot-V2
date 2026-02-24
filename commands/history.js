const modlog = require("../services/modlog");
const { msToHuman } = require("../utils/duration");

module.exports = {
  name: "history",
  aliases: ["hist"],
  async execute({ client, message, args }) {
    const target = message.mentions.users.first();
    const nArg = args.find(a => /^\d+$/.test(a));
    const limit = Math.min(Math.max(nArg ? Number(nArg) : 10, 1), 25);

    if (!target) {
      await message.reply(`Usage: \`${client.config.prefix}history @user [N]\``);
      return;
    }

    const events = modlog.getHistory(message.guild.id, target.id, limit);
    if (!events.length) {
      await message.reply(`?? Aucun historique trouvé pour ${target}.`);
      return;
    }

    const lines = events.map(e => {
      const when = e.createdAt.replace("T", " ").replace("Z", " UTC");
      const dur = e.durationMs ? ` (${msToHuman(e.durationMs)})` : "";
      const reason = e.reason ? ` — ${e.reason}` : "";
      return `#${e.id} • **${e.action}**${dur} • <@${e.modId}> • ${when}${reason}`;
    });

    const header = `?? **Historique ${target} (dernier ${events.length})**\n`;

    // chunk safe
    let buf = header;
    for (const line of lines) {
      if ((buf + line + "\n").length > 1800) {
        await message.channel.send(buf);
        buf = "";
      }
      buf += line + "\n";
    }
    if (buf.trim()) await message.channel.send(buf);
  }
};