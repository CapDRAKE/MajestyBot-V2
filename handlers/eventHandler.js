const fs = require("fs");
const path = require("path");

function loadEvents(client) {
  const eventsPath = path.join(__dirname, "..", "events");
  const files = fs.readdirSync(eventsPath).filter(f => f.endsWith(".js"));

  for (const file of files) {
    const event = require(path.join(eventsPath, file));
    if (!event?.name || typeof event.execute !== "function") continue;

    if (event.once) {
      client.once(event.name, (...args) => event.execute(client, ...args));
    } else {
      client.on(event.name, (...args) => event.execute(client, ...args));
    }
  }

  console.log(`✅ Loaded ${files.length} events`);
}

module.exports = { loadEvents };