const { ChannelType, PermissionsBitField } = require("discord.js");
const { readJson, writeJson } = require("./storage");
const ticketForm = require("./ticketForm");

const FILE = "tickets.json";
const PANEL_MARKER = "🎫 **Ticket Support**";

// évite les doubles créations si ready est déclenché 2x / race condition
const panelInitLocks = new Map(); // guildId -> Promise

function loadDb() {
  return readJson(FILE, { guilds: {} });
}
function saveDb(db) {
  writeJson(FILE, db);
}
function getGuildDb(db, guildId) {
  if (!db.guilds[guildId]) {
    db.guilds[guildId] = { panelMessageId: null, openTickets: {} };
  }
  return db.guilds[guildId];
}

function sanitizeName(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || "user";
}

function ticketChannelName(member) {
  const base = sanitizeName(member.displayName || member.user.username);
  return `🎫╠-𝑻𝒊𝒄𝒌𝒆𝒕-𝒅𝒆-${base}`.slice(0, 95);
}

function buildPanelText(emoji) {
  return (
`${PANEL_MARKER}
Pour ouvrir un ticket, réagis avec ${emoji} sur ce message.

✅ Un salon privé sera créé pour toi.
👮 Le staff sera automatiquement prévenu.
🧹 Ta réaction sera retirée une fois le ticket créé.`
  );
}

async function findExistingPanelMessage(channel, botUserId) {
  // Cherche un message du bot récent qui contient le marker
  const msgs = await channel.messages.fetch({ limit: 30 }).catch(() => null);
  if (!msgs) return null;

  const candidates = [...msgs.values()].filter(m =>
    m.author?.id === botUserId &&
    typeof m.content === "string" &&
    m.content.startsWith(PANEL_MARKER)
  );

  // On prend le plus récent
  return candidates.length ? candidates[0] : null;
}

async function ensureTicketPanel(client, guild) {
  const cfg = client.config.ticket;
  if (!cfg?.panelChannelId) return;

  // lock anti double-run
  if (panelInitLocks.has(guild.id)) {
    await panelInitLocks.get(guild.id);
    return;
  }

  const job = (async () => {
    const db = loadDb();
    const gdb = getGuildDb(db, guild.id);

    const channel = await client.channels.fetch(cfg.panelChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const wantedEmoji = cfg.emoji || "🎫";

    // 1) Si on a un ID stocké, on tente de fetch
    if (gdb.panelMessageId) {
      const msg = await channel.messages.fetch(gdb.panelMessageId).catch(() => null);
      if (msg) {
        try { await msg.react(wantedEmoji); } catch {}
        return;
      }
      // le message stocké a été supprimé → on va adopter un existant
      gdb.panelMessageId = null;
      saveDb(db);
    }

    // 2) Si pas d'ID ou supprimé : on cherche un panneau existant du bot
    const existing = await findExistingPanelMessage(channel, client.user.id);
    if (existing) {
      gdb.panelMessageId = existing.id;
      saveDb(db);
      try { await existing.react(wantedEmoji); } catch {}
      return;
    }

    // 3) Sinon on crée
    const panelMsg = await channel.send(buildPanelText(wantedEmoji));
    try { await panelMsg.react(wantedEmoji); } catch {}

    gdb.panelMessageId = panelMsg.id;
    saveDb(db);
  })();

  panelInitLocks.set(guild.id, job);
  try {
    await job;
  } finally {
    panelInitLocks.delete(guild.id);
  }
}

async function createOrGetTicket(client, guild, member) {
  const cfg = client.config.ticket;
  const db = loadDb();
  const gdb = getGuildDb(db, guild.id);

  // déjà ouvert ?
  const existingId = gdb.openTickets[member.id];
  if (existingId) {
    const existing = guild.channels.cache.get(existingId) || await guild.channels.fetch(existingId).catch(() => null);
    if (existing) return { channel: existing, existed: true };
    delete gdb.openTickets[member.id];
    saveDb(db);
  }

  // On récupère le channel panel pour parent + position
  const panelCh = await client.channels.fetch(cfg.panelChannelId).catch(() => null);

  // Catégorie où créer les tickets
  const parentId = cfg.categoryId || panelCh?.parentId || null;

  // ✅ Position: juste en dessous du panel (si même catégorie)
  let position = undefined;
  if (panelCh && panelCh.parentId === parentId) {
    // rawPosition existe sur les guild channels
    position = (typeof panelCh.rawPosition === "number" ? panelCh.rawPosition : panelCh.position) + 1;
  }

  const staffRoleIds = Array.isArray(cfg.staffRoleIds) ? cfg.staffRoleIds.filter(Boolean) : [];

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: member.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
        PermissionsBitField.Flags.EmbedLinks
      ]
    },
    {
      id: client.user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ManageChannels,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageMessages
      ]
    }
  ];

  for (const rid of staffRoleIds) {
    overwrites.push({
      id: rid,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageMessages
      ]
    });
  }

  const ch = await guild.channels.create({
    name: ticketChannelName(member),
    type: ChannelType.GuildText,
    parent: parentId || undefined,
    position,
    topic: `Support Ticket | Owner:${member.id}`,
    permissionOverwrites: overwrites
  });

  gdb.openTickets[member.id] = ch.id;
  saveDb(db);

  const staffPing = staffRoleIds.length
    ? staffRoleIds.map(id => `<@&${id}>`).join(" ")
    : "";

  await ch.send(
    `✅ Ticket créé pour ${member}.\n` +
    (staffPing ? `🔔 ${staffPing}` : "⚠️ (Aucun rôle staff configuré dans config.ticket.staffRoleIds)") +
    `\n\nExplique ton problème ici et le staff te répondra.`
  );
  // ✅ démarre le formulaire uniquement si c'est un nouveau ticket
  await ticketForm.start(client, ch, member.id);

  return { channel: ch, existed: false };
}

module.exports = {
  ensureTicketPanel,
  createOrGetTicket
};