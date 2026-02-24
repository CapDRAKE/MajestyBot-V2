const { EmbedBuilder } = require("discord.js");

const activeForms = new Map(); // channelId -> { ownerId, step, answers, startedAt, lastAt }

const SERVER_CHOICES = [
  "Survie",
  "Créatif",
  "PVP Box",
  "MajestySky",
  "Hub",
  "Bungeecord / Connexion",
  "Launcher",
  "Site / Vote / Boutique",
  "Autre"
];

function now() {
  return Date.now();
}

function isTicketChannel(channel) {
  // on détecte via topic créé dans tickets.js: "Support Ticket | Owner:<id>"
  const topic = channel?.topic || "";
  return topic.includes("Support Ticket | Owner:");
}

function getTicketOwnerId(channel) {
  const topic = channel?.topic || "";
  const m = topic.match(/Owner:(\d+)/);
  return m ? m[1] : null;
}

function buildQuestionEmbed(step) {
  if (step === 0) {
    return new EmbedBuilder()
      .setTitle("📝 Ticket Support — Étape 1/4")
      .setDescription("Quel est ton **pseudo Minecraft** ?\n*(ex: CapDRAKE)*")
      .setFooter({ text: "Réponds directement dans ce salon." });
  }

  if (step === 1) {
    const list = SERVER_CHOICES.map((s, i) => `**${i + 1}.** ${s}`).join("\n");
    return new EmbedBuilder()
      .setTitle("📝 Ticket Support — Étape 2/4")
      .setDescription(
        "Quel est le **serveur concerné** ?\n" +
        "Réponds par le **numéro** ou le **nom** :\n\n" +
        list
      )
      .setFooter({ text: "Ex: 7 (Launcher) ou 'Survie'." });
  }

  if (step === 2) {
    return new EmbedBuilder()
      .setTitle("📝 Ticket Support — Étape 3/4")
      .setDescription(
        "Décris ton **problème** le plus clairement possible :\n" +
        "• ce que tu fais\n• ce qui se passe\n• depuis quand\n• erreurs / messages"
      )
      .setFooter({ text: "Plus c’est précis, plus on va vite." });
  }

  // step 3
  return new EmbedBuilder()
    .setTitle("📝 Ticket Support — Étape 4/4")
    .setDescription(
      "Ajoute un **screenshot / preuve** (image ou fichier),\n" +
      "ou écris **skip** si tu n’en as pas."
    )
    .setFooter({ text: "Tu peux upload ici directement." });
}

async function askNext(channel, form) {
  const embed = buildQuestionEmbed(form.step);
  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
}

function parseServerAnswer(content) {
  const c = String(content || "").trim();
  if (!c) return null;

  // number
  const n = Number(c);
  if (Number.isInteger(n) && n >= 1 && n <= SERVER_CHOICES.length) {
    return SERVER_CHOICES[n - 1];
  }

  // contains match
  const low = c.toLowerCase();
  const hit = SERVER_CHOICES.find(x => x.toLowerCase().includes(low) || low.includes(x.toLowerCase()));
  return hit || c;
}

function firstAttachmentUrl(message) {
  if (!message.attachments || message.attachments.size === 0) return null;
  const a = message.attachments.first();
  return a?.url || null;
}

async function finalize(channel, form) {
  const a = form.answers;

  const embed = new EmbedBuilder()
    .setTitle("✅ Résumé du ticket")
    .setDescription(`**Créé par :** <@${form.ownerId}>`)
    .addFields(
      { name: "Pseudo Minecraft", value: a.mc || "—", inline: true },
      { name: "Serveur", value: a.server || "—", inline: true },
      { name: "Problème", value: a.problem ? a.problem.slice(0, 1024) : "—", inline: false },
      { name: "Screenshot", value: a.screenshot ? a.screenshot : "—", inline: false }
    )
    .setTimestamp(new Date());

  const msg = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);
  if (msg) {
    // épingle
    await msg.pin().catch(() => {});
  }

  await channel.send({
    content: "🧾 Résumé épinglé. Tu peux maintenant échanger avec le staff ici.",
    allowedMentions: { parse: [] }
  }).catch(() => {});
}

async function start(client, channel, ownerId) {
  if (!channel || !channel.isTextBased()) return;
  if (!ownerId) return;

  // si déjà lancé
  if (activeForms.has(channel.id)) return;

  const form = {
    ownerId,
    step: 0,
    answers: { mc: null, server: null, problem: null, screenshot: null },
    startedAt: now(),
    lastAt: now()
  };

  activeForms.set(channel.id, form);

  await channel.send({
    content: `👋 <@${ownerId}> on va remplir un petit formulaire (30 sec) pour aider le staff 👇`,
    allowedMentions: { users: [ownerId] }
  }).catch(() => {});

  await askNext(channel, form);
}

async function handleMessage(client, message) {
  if (!message.guild || !message.channel || message.author.bot) return false;
  if (!isTicketChannel(message.channel)) return false;

  const ownerId = getTicketOwnerId(message.channel);
  if (!ownerId) return false;

  const form = activeForms.get(message.channel.id);
  if (!form) return false;

  // uniquement le créateur du ticket répond au formulaire
  if (message.author.id !== form.ownerId) return false;

  // timeout 15 min (optionnel)
  if (now() - form.lastAt > 15 * 60 * 1000) {
    activeForms.delete(message.channel.id);
    await message.channel.send("⌛ Formulaire expiré. (Demande au staff de relancer si besoin.)").catch(() => {});
    return false;
  }

  form.lastAt = now();

  const content = (message.content || "").trim();

  // Step 0: pseudo MC
  if (form.step === 0) {
    const pseudo = content.replace(/\s+/g, "");
    if (!pseudo || pseudo.length < 2 || pseudo.length > 20) {
      await message.channel.send("⚠️ Donne un pseudo MC valide (2–20 caractères).").catch(() => {});
      return true;
    }
    form.answers.mc = pseudo;
    form.step = 1;
    await askNext(message.channel, form);
    return true;
  }

  // Step 1: serveur
  if (form.step === 1) {
    const s = parseServerAnswer(content);
    if (!s) {
      await message.channel.send("⚠️ Réponds par un numéro (1-9) ou un nom.").catch(() => {});
      return true;
    }
    form.answers.server = s;
    form.step = 2;
    await askNext(message.channel, form);
    return true;
  }

  // Step 2: problème
  if (form.step === 2) {
    if (!content || content.length < 10) {
      await message.channel.send("⚠️ Décris un peu plus (au moins ~10 caractères).").catch(() => {});
      return true;
    }
    form.answers.problem = content.slice(0, 1800);
    form.step = 3;
    await askNext(message.channel, form);
    return true;
  }

  // Step 3: screenshot
  if (form.step === 3) {
    const att = firstAttachmentUrl(message);
    if (att) {
      form.answers.screenshot = att;
    } else if (/^skip$/i.test(content) || /^non$/i.test(content) || /^none$/i.test(content)) {
      form.answers.screenshot = null;
    } else {
      await message.channel.send("⚠️ Upload une image/fichier, ou écris **skip**.").catch(() => {});
      return true;
    }

    // terminé
    await finalize(message.channel, form);
    activeForms.delete(message.channel.id);
    return true;
  }

  return false;
}

module.exports = { start, handleMessage };