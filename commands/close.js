const { PermissionsBitField, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { readJson, writeJson } = require("../services/storage");
const fs = require("fs");
const path = require("path");

function isTicketChannel(channel) {
  const topic = channel?.topic || "";
  return topic.includes("Support Ticket | Owner:");
}

function getOwnerId(channel) {
  const topic = channel?.topic || "";
  const m = topic.match(/Owner:(\d+)/);
  return m ? m[1] : null;
}

function neutralizeMentions(text) {
  return String(text || "")
    .replace(/@everyone/g, "@\u200beveryone")
    .replace(/@here/g, "@\u200bhere")
    .replace(/<@/g, "<@\u200b");
}

async function fetchAllMessages(channel, maxMessages = 2000) {
  const out = [];
  let before = undefined;

  while (out.length < maxMessages) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || batch.size === 0) break;

    out.push(...batch.values());
    before = batch.last().id;

    if (batch.size < 100) break;
  }

  // out est du plus récent au plus ancien => on inverse pour transcript chronologique
  return out.reverse();
}

async function findPinnedSummary(channel) {
  // fetchPins() => réponse paginée avec .items (pas une Collection)
  const res = await channel.messages.fetchPins().catch(() => null);
  if (!res) return null;

  const items = Array.isArray(res.items)
    ? res.items
    : (res.values ? [...res.values()] : []);

  for (const m of items) {
    const e = m.embeds?.[0];
    if (e?.title && String(e.title).includes("Résumé du ticket")) return e;
  }
  return null;
}

function buildTranscriptText({ guild, channel, owner, closedBy, reason, messages }) {
  const header =
`=== MajestyCraft Ticket Transcript ===
Guild: ${guild.name} (${guild.id})
Channel: ${channel.name} (${channel.id})
Owner: ${owner ? `${owner.tag} (${owner.id})` : "unknown"}
Closed by: ${closedBy ? `${closedBy.tag} (${closedBy.id})` : "unknown"}
Reason: ${reason || "—"}
Created: ${channel.createdAt?.toISOString?.() || "—"}
Closed: ${new Date().toISOString()}
Messages: ${messages.length}

----------------------------------------`;

  const lines = [header];

  for (const m of messages) {
    const when = m.createdAt?.toISOString?.() || "";
    const author = m.author ? `${m.author.tag} (${m.author.id})` : "unknown";
    const content = neutralizeMentions(m.content || "");

    const atts = [];
    if (m.attachments?.size) {
      for (const a of m.attachments.values()) {
        if (a?.url) atts.push(a.url);
      }
    }

    lines.push(`[${when}] ${author}`);
    if (content) lines.push(content);
    if (atts.length) lines.push(`Attachments: ${atts.join(" | ")}`);
    lines.push(""); // blank line between messages
  }

  return lines.join("\n").slice(0, 5_500_000); // sécurité (Discord limite upload, on évite de faire trop gros)
}

module.exports = {
  name: "close",
  aliases: ["ticketclose", "fermer"],
  async execute({ client, message, args }) {
    if (!message.guild) return;

    const channel = message.channel;

    // doit être un ticket
    if (!isTicketChannel(channel)) {
      await message.reply("❌ Cette commande doit être utilisée dans un salon ticket.");
      return;
    }

    const ownerId = getOwnerId(channel);
    if (!ownerId) {
      await message.reply("❌ Impossible d’identifier le propriétaire du ticket.");
      return;
    }

    const owner = await message.client.users.fetch(ownerId).catch(() => null);

    // permissions: owner OU staff
    const isOwner = message.author.id === ownerId;
    const isStaff =
      message.member.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
      message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers) ||
      message.member.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
      message.member.permissions.has(PermissionsBitField.Flags.Administrator);

    if (!isOwner && !isStaff) {
      await message.reply("❌ Seul le créateur du ticket ou le staff peut le fermer.");
      return;
    }

    const reason = args.join(" ").trim();

    // salon staff = modLogChannelId (tu l’utilises déjà pour warn/insultes)
    const staffChannelId = client.config.modLogChannelId;
    const staffCh = staffChannelId
      ? await client.channels.fetch(staffChannelId).catch(() => null)
      : null;

    if (!staffCh || !staffCh.isTextBased()) {
      await message.reply("❌ Salon staff (modLogChannelId) introuvable/configuré.");
      return;
    }

    // petite confirmation dans le ticket
    await channel.send({
      content: `🔒 Ticket en cours de fermeture par ${message.author}…`,
      allowedMentions: { parse: [] }
    }).catch(() => {});

    // récup summary épinglé (si formulaire)
    const summaryEmbed = await findPinnedSummary(channel);

    // transcript
    const messages = await fetchAllMessages(channel, 2000);
    const transcript = buildTranscriptText({
      guild: message.guild,
      channel,
      owner,
      closedBy: message.author,
      reason,
      messages
    });

    const fileName = `${channel.name}-transcript.txt`.replace(/[^a-zA-Z0-9._-]/g, "_");
    const tmpPath = path.join(process.cwd(), "data", fileName);

    // s'assure que /data existe
    fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
    fs.writeFileSync(tmpPath, transcript, "utf8");

    const file = new AttachmentBuilder(tmpPath, { name: fileName });

    // embed staff
    const emb = new EmbedBuilder()
      .setTitle("🧾 Ticket fermé")
      .setDescription(
        `**Salon :** \`${channel.name}\`\n` +
        `**Owner :** ${owner ? `<@${owner.id}>` : `\`${ownerId}\``}\n` +
        `**Fermé par :** ${message.author}\n` +
        `**Raison :** ${reason || "—"}`
      )
      .setTimestamp(new Date());

    // si on a un résumé du formulaire, on le re-copie “light” dans l’embed staff
    if (summaryEmbed?.fields?.length) {
      const wanted = ["Pseudo Minecraft", "Serveur", "Problème", "Screenshot"];
      const fields = summaryEmbed.fields
        .filter(f => wanted.includes(f.name))
        .slice(0, 4)
        .map(f => ({ name: f.name, value: String(f.value || "—").slice(0, 1024), inline: false }));

      if (fields.length) emb.addFields(fields);
    }

    await staffCh.send({
      embeds: [emb],
      files: [file],
      allowedMentions: { parse: [] }
    });

    try { fs.unlinkSync(tmpPath); } catch {}

    // nettoyage tickets.json (openTickets)
    try {
      const db = readJson("tickets.json", { guilds: {} });
      db.guilds[message.guild.id] ||= { panelMessageId: null, openTickets: {} };
      const g = db.guilds[message.guild.id];

      if (g.openTickets?.[ownerId] === channel.id) {
        delete g.openTickets[ownerId];
      }
      writeJson("tickets.json", db);
    } catch {}

    // DM owner (optionnel, utile)
    if (owner && owner.id !== message.author.id) {
      owner.send({
        content:
          `✅ Ton ticket a été fermé sur **${message.guild.name}**.\n` +
          (reason ? `Raison: **${reason}**` : ""),
        allowedMentions: { parse: [] }
      }).catch(() => {});
    }

    // delete channel
    await channel.delete(`Ticket closed by ${message.author.tag}${reason ? ` | ${reason}` : ""}`).catch(async () => {
      await message.reply("⚠️ J’ai loggé le ticket mais je n’ai pas pu supprimer le salon (permissions).");
    });
  }
};