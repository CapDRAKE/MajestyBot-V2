const MAJESTY_GUILD = "417991602171281418";
const NEW_GUILD     = "1499883112983826627";

module.exports = {
  token: "",

  allowedGuildIds: [MAJESTY_GUILD, NEW_GUILD],

  prefix: "+",

  // ── Config par serveur ──────────────────────────────────────────────────────
  guilds: {
    [MAJESTY_GUILD]: {
      voteUrl: "https://majestycraft.com/vote",
      serverJoinIp: "play.majestycraft.com",

      welcomeChannelId: "845229994309058571",
      joinGhostPingChannelId: "845233355629002772",

      gradeRoleId: "845209018829504522",
      visitorRoleId: "845209018829504522",

      modLogChannelId: "706143840481837057",

      antiSpam: {
        enabled: true,
        floodMaxMessages: 6,
        floodWindowSeconds: 8,
        repeatMaxCount: 4,
        repeatWindowSeconds: 30,
        strikesToTimeout: 3,
        strikeWindowMinutes: 10,
        timeoutMinutes: 5
      },

      music: {
        defaultVolume: 0.5
      },

      ticket: {
        panelChannelId: "1475176858751336498",
        emoji: "🎫",
        staffRoleIds: [
          "694904362438361140",
          "1234516986227068949",
          "773975372046794812",
          "1011302303900381234",
          "1047070039720853534",
          "690178116110647306",
          "1089220033168814211"
        ],
        categoryId: ""
      },

      antiInsult: {
        enabled: true,
        ignoreStaff: true,
        ignoredChannelIds: [],
        ignoredRoleIds: [],
        deleteMessage: true,
        strikeWindowMinutes: 10,
        strikesToTimeout: 3,
        timeoutMinutes: 10,
        warnMessage: "⚠️ {user} évite les insultes, merci."
      },

      ai: {
        enabled: true,
        supportChannelId: "1088177788089012334",
        mentionMode: true,
        sessionTimeoutMs: 180000,
        maxTurns: 12,
        perUserCooldownMs: 4000,
        learn: {
          enabled: true,
          channelIds: ["1088177788089012334", "845217118916182027"],
          maxStoredMessages: 5000
        },
        site: {
          baseUrl: "https://majestycraft.com",
          autoCrawl: true,
          maxUrls: 200
        },
        model: "llama-3.3-70b-versatile"
      },

      mcMonitor: {
        enabled: true,
        notifyChannelId: "885250816125071390",
        mentionEveryone: false,
        mentionRoleIds: [],
        intervalSec: 20,
        failThreshold: 3,
        requestAttempts: 3,
        requestRetryDelayMs: 1200,
        notifyCooldownMin: 10,
        notifyOnBootOffline: true,
        dashboardChannelId: "845218079901483038",
        dashboardTitle: "État des serveurs MajestyCraft",
        degradedLatencyMs: 800,
        degradedIfNoPlayerInfo: true,
        boxId: "8510",

        // Serveurs MC — auto-découverts via boxId
        servers: []
      },

      antiAbuse: {
        enabled: true,
        ignoreStaff: true,
        mentions: {
          blockEveryoneHere: true,
          maxUserMentions: 8,
          maxRoleMentions: 6
        },
        antiLinksNewAccounts: {
          enabled: true,
          minAccountAgeDays: 7,
          whitelistDomains: [
            "majestycraft.com", "discord.com", "discord.gg",
            "youtube.com", "youtu.be",
            "cdn.discordapp.com", "media.discordapp.net"
          ]
        },
        slowmodeRaid: {
          enabled: true,
          windowSec: 10,
          msgThreshold: 18,
          uniqueUsersThreshold: 7,
          slowmodeSec: 8,
          durationMin: 5,
          cooldownMin: 10,
          announceInChannel: false
        }
      },

      voteReminder: {
        enabled: true,
        voteUrl: "https://majestycraft.com/vote",
        staffChannelId: "706143840481837057",
        scheduleHours: [11, 19],
        minuteWindow: 3,
        list: "month",
        similarityThreshold: 0.82
      },

      inviteTracker: {
        enabled: true,
        logChannelId: "706143840481837057"
      },

      memberCounters: {
        enabled: true,
        totalChannelId: "845143853858160690",
        onlineChannelId: "846323293015244822",
        totalName: "👥 Membres : {count}",
        onlineName: "🟢 En ligne : {count}",
        updateIntervalSec: 120
      },

      roleMenu: {
        enabled: true,
        channelId: "845235427698540564",

        // Rôles projets MajestyCorp
        projectRoles: [
          { emoji: "⛏️", label: "MajestyCraft",    roleId: "848845870254260244" },
          { emoji: "🚀", label: "MajestyLauncher",  roleId: "845245629407166465" },
          { emoji: "🏆", label: "MajestyChallenge", roleId: "1523406191672299591" }
        ],

        // Rôles modes de jeu (exclusifs à MajestyCraft)
        roles: [
          { emoji: "🌿", label: "Survie",     roleId: "1089167232921243698" },
          { emoji: "🎨", label: "Créatif",    roleId: "1089167354304405604" },
          { emoji: "⚔️", label: "PVP Box",    roleId: "1089167472260817036" },
          { emoji: "☁️", label: "MajestySky", roleId: "1089167408163471482" }
        ]
      }
    },

    [NEW_GUILD]: {
      welcomeChannelId: "1499884601944969257",
      welcomeMessage: "👋 Bienvenue {user} ! T'as sonné ? On t'attendait pas, mais t'es là quand même — installe-toi, le canapé est libre.",

      ticket:        { panelChannelId: null, staffRoleIds: [], emoji: "🎫", categoryId: "" },
      antiSpam:      { enabled: false },
      antiInsult:    { enabled: false },
      antiAbuse:     { enabled: false },
      mcMonitor:     { enabled: false },
      voteReminder:  { enabled: false },
      inviteTracker: { enabled: false },
      memberCounters:{ enabled: false },
      roleMenu:      { enabled: false },

      ai: {
        enabled: true,
        mentionMode: true,        // répond quand on le mentionne
        supportChannelId: null,   // pas de salon dédié, mention only
        sessionTimeoutMs: 180000,
        maxTurns: 12,
        perUserCooldownMs: 3000,
        temperature: 1.0,

        // Pas de mémoire ni de crawl site sur ce serveur
        learn: { enabled: false },
        site:  { autoCrawl: false },

        model: "llama-3.3-70b-versatile",

        systemPrompt: `Tu es MajestyBot, un bot Discord sans filtre et sans pitié. Tu clashs, tu vannes, tu remets les gens à leur place avec style.
Ton mode par défaut : clash drôle et tranchant. Chaque message est une opportunité de sortir une vanne cinglante.
Tu retournes tout ce qu'on te dit contre la personne, avec une punchline qui fait mal mais qui fait rire.
Tu n'es jamais gentil pour rien. Si quelqu'un dit "cc", tu lui fais comprendre que c'était nul d'une façon qui arrache.
Tu parles argot français, tu es direct, incisif, et tu concludes toujours par une punchline qui claque.
Jamais vulgaire ou insultant pour de vrai — juste un clash bien senti qui fait rire tout le monde sauf la cible.
Max 2-3 phrases. Pas de blabla. Que de la punchline.`
      }
    }
  },

  // Retourne la config d'un guild (ou un objet vide si inconnu)
  getGuildConfig(guildId) {
    return this.guilds[guildId] || {};
  },

  // Compat legacy : certains services lisent encore client.config.X directement
  // Ces valeurs pointent sur MajestyCraft (guild principal)
  get voteUrl()              { return this.guilds[MAJESTY_GUILD].voteUrl; },
  get serverJoinIp()         { return this.guilds[MAJESTY_GUILD].serverJoinIp; },
  get welcomeChannelId()     { return this.guilds[MAJESTY_GUILD].welcomeChannelId; },
  get joinGhostPingChannelId(){ return this.guilds[MAJESTY_GUILD].joinGhostPingChannelId; },
  get gradeRoleId()          { return this.guilds[MAJESTY_GUILD].gradeRoleId; },
  get visitorRoleId()        { return this.guilds[MAJESTY_GUILD].visitorRoleId; },
  get modLogChannelId()      { return this.guilds[MAJESTY_GUILD].modLogChannelId; },
  get antiSpam()             { return this.guilds[MAJESTY_GUILD].antiSpam; },
  get music()                { return this.guilds[MAJESTY_GUILD].music; },
  get ticket()               { return this.guilds[MAJESTY_GUILD].ticket; },
  get antiInsult()           { return this.guilds[MAJESTY_GUILD].antiInsult; },
  get ai()                   { return this.guilds[MAJESTY_GUILD].ai; },
  get mcMonitor()            { return this.guilds[MAJESTY_GUILD].mcMonitor; },
  get antiAbuse()            { return this.guilds[MAJESTY_GUILD].antiAbuse; },
  get voteReminder()         { return this.guilds[MAJESTY_GUILD].voteReminder; },
  get inviteTracker()        { return this.guilds[MAJESTY_GUILD].inviteTracker; },
  get memberCounters()       { return this.guilds[MAJESTY_GUILD].memberCounters; },
  get roleMenu()             { return this.guilds[MAJESTY_GUILD].roleMenu; },
};
