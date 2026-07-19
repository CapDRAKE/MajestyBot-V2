const { EmbedBuilder } = require("discord.js");
const { readJson, writeJson } = require("./storage");

const CHANNEL_ID = "845217062871760916";
const DB_FILE = "infopanel.json";

function loadDb() { return readJson(DB_FILE, { messageIds: [] }); }
function saveDb(db) { writeJson(DB_FILE, db); }

function buildEmbeds() {
  return [
    new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("🏢  MajestyCorp")
      .setDescription(
        "MajestyCorp est la structure qui regroupe l'ensemble de nos projets gaming et communautaires.\n" +
        "Retrouve tout sur **[majestycorp.fr](https://majestycorp.fr)**."
      ),

    new EmbedBuilder()
      .setColor(0x57F287)
      .setAuthor({ name: "MajestyCraft", iconURL: "https://majestycraft.com/favicon.ico" })
      .setTitle("⛏️  MajestyCraft — Serveur Minecraft")
      .setDescription("Serveur Minecraft Java & Bedrock avec plusieurs modes de jeu.")
      .addFields(
        { name: "🌐  Site officiel", value: "[majestycraft.com](https://majestycraft.com)", inline: true },
        { name: "⭐  Voter",         value: "[majestycraft.com/vote](https://majestycraft.com/vote)", inline: true },
        { name: "🎫  Support",       value: "[majestycraft.com/support](https://majestycraft.com/support)", inline: true },
        { name: "📋  Recrutement",   value: "[Postuler ici](https://majestycraft.com/support/category/4/tickets/create)", inline: true },
        { name: "📱  App mobile",    value: "[majestycraft.com/mobile](https://majestycraft.com/mobile)", inline: true },
        { name: "​", value: "​", inline: false },
        { name: "☕  Java",   value: "```play.majestycraft.com```", inline: true },
        { name: "🪨  Bedrock", value: "```IP : 91.197.6.34\nPORT : 41831```", inline: true }
      ),

    new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle("🚀  MajestyLauncher")
      .setDescription("Launcher Minecraft avec Forge, OptiFine et toutes les versions disponibles. Mises a jour automatiques incluses.")
      .addFields(
        { name: "⬇️  Télécharger", value: "[majestylauncher.com](https://majestylauncher.com)", inline: true }
      ),

    new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle("🏆  MajestyChallenge")
      .setDescription("Plateforme de challenges et competitions gaming de MajestyCorp.")
      .addFields(
        { name: "🌐  Site", value: "[majestychallenge.fr](https://majestychallenge.fr)", inline: true }
      )
      .setFooter({ text: "MajestyCorp • Tous droits réservés" })
  ];
}

async function ensure(client) {
  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const db = loadDb();
  const embeds = buildEmbeds();

  if (db.messageIds && db.messageIds.length === embeds.length) {
    const messages = [];
    let allFound = true;
    for (const id of db.messageIds) {
      const msg = await channel.messages.fetch(id).catch(() => null);
      if (!msg) { allFound = false; break; }
      messages.push(msg);
    }
    if (allFound) {
      for (let i = 0; i < messages.length; i++) {
        await messages[i].edit({ embeds: [embeds[i]] }).catch(() => {});
      }
      return;
    }
  }

  const ids = [];
  for (const embed of embeds) {
    const msg = await channel.send({ embeds: [embed] });
    ids.push(msg.id);
  }
  db.messageIds = ids;
  saveDb(db);
}

module.exports = { ensure: ensure };