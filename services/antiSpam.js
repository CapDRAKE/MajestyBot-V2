const { EmbedBuilder } = require("discord.js");
const { isStaff } = require("../utils/permissions");
const { msToHuman } = require("../utils/duration");
const modlog = require("./modlog");

const state = new Map(); // userId -> { times:[], lastContent, lastContentAt, sameCount, strikes:[] }

function cleanOld(arr, cutoffMs) {
  const now = Date.now();
  while (arr.length && now - arr[0] > cutoffMs) arr.shift();
}

async function sendModLog(client, guildId, embed) {
  const { modLogChannelId } = client.config;
  if (!modLogChannelId) return;
  try {
    const ch = await client.channels.fetch(modLogChannelId);
    if (ch && ch.isTextBased()) await ch.send({ embeds: [embed] });
  } catch {}
}

async function handle(message) {
  const cfg = message.client.config?.antiSpam;
  if (!cfg?.enabled) return false;
  if (!message.guild || !message.member) return false;
  if (message.author.bot) return false;
  if (isStaff(message.member)) return false;

  const uid = message.author.id;
  const now = Date.now();

  const s = state.get(uid) || {
    times: [],
    lastContent: null,
    lastContentAt: 0,
    sameCount: 0,
    strikes: []
  };

  // Flood
  s.times.push(now);
  cleanOld(s.times, cfg.floodWindowSeconds * 1000);

  let spam = s.times.length >= cfg.floodMaxMessages;

  // Repeat
  const content = (message.content || "").trim().toLowerCase();
  if (content) {
    const within = (now - s.lastContentAt) <= (cfg.repeatWindowSeconds * 1000);
    if (within && content === s.lastContent) s.sameCount += 1;
    else {
      s.sameCount = 1;
      s.lastContent = content;
      s.lastContentAt = now;
    }
    if (s.sameCount >= cfg.repeatMaxCount) spam = true;
  }

  if (!spam) {
    state.set(uid, s);
    return false;
  }

  // delete message if possible
  try { if (message.deletable) await message.delete(); } catch {}

  // strikes
  s.strikes.push(now);
  cleanOld(s.strikes, cfg.strikeWindowMinutes * 60 * 1000);

  state.set(uid, s);

  try {
    await message.channel.send(`?? ${message.author} spam détecté. Calme le rythme.`);
  } catch {}

  // auto-timeout if too many strikes
  if (s.strikes.length >= cfg.strikesToTimeout) {
    const timeoutMs = cfg.timeoutMinutes * 60 * 1000;
    try {
      await message.member.timeout(timeoutMs, "Anti-spam: trop de messages");

      modlog.addEvent({
        guildId: message.guild.id,
        action: "SPAM_TIMEOUT",
        userId: uid,
        modId: message.client.user.id,
        reason: "Anti-spam: trop de messages",
        durationMs: timeoutMs
      });

      const embed = new EmbedBuilder()
        .setTitle("Anti-spam: timeout auto")
        .setDescription(`**User:** <@${uid}>\n**Durée:** ${msToHuman(timeoutMs)}\n**Raison:** trop de messages`)
        .setTimestamp(new Date());

      await sendModLog(message.client, message.guild.id, embed);

      s.strikes = [];
      state.set(uid, s);
    } catch {}
  }

  return true;
}

module.exports = { handle };