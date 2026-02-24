const { PermissionsBitField } = require("discord.js");
const { readJson, writeJson } = require("./storage");

console.log("[VOTE] voteReminder loaded from:", __filename);

const FILE = "vote_reminder.json";

function loadDb() {
  return readJson(FILE, {
    monthKey: null,
    lastRun: {}, // { "YYYY-MM-DD": { "11": true, "19": true } }
    lastVotes: {} // { "mcname": number }
  });
}
function saveDb(db) {
  writeJson(FILE, db);
}

function parisParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(d);

  const get = (t) => parts.find(p => p.type === t)?.value;
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  return {
    year, month, day, hour, minute,
    dateKey: `${year}-${month}-${day}`,
    monthKey: `${year}-${month}`
  };
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li|tr|td|th|table|ul|ol|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTop(text, which /* "month" | "global" */) {
  const kind = which === "global" ? "global" : "du mois";

  // trouve le bloc "Top <N> du mois" ou "Top <N> global"
  const reStart = new RegExp(`Top\\s+\\d+\\s+${kind}`, "i");
  const startMatch = text.match(reStart);
  if (!startMatch) return [];

  const start = text.indexOf(startMatch[0]);
  if (start < 0) return [];

  // fin = prochain "Top <N> ..." ou "Copyright"
  const reNextTop = /Top\s+\d+\s+(du mois|global)/ig;
  reNextTop.lastIndex = start + startMatch[0].length;
  const nextMatch = reNextTop.exec(text);

  let end = -1;
  if (nextMatch && nextMatch.index > start) {
    end = nextMatch.index;
  } else {
    const c = text.indexOf("Copyright", start);
    end = c > 0 ? c : text.length;
  }

  const section = text.slice(start, end);

  // pattern A: Name \n # 1 \n 62  (ton format actuel)
  let re = /(?:\n|^)\s*([A-Za-z0-9_]{2,20})\s*\n\s*#\s*\d+\s*\n\s*(\d+)\s*(?=\n|$)/g;

  const out = [];
  let m;
  while ((m = re.exec(section))) {
    out.push({ name: m[1], votes: Number(m[2]) });
  }

  // ✅ fallback B: format compact "Name #1 62" ou "Name  #  1  62"
  if (out.length === 0) {
    const out2 = [];
    const re2 = /\b([A-Za-z0-9_]{2,20})\s*#\s*(\d+)\s*(\d+)\b/g;
    let k;
    while ((k = re2.exec(section))) {
      out2.push({ name: k[1], rank: Number(k[2]), votes: Number(k[3]) });
    }
    // tri par rank si trouvé
    out2.sort((a, b) => a.rank - b.rank);
    return out2.map(x => ({ name: x.name, votes: x.votes }));
  }

  return out;
}

async function fetchVoteRanking(voteUrl, list) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(voteUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const text = htmlToText(html);
    return extractTop(text, list);
  } finally {
    clearTimeout(t);
  }
}

function normalizeName(s) {
  return String(s || "")
    .normalize("NFKD")                 // ✅ important (compat: lettres fancy -> normales)
    .replace(/[\u0300-\u036f]/g, "")   // accents
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")        // garde lettres/chiffres/underscore
    .trim();
}

function candidateNicknames(displayName) {
  const raw = String(displayName || "").trim();

  // ✅ on normalise en NFKD avant d'extraire des tokens
  const ascii = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  // tokens alphanum/underscore
  const tokens = ascii.match(/[A-Za-z0-9_]{2,20}/g) || [];

  // enlève un préfixe [Grade] ou (Grade) si présent
  const cleaned = ascii.replace(/^\s*[\[\(][^\]\)]+[\]\)]\s*/g, "").trim();
  const tokens2 = cleaned.match(/[A-Za-z0-9_]{2,20}/g) || [];

  const candidates = new Set();
  candidates.add(raw);
  candidates.add(cleaned);
  for (const t of tokens) candidates.add(t);
  for (const t of tokens2) candidates.add(t);
  if (tokens2.length) candidates.add(tokens2[tokens2.length - 1]);

  return [...candidates].map(normalizeName).filter(Boolean);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (!al) return bl;
  if (!bl) return al;

  const dp = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) dp[i][0] = i;
  for (let j = 0; j <= bl; j++) dp[0][j] = j;

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[al][bl];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen ? (1 - dist / maxLen) : 1;
}

function bestMatch(mcName, members, threshold) {
  const target = normalizeName(mcName);
  if (!target) return null;

  const short = target.length <= 4;
  const shortThreshold = 0.72; // mieux pour DmR, etc.

  let best = null;
  let bestScore = 0;

  for (const m of members.values()) {
    const candidates = candidateNicknames(m.displayName);

    // ✅ priorité: match exact sur token (super important pour petits pseudos)
    if (candidates.includes(target)) return { member: m, score: 1 };

    // ✅ pour petits pseudos: match "contains" tolérant
    if (short) {
      for (const c of candidates) {
        if (!c) continue;
        if (c.includes(target) && c.length <= target.length + 6) {
          return { member: m, score: 0.95 };
        }
      }
    }

    // fallback similarité
    for (const c of candidates) {
      if (!c) continue;
      const score = similarity(c, target);
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
  }

  const min = short ? Math.min(threshold, shortThreshold) : threshold;
  if (best && bestScore >= min) return { member: best, score: bestScore };
  return null;
}

async function runCheck(client, opts = {}) {
  const cfg = client.config.voteReminder;
  if (!cfg?.enabled) return { ok: false, reason: "disabled" };

  const debugChannel = opts.debugChannel || null;
  const dbg = async (txt) => {
    if (!debugChannel) return;
    try {
      await debugChannel.send({ content: `🧪 ${txt}`.slice(0, 1900), allowedMentions: { parse: [] } });
    } catch {}
  };

  await dbg("runCheck() appelé ✅");

  const staffChannel = await client.channels.fetch(cfg.staffChannelId).catch(() => null);
  if (!staffChannel || !staffChannel.isTextBased()) {
    await dbg("❌ staffChannel introuvable / pas textBased");
    return { ok: false, reason: "no_staff_channel" };
  }

  // Membres ayant accès au staff chat
  const allMembers = await staffChannel.guild.members.fetch().catch(() => null);
  if (!allMembers) {
    await dbg("❌ Impossible fetch members()");
    return { ok: false, reason: "no_members" };
  }

  const staffMembers = allMembers.filter(m =>
    staffChannel.permissionsFor(m).has(PermissionsBitField.Flags.ViewChannel)
  );

  await dbg(`Staff members visibles: ${staffMembers.size}`);

  // Fetch + parse ranking
  let ranking = null;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(cfg.voteUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (MajestyBot VoteChecker)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    clearTimeout(t);

    if (!res.ok) {
      await dbg(`❌ HTTP ${res.status} sur ${cfg.voteUrl}`);
      return { ok: false, reason: "http_" + res.status };
    }

    const html = await res.text();
    await dbg(`HTML length: ${html.length}`);

    const text = htmlToText(html);
    ranking = extractTop(text, cfg.list || "month");
    await dbg(`Parsed ranking: ${ranking.length} entrées`);

    if (!ranking.length) {
      // on te balance 300 chars pour voir à quoi ressemble le texte nettoyé
      await dbg("⚠️ ranking vide. Extrait text: " + text.slice(0, 300).replace(/\n/g, " | "));
      return { ok: false, reason: "parse_empty" };
    }
  } catch (e) {
    await dbg(`❌ fetch/parse error: ${String(e?.message || e).slice(0, 180)}`);
    return { ok: false, reason: "fetch_parse_error" };
  }

  const threshold = cfg.similarityThreshold ?? 0.86;
  const db = loadDb();

  const reminders = [];
  let matchedCount = 0;

  for (const r of ranking) {
    const key = normalizeName(r.name);
    if (!key) continue;

    const prev = db.lastVotes[key];

    // ✅ Toujours update la valeur vue
    db.lastVotes[key] = r.votes;

    // Baseline => pas de reminder
    if (typeof prev !== "number") continue;

    // Vote augmenté => OK
    if (r.votes > prev) continue;

    // Vote identique => on ping si match staff
    const match = bestMatch(r.name, staffMembers, threshold);
    if (!match) continue;

    matchedCount++;
    reminders.push({ member: match.member, mc: r.name, votes: r.votes });
  }

  saveDb(db);

  await dbg(`DB saved ✅ (lastVotes size: ${Object.keys(db.lastVotes || {}).length})`);
  await dbg(`Matches staff: ${matchedCount} | Reminders: ${reminders.length}`);

  if (!reminders.length) return { ok: true, parsed: ranking.length, matched: matchedCount, reminded: 0 };

  const mentions = [...new Set(reminders.map(x => `<@${x.member.id}>`))].join(" ");
  const lines = reminders
    .map(x => `• ${x.member} (MC: **${x.mc}**, votes: **${x.votes}**)`)
    .join("\n");

  await staffChannel.send({
    content:
      `🔔 **Rappel vote** : aucun vote détecté depuis la dernière vérif.\n` +
      `➡️ Vote ici : ${cfg.voteUrl}\n\n${lines}`,
    allowedMentions: { users: reminders.map(x => x.member.id) }
  }).catch(() => {});

  return { ok: true, parsed: ranking.length, matched: matchedCount, reminded: reminders.length };
}

let interval = null;

function start(client) {
  const cfg = client.config.voteReminder;
  if (!cfg?.enabled) return;

  if (interval) clearInterval(interval);

  interval = setInterval(async () => {
    try {
      const t = parisParts();
      const hours = Array.isArray(cfg.scheduleHours) ? cfg.scheduleHours : [11, 19];

      // on ne déclenche que sur les heures voulues
      if (!hours.includes(t.hour)) return;

      const db = loadDb();
      db.lastRun ||= {};
      db.lastRun[t.dateKey] ||= {};

      const slot = String(t.hour);
      if (db.lastRun[t.dateKey][slot]) return;

      // ✅ on marque avant pour éviter double run si ça lag
      db.lastRun[t.dateKey][slot] = true;
      saveDb(db);

      console.log(`[VOTE] Scheduled check running for ${t.dateKey} ${slot}h (Paris)`);

      await runCheck(client);
    } catch (e) {
      console.error("[VOTE] scheduler error:", e?.message || e);
    }
  }, 60 * 1000);

  console.log("✅ Vote reminder scheduler armed (checks every minute)");
}

module.exports = { start, runCheck };