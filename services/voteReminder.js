const { PermissionsBitField } = require("discord.js");
const { readJson, writeJson } = require("./storage");

console.log("[VOTE] voteReminder loaded from:", __filename);

const FILE = "vote_reminder.json";

function loadDb() {
  return readJson(FILE, {
    monthKey: null,
    lastRun: {},
    lastVotes: {}
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

  const get = (type) => parts.find((part) => part.type === type)?.value;
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  return {
    year,
    month,
    day,
    hour,
    minute,
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
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripHtml(html) {
  return decodeHtmlEntities(String(html || ""))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|td|th|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRankingTable(html) {
  const source = String(html || "");
  const headerMatch = source.match(/<div[^>]*class="card-header"[^>]*>\s*Classement\s*<\/div>/i);
  if (!headerMatch) return [];

  const afterHeader = source.slice(headerMatch.index);
  const tbodyMatch = afterHeader.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return [];

  const rows = [];
  const rowRe = /<tr\b[\s\S]*?>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRe.exec(tbodyMatch[1]))) {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((match) => stripHtml(match[1]));

    if (cells.length < 3) continue;

    const rank = Number((cells[0].match(/\d+/) || [])[0]);
    const name = cells[1];
    const votes = Number(cells[2].replace(/[^\d]/g, ""));

    if (!name || !Number.isFinite(votes)) continue;

    rows.push({
      rank: Number.isFinite(rank) ? rank : rows.length + 1,
      name,
      votes
    });
  }

  rows.sort((a, b) => a.rank - b.rank);
  return rows.map(({ name, votes }) => ({ name, votes }));
}

function extractTop(text, which) {
  const kind = which === "global" ? "global" : "du mois";
  const reStart = new RegExp(`Top\\s+\\d+\\s+${kind}`, "i");
  const startMatch = text.match(reStart);
  if (!startMatch) return [];

  const start = text.indexOf(startMatch[0]);
  if (start < 0) return [];

  const reNextTop = /Top\s+\d+\s+(du mois|global)/ig;
  reNextTop.lastIndex = start + startMatch[0].length;
  const nextMatch = reNextTop.exec(text);

  let end = -1;
  if (nextMatch && nextMatch.index > start) {
    end = nextMatch.index;
  } else {
    const copyrightIndex = text.indexOf("Copyright", start);
    end = copyrightIndex > 0 ? copyrightIndex : text.length;
  }

  const section = text.slice(start, end);
  const out = [];
  const linePattern = /(?:\n|^)\s*([A-Za-z0-9_]{2,20})\s*\n\s*#\s*\d+\s*\n\s*(\d+)\s*(?=\n|$)/g;
  let match;

  while ((match = linePattern.exec(section))) {
    out.push({ name: match[1], votes: Number(match[2]) });
  }

  if (out.length) return out;

  const compact = [];
  const compactPattern = /\b([A-Za-z0-9_]{2,20})\s*#\s*(\d+)\s*(\d+)\b/g;
  let compactMatch;

  while ((compactMatch = compactPattern.exec(section))) {
    compact.push({
      name: compactMatch[1],
      rank: Number(compactMatch[2]),
      votes: Number(compactMatch[3])
    });
  }

  compact.sort((a, b) => a.rank - b.rank);
  return compact.map(({ name, votes }) => ({ name, votes }));
}

function extractRanking(html, list) {
  const tableRanking = extractRankingTable(html);
  if (tableRanking.length) return tableRanking;
  return extractTop(htmlToText(html), list);
}

async function fetchVoteRanking(voteUrl, list) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(voteUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (MajestyBot VoteChecker)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    return {
      html,
      ranking: extractRanking(html, list)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .trim();
}

function candidateNicknames(displayName) {
  const raw = String(displayName || "").trim();
  const ascii = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  const tokens = ascii.match(/[A-Za-z0-9_]{2,20}/g) || [];
  const cleaned = ascii.replace(/^\s*[\[\(][^\]\)]+[\]\)]\s*/g, "").trim();
  const cleanedTokens = cleaned.match(/[A-Za-z0-9_]{2,20}/g) || [];

  const candidates = new Set();
  candidates.add(raw);
  candidates.add(cleaned);

  for (const token of tokens) candidates.add(token);
  for (const token of cleanedTokens) candidates.add(token);
  if (cleanedTokens.length) candidates.add(cleanedTokens[cleanedTokens.length - 1]);

  return [...candidates].map(normalizeName).filter(Boolean);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
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

function memberMatchScore(mcName, member, threshold) {
  const target = normalizeName(mcName);
  if (!target) return null;

  const short = target.length <= 4;
  const shortThreshold = 0.72;
  const candidates = candidateNicknames(member.displayName);

  if (candidates.includes(target)) return 1;

  if (short) {
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (candidate.includes(target) && candidate.length <= target.length + 6) {
        return 0.95;
      }
    }
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate.length >= 3 && target.includes(candidate) && target.length <= candidate.length + 10) {
      return 0.92;
    }
    if (target.length >= 3 && candidate.includes(target) && candidate.length <= target.length + 10) {
      return 0.92;
    }
  }

  let bestScore = 0;

  for (const candidate of candidates) {
    if (!candidate) continue;
    const score = similarity(candidate, target);
    if (score > bestScore) bestScore = score;
  }

  const minScore = short ? Math.min(threshold, shortThreshold) : threshold;
  return bestScore >= minScore ? bestScore : null;
}

function matchRankingToStaff(ranking, members, threshold) {
  const candidates = [];
  const memberList = [...members.values()];

  for (const row of ranking) {
    const rowKey = normalizeName(row.name);
    if (!rowKey) continue;

    for (const member of memberList) {
      const score = memberMatchScore(row.name, member, threshold);
      if (score == null) continue;

      candidates.push({ row, rowKey, member, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score || b.row.votes - a.row.votes || a.row.name.localeCompare(b.row.name));

  const usedRows = new Set();
  const usedMembers = new Set();
  const matches = [];

  for (const candidate of candidates) {
    if (usedRows.has(candidate.rowKey) || usedMembers.has(candidate.member.id)) continue;
    usedRows.add(candidate.rowKey);
    usedMembers.add(candidate.member.id);
    matches.push(candidate);
  }

  const unmatchedMembers = memberList.filter((member) => !usedMembers.has(member.id));
  return { matches, unmatchedMembers };
}

async function runCheck(client, opts = {}) {
  const cfg = client.config.voteReminder;
  if (!cfg?.enabled) return { ok: false, reason: "disabled" };

  const debugChannel = opts.debugChannel || null;
  const dbg = async (text) => {
    if (!debugChannel) return;

    try {
      await debugChannel.send({
        content: `DEBUG ${text}`.slice(0, 1900),
        allowedMentions: { parse: [] }
      });
    } catch {}
  };

  await dbg("runCheck called");

  const staffChannel = await client.channels.fetch(cfg.staffChannelId).catch(() => null);
  if (!staffChannel || !staffChannel.isTextBased()) {
    await dbg("staffChannel missing or not text based");
    return { ok: false, reason: "no_staff_channel" };
  }

  const allMembers = await staffChannel.guild.members.fetch().catch(() => null);
  if (!allMembers) {
    await dbg("guild members fetch failed");
    return { ok: false, reason: "no_members" };
  }

  const staffMembers = allMembers.filter((member) =>
    !member.user.bot && staffChannel.permissionsFor(member).has(PermissionsBitField.Flags.ViewChannel)
  );

  await dbg(`staff visible: ${staffMembers.size}`);

  let html = "";
  let ranking = [];

  try {
    const result = await fetchVoteRanking(cfg.voteUrl, cfg.list || "month");
    html = result.html;
    ranking = result.ranking;

    await dbg(`html length: ${html.length}`);
    await dbg(`parsed ranking: ${ranking.length}`);

    if (!ranking.length) {
      const text = htmlToText(html);
      await dbg(`empty ranking, text sample: ${text.slice(0, 300).replace(/\n/g, " | ")}`);
      return { ok: false, reason: "parse_empty" };
    }
  } catch (error) {
    await dbg(`fetch/parse error: ${String(error?.message || error).slice(0, 180)}`);
    return { ok: false, reason: "fetch_parse_error" };
  }

  const threshold = cfg.similarityThreshold ?? 0.86;
  const db = loadDb();
  const nowParis = parisParts();

  db.lastRun ||= {};
  db.lastVotes ||= {};

  if (db.monthKey !== nowParis.monthKey) {
    db.monthKey = nowParis.monthKey;
    db.lastVotes = {};
    await dbg(`month changed to ${nowParis.monthKey}, votes reset`);
  }

  const { matches, unmatchedMembers } = matchRankingToStaff(ranking, staffMembers, threshold);
  const matchesByRowKey = new Map(matches.map((match) => [match.rowKey, match]));
  const remindersByMemberId = new Map();

  await dbg(`staff matches: ${matches.length}, staff missing from ranking: ${unmatchedMembers.length}`);

  for (const row of ranking) {
    const key = normalizeName(row.name);
    if (!key) continue;

    const previousVotes = db.lastVotes[key];
    db.lastVotes[key] = row.votes;

    if (typeof previousVotes !== "number") continue;
    if (row.votes > previousVotes) continue;

    const match = matchesByRowKey.get(key);
    if (!match) continue;

    remindersByMemberId.set(match.member.id, {
      member: match.member,
      mc: row.name,
      votes: row.votes,
      reason: "votes_static"
    });
  }

  for (const member of unmatchedMembers) {
    if (remindersByMemberId.has(member.id)) continue;

    remindersByMemberId.set(member.id, {
      member,
      reason: "missing_from_ranking"
    });
  }

  saveDb(db);

  const reminders = [...remindersByMemberId.values()];

  await dbg(`db saved, lastVotes size: ${Object.keys(db.lastVotes).length}`);
  await dbg(`reminders: ${reminders.length}`);

  if (!reminders.length) {
    return { ok: true, parsed: ranking.length, matched: matches.length, reminded: 0 };
  }

  const lines = reminders
    .map((entry) => {
      if (entry.reason === "missing_from_ranking") {
        return `- ${entry.member} (pseudo introuvable dans le classement)`;
      }

      return `- ${entry.member} (MC: **${entry.mc}**, votes: **${entry.votes}**, score non augmente)`;
    })
    .join("\n");

  let dmOk = 0;
  let dmFail = 0;

  for (const reminder of reminders) {
    const dmText =
`Salut !

Petit rappel : n'oublie pas de voter pour MajestyCraft.
Lien de vote : ${cfg.voteUrl}

Merci a toi et bon jeu !`;

    try {
      await reminder.member.send({ content: dmText, allowedMentions: { parse: [] } });
      dmOk++;
    } catch {
      dmFail++;
    }
  }

  await staffChannel.send({
    content:
      `Rappel vote envoye en MP\n` +
      `${cfg.voteUrl}\n` +
      `MP envoyes : **${dmOk}**\n` +
      (dmFail ? `MP impossibles : **${dmFail}**\n` : "") +
      `\nPersonnes concernees :\n${lines}`,
    allowedMentions: { parse: [] }
  }).catch(() => {});

  return { ok: true, parsed: ranking.length, matched: matches.length, reminded: reminders.length };
}

let interval = null;
const runningSlots = new Set();

function start(client) {
  const cfg = client.config.voteReminder;
  if (!cfg?.enabled) return;

  if (interval) clearInterval(interval);

  interval = setInterval(async () => {
    const t = parisParts();
    const hours = Array.isArray(cfg.scheduleHours) ? cfg.scheduleHours : [11, 19];

    if (!hours.includes(t.hour)) return;

    const slot = String(t.hour);
    const slotKey = `${t.dateKey}:${slot}`;
    const db = loadDb();
    db.lastRun ||= {};
    db.lastRun[t.dateKey] ||= {};

    if (db.lastRun[t.dateKey][slot]) return;
    if (runningSlots.has(slotKey)) return;

    runningSlots.add(slotKey);

    try {
      console.log(`[VOTE] Scheduled check running for ${t.dateKey} ${slot}h (Paris)`);

      const result = await runCheck(client);
      if (!result?.ok) {
        console.warn(`[VOTE] Scheduled check failed for ${slotKey}: ${result?.reason || "unknown"}`);
        return;
      }

      const freshDb = loadDb();
      freshDb.lastRun ||= {};
      freshDb.lastRun[t.dateKey] ||= {};
      freshDb.lastRun[t.dateKey][slot] = true;
      saveDb(freshDb);
    } catch (error) {
      console.error("[VOTE] scheduler error:", error?.message || error);
    } finally {
      runningSlots.delete(slotKey);
    }
  }, 60 * 1000);

  console.log("Vote reminder scheduler armed (checks every minute)");
}

module.exports = {
  start,
  runCheck,
  _internals: {
    extractRanking,
    extractRankingTable,
    matchRankingToStaff,
    normalizeName,
    candidateNicknames
  }
};
