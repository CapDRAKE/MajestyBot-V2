module.exports = {
  token: "",

  allowedGuildIds: ["417991602171281418"], // MajestyCraft uniquement

  prefix: "+",

  voteUrl: "https://majestycraft.com/vote",
  serverJoinIp: "play.majestycraft.com",

  // Bienvenue
  welcomeChannelId: "845229994309058571",
  joinGhostPingChannelId: "845233355629002772",

  // Role "grade"
  gradeRoleId: "845209018829504522",
  visitorRoleId: "845209018829504522",

  // Optionnel: salon où logger les sanctions
  modLogChannelId: "706143840481837057",

  // Anti-spam
  antiSpam: {
    enabled: true,

    // Flood: X messages en Y secondes => action
    floodMaxMessages: 6,
    floodWindowSeconds: 8,

    // Répétition: même message répété X fois en Y secondes => action
    repeatMaxCount: 4,
    repeatWindowSeconds: 30,

    // Après N strikes en 10 min => timeout auto
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

    // Ignore le staff (évite de modérer les admins/modos)
    ignoreStaff: true,

    ignoredChannelIds: [],
    ignoredRoleIds: [],

    // Actions
    deleteMessage: true,

    // “Strikes” => timeout auto
    strikeWindowMinutes: 10,
    strikesToTimeout: 3,
    timeoutMinutes: 10,

    // Message d'avertissement (auto delete)
    warnMessage: "⚠️ {user} évite les insultes, merci."
  },

  ai: {
    enabled: true,

    // Déclencheurs
    supportChannelId: "1088177788089012334",
    mentionMode: true,

    // Session mention : stop après X ms sans message
    sessionTimeoutMs: 180000, // 3 min
    maxTurns: 12, // historique par session

    // Anti-spam IA
    perUserCooldownMs: 4000,

    // "Apprentissage" (mémoire locale)
    learn: {
      enabled: true,
      channelIds: [
        "1088177788089012334",
        "845217118916182027"
      ],
      maxStoredMessages: 5000
    },

    // Site majestycraft.com (crawl sitemap si possible)
    site: {
      baseUrl: "https://majestycraft.com",
      autoCrawl: true,
      maxUrls: 200
    },

    // Modèle (configurable dans openai.json aussi)
    model: "gpt-4o-mini"
  },

  mcMonitor: {
    enabled: true,

    // salon où poster les alertes (staff chat)
    notifyChannelId: "706143840481837057",

    mentionEveryone: true,
    mentionRoleIds: [
      // "123456789012345678"
    ],

    // toutes les X secondes
    intervalSec: 20,

    // pour éviter les faux positifs : down seulement après N échecs d'affilée
    failThreshold: 1,

    // cooldown anti-spam (en minutes) si ça flap
    notifyCooldownMin: 10,

    // si un serveur est déjà DOWN au démarrage, on alerte
    notifyOnBootOffline: true,

    // ✅ message public joueurs (1 seul message édité)
    dashboardChannelId: "845218079901483038",
    dashboardTitle: "État des serveurs MajestyCraft",

    degradedLatencyMs: 800,      // au-dessus de 800ms => 🟠 dégradé
    degradedIfNoPlayerInfo: true, // si pas de players online/max => 🟠 dégradé

    // liste des serveurs
    servers: [
      { name: "Bungeecord", address: "91.197.6.34",         port: 25601 },
      { name: "Hub",       address: "91.197.6.34",          port: 25595 },
      { name: "Survie",    address: "91.197.6.94",          port: 25599 },
      { name: "Créatif",   address: "91.197.6.34",          port: 25599 },
      { name: "PVP Box",   address: "91.197.6.222",         port: 25568 },
      { name: "MajestySky",address: "91.197.6.176",         port: 25603 }
    ]
  },

  antiAbuse: {
    enabled: true,
    ignoreStaff: true,

    // 1) Bloquer @everyone / @here + mentions massives
    mentions: {
      blockEveryoneHere: true,
      maxUserMentions: 8,
      maxRoleMentions: 6
    },

    // 2) Anti-lien pour comptes récents
    antiLinksNewAccounts: {
      enabled: true,
      minAccountAgeDays: 7,
      whitelistDomains: [
        "majestycraft.com",
        "discord.com",
        "discord.gg",
        "youtube.com",
        "youtu.be",
        "cdn.discordapp.com",
        "media.discordapp.net"
      ]
    },

    // 3) Auto slowmode anti-raid
    slowmodeRaid: {
      enabled: true,
      windowSec: 10,          // fenêtre de détection
      msgThreshold: 18,       // nb messages dans la fenêtre
      uniqueUsersThreshold: 7,// nb users uniques dans la fenêtre
      slowmodeSec: 8,         // slowmode appliqué
      durationMin: 5,         // durée avant retour normal
      cooldownMin: 10,        // anti spam d'activation
      announceInChannel: false
    }
  },

  voteReminder: {
    enabled: true,
    voteUrl: "https://majestycraft.com/vote",

    // salon staff où ping
    staffChannelId: "706143840481837057",

    // horaires Paris
    scheduleHours: [11, 19],
    minuteWindow: 3, // déclenche entre HH:00 et HH:02

    // source à suivre : "month" ou "global"
    list: "month",

    // matching pseudo MC -> pseudo Discord (fuzzy)
    similarityThreshold: 0.82
  },

  inviteTracker: {
    enabled: true,

    // où loguer les joins (recommandé = staff log / mod log)
    logChannelId: "706143840481837057"
  },

  memberCounters: {
    enabled: true,

    totalChannelId: "845143853858160690",
    onlineChannelId: "846323293015244822",

    totalName: "👥 Membres : {count}",
    onlineName: "🟢 En ligne : {count}",

    updateIntervalSec: 120 // toutes les 2 minutes
  },

  roleMenu: {
    enabled: true,
    channelId: "845235427698540564",
    title: "📣 Choisis tes notifications de jeu",
    description:
      "Réagis pour t’abonner aux nouveautés du mode de jeu.\n" +
      "Retire ta réaction pour te désabonner.\n" +
      "✅ Tu peux choisir plusieurs rôles.",

    roles: [
      { emoji: "🌿", label: "Survie", roleId: "1089167232921243698" },
      { emoji: "🎨", label: "Créatif", roleId: "1089167354304405604" },
      { emoji: "⚔️", label: "PVP Box", roleId: "1089167472260817036" },
      { emoji: "☁️", label: "MajestySky", roleId: "1089167408163471482" }
    ]
  },
};