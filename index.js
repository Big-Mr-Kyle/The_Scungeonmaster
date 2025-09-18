
// Imports
import {
  Client,
  Events,
  GatewayIntentBits,
  ThreadAutoArchiveDuration,
} from "discord.js";
import { readFileSync, write, writeFileSync } from "node:fs";
import {
  chatter,
  scungeonAboveTable,
  scungeonMemoryUpdate,
  nextRoom,
  memoryWipe,
  updateHealth,
  updateStats,
  updateInventory,
  updateAccomplishments,
} from "./dist/generate.js";

// Load configuration JSON (token, channel, feature flags, etc.)
console.log("[INIT] Loading config.json");
const config = JSON.parse(
  readFileSync(new URL("./config.json", import.meta.url), "utf8")
);

const startTime = Date.now();
console.log("[INIT] Config loaded:", {
  channel_id: config.channel_id,
  enable_bot_responses: config.enable_bot_responses,
  model: config.model_name,
});

// Create Discord client with required intents (message + content access)
console.log("[INIT] Creating Discord client");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Ready event fires once after successful login
client.once(Events.ClientReady, (readyClient) => {
  console.log(
    `[READY] Logged in as ${readyClient.user.tag} after ${
      Date.now() - startTime
    }ms`
  );
});

// Bot authentication
const token = config.token;
console.log("[LOGIN] Attempting Discord login");
client
  .login(token)
  .then(() => console.log("[LOGIN] Login successful"))
  .catch((e) => console.error("[LOGIN] Login failed:", e));

// Concurrency flag to avoid overlapping model calls
let isReady = true;
let gameRunning = false;
let playerName = "";

// Message handler
client.on("messageCreate", async (message) => {
  // Quick shutdown command (owner only suggested)
  if (message.content === "!scungeonQuit") {
    console.log("[SHUTDOWN] Quit command received");
    await message.reply("Shutting down...");
    await client.destroy(); // close WS / cleanup
    process.exit(0); // exit process
  }

  if (message.content === "!scungeonQuitGame") {
    console.log("[COMMAND] !scungeonQuitGame received");
    if (gameRunning === true) {
      gameRunning = false;
      console.log("[STATE] Game ended (quit) -> false");
      writeFileSync(
        new URL("./txt/past_accomplishments.txt", import.meta.url),
        readFileSync(
          new URL("./txt/current_accomplishments.txt", import.meta.url),
          "utf8"
        ),
        "utf8"
      );
      message.reply("Game ended. You can start a new game anytime.");
    } else {
      message.reply("No game is currently running.");
    }

    let thread;
    if (message.channel.isThread()) {
      // Command issued inside the game thread
      thread = message.channel;
    } else {
      // Issued in parent channel; look up by name
      const targetName = `Scungeon - ${message.member?.nickname || message.member?.displayName || message.author.username}`;
      thread = message.channel.threads.cache.find(t => t.name === targetName);
    }

    if (thread) {
      if (!thread.archived) {
        try {
          await thread.setArchived(true, "Game quit");
          console.log("[THREAD] Archived game thread:", thread.id);
        } catch (e) {
          console.error("[ERROR] Failed to archive thread:", e);
        }
      } else {
        console.log("[THREAD] Thread already archived.");
      }
    } else {
      console.warn("[THREAD] Game thread not found to archive.");
    }

    memoryWipe();
    return;
  }

  if (
    message.channel.id === config.channel_id &&
    message.content.includes("!scungeonWipe")
  ) {
    console.log("[COMMAND] !scungeonWipe received");
    try {
      memoryWipe();
      console.log("[MEMORY] Scungeon memory wiped");
      message.reply("Scungeon memory wiped.");
    } catch (e) {
      console.error("[ERROR] Memory wipe failed:", e);
      message.reply("Memory wipe failed.");
    }
    return;
  }

  // Feature flag: disable responses (still collect memory below)
  if (config.enable_bot_responses === false) {
    if (message.author.bot) return;
  }

  if (
    gameRunning === false &&
    message.channel.id === config.channel_id &&
    isReady === true &&
    message.author.id !== config.app_id &&
    (message.content.toLowerCase().includes("scungeonmaster") ||
      message.content.includes("<@" + config.app_id + ">") ||
      (message.reference?.messageId &&
        message.mentions.repliedUser.id === config.app_id)
  )) {
    //this bool is in place to make sure the scungeonmaster isn't interrupted while he's thinking
    isReady = false;

    message.channel.sendTyping();
    let answer = await scungeonAboveTable(
      message.content,
      message.member.nickname
    );
    //basic response
    if (
      message.reference?.messageId &&
      message.mentions.repliedUser.username === "The_ScungeonMaster"
    ) {
      message.reply(answer);
    } else {
      message.channel.send(answer);
    }
    //state tracking for game running
    if (answer.includes("The Game begins anew!")) {
      const thread = await message.channel.threads.create({
        name: `Scungeon - ${message.member.nickname}`,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
        reason: "New game started",
      });
      if (thread.joinable) {
        await thread.join();
        await thread.members.add(message.author.id);
      }
      //reset stats, inventory, health, accomplishments to default
      await writeFileSync(
        new URL("./txt/current_stats.txt", import.meta.url),
        readFileSync(
          new URL("./txt/default_stats.txt", import.meta.url),
          "utf8"
        ),
        "utf8"
      );
      await writeFileSync(
        new URL("./txt/current_inventory.txt", import.meta.url),
        readFileSync(
          new URL("./txt/default_inventory.txt", import.meta.url),
          "utf8"
        ),
        "utf8"
      );
      await writeFileSync(
        new URL("./txt/current_health.txt", import.meta.url),
        readFileSync(
          new URL("./txt/default_health.txt", import.meta.url),
          "utf8"
        ),
        "utf8"
      );
      await writeFileSync(
        new URL("./txt/past_accomplishments.txt", import.meta.url),
        readFileSync(
          new URL("./txt/current_accomplishments.txt", import.meta.url),
          "utf8"
        ),
        "utf8"
      );
      await writeFileSync(
        new URL("./txt/current_accomplishments.txt", import.meta.url),
        readFileSync(
          new URL("./txt/default_accomplishments.txt", import.meta.url),
          "utf8"
        ),
        "utf8"
      );
      memoryWipe();
      let answer = await nextRoom();
      if (
        message.reference?.messageId &&
        message.mentions.repliedUser.username === "The_ScungeonMaster"
      ) {
        message.reply(answer);
      } else {
        const MAX_CHARS = 1800;
        if (answer.length > MAX_CHARS) {
          await thread.send(answer.slice(0, MAX_CHARS));
          await thread.send(answer.slice(MAX_CHARS));
        } else {
          await thread.send(answer);
        }
      }
      gameRunning = true;
      console.log("[STATE] Game started -> true");
      playerName = message.author.id;
      console.log("[STATE] Player name set to ->", message.author.id);
    }

    isReady = true;
    console.log("[STATE] 3 isReady reset -> true");
  } else if (
    !message.content.includes("!scungeonWipe") &&
    (message.channel.id === config.channel_id ||
      (message.channel.isThread() &&
        message.channel.parentId === config.channel_id)) &&
    message.author.id !== config.app_id &&
    gameRunning === false
  ) {
    //I need to make sure that he only does this when the game isn't runnning
    scungeonMemoryUpdate(message.content, message.member.nickname);
    // console.log("ScungeonMaster is ignoring this message.");
    // console.log(isReady);
    isReady = true;
    console.log("[STATE] 4 isReady reset -> true");
    return;
  } else if (
    gameRunning === true &&
    message.channel.parentId === config.channel_id &&
    message.channel.isThread() &&
    message.channel.name === `Scungeon - ${message.member.nickname}` &&
    isReady === true &&
    message.author.id === playerName
    //I think having the player name check and isolating the chat to a thread is sufficient.
    // (message.content.toLowerCase().includes("scungeonmaster") ||
    //   message.content.includes("<@" + config.app_id + ">") ||
    //   (message.reference?.messageId &&
    //     message.mentions.repliedUser.username === "The_Scungeonmaster"))
  ) {
    const thread = message.channel; // already the correct thread
    //this bool is in place to make sure the scungeonmaster isn't interrupted while he's thinking
    isReady = false;
    thread.sendTyping();
    console.log("[PROCESS] Generating response for: " + playerName);
    thread.sendTyping();
    let answer = await chatter(message.content, message.member.nickname);
    //basic response
    const MAX_CHARS = 1800;
    if (message.reference?.messageId) {
      if (answer.length > MAX_CHARS) {
        await thread.send(answer.slice(0, MAX_CHARS));
        await thread.send(answer.slice(MAX_CHARS));
      } else {
        await thread.send(answer);
      }
    } else {
      if (answer.length > MAX_CHARS) {
        await thread.send(answer.slice(0, MAX_CHARS));
        await thread.send(answer.slice(MAX_CHARS));
      } else {
        await thread.send(answer);
      }
    }
    //state tracking for game running
    if (answer.includes("YOU HAVE DIED.")) {
      gameRunning = false;
      await thread.setArchived(true);
      console.log("[STATE] Game ended (death) -> false");
      writeFileSync(
        new URL("./txt/past_accomplishments.txt", import.meta.url),
        readFileSync(
          new URL("./txt/current_accomplishments.txt", import.meta.url),
          "utf8"
        ),
        "utf8"
      );
    }
    if (answer.includes("You have conquered this trial!")) {
      memoryWipe();
      let answer = await nextRoom();
      if (
        message.reference?.messageId &&
        message.mentions.repliedUser.username === "The_ScungeonMaster"
      ) {
        message.reply(answer);
      } else {
        const MAX_CHARS = 1800;
        if (answer.length > MAX_CHARS) {
          await thread.send(answer.slice(0, MAX_CHARS));
          await thread.send(answer.slice(MAX_CHARS));
        } else {
          await thread.send(answer);
        }
      }
    }

    //stats handling (multi-occurrence)
    if (answer.includes("Your stats have changed:")) {
      // Match all occurrences like: Your stats have changed: StatName:Value
      const changedRegex = /Your stats have changed:\s*([^:\n]+):([^\n]+)/g;
      let currentStats = readFileSync(
        new URL("./txt/current_stats.txt", import.meta.url),
        "utf8"
      );
      let statLines = currentStats.split("\n").filter((l) => l.trim() !== "");
      const map = new Map();
      // seed existing
      for (const line of statLines) {
        const [k, v] = line.split(":");
        if (k) map.set(k.trim(), v?.trim() ?? "");
      }
      let match;
      let any = false;
      while ((match = changedRegex.exec(answer)) !== null) {
        const key = match[1].trim();
        const val = match[2].trim();
        map.set(key, val);
        any = true;
        console.log("[UPDATE] (pending) stat changed:", `${key}:${val}`);
      }
      if (any) {
        const out = Array.from(map.entries()).map(([k, v]) => `${k}:${v}`);
        updateStats(out.join("\n"));
        console.log("[UPDATE] Stats file updated with all changes.");
      }
    }
    if (answer.includes("You now have the stat:")) {
      // Match all occurrences like: You now have the stat: StatName:Value
      const newStatRegex = /You now have the stat:\s*([^:\n]+):([^\n]+)/g;
      let currentStats = readFileSync(
        new URL("./txt/current_stats.txt", import.meta.url),
        "utf8"
      );
      let statLines = currentStats.split("\n").filter((l) => l.trim() !== "");
      const map = new Map();
      for (const line of statLines) {
        const [k, v] = line.split(":");
        if (k) map.set(k.trim(), v?.trim() ?? "");
      }
      let match;
      let any = false;
      while ((match = newStatRegex.exec(answer)) !== null) {
        const key = match[1].trim();
        const val = match[2].trim();
        map.set(key, val);
        any = true;
        console.log("[UPDATE] (pending) new stat:", `${key}:${val}`);
      }
      if (any) {
        const out = Array.from(map.entries()).map(([k, v]) => `${k}:${v}`);
        updateStats(out.join("\n"));
        console.log("[UPDATE] Stats file updated with new stats.");
      }
    }
    //inventory handling
    if (answer.includes("You have lost:")) {
      let regex1 = /You have lost:\s*(.+)/;
      let match1 = answer.match(regex1) || [];
      if (match1.length > 0) {
        for (let i = 0; i < match1.length; i++) {
          let currentInventory = readFileSync(
            new URL("./txt/current_inventory.txt", import.meta.url),
            "utf8"
          );
          let newInventory = currentInventory
            .split("\n")
            // Remove any inventory line that contains the lost item substring
            // (previously removed only exact matches)
            .filter((item) => !item.includes(match1[i]))
            .join("\n");
          updateInventory(newInventory);
          console.log("[UPDATE] Inventory updated, removed item:", match1[i]);
        }
      }
    }
    // this is writting the whole line and the item to the file. fix that later.
    if (answer.includes("You have gained an item:")) {
      let regex2 = /You have gained an item:\s*(.+)/;
      let match2 = answer.match(regex2) || [];
      for (let i = 0; i < match2.length; i++) {
        if (match2[i] && match2[i].includes(" and ")) {
          let splitItems = match2[i].split(" and ");
          for (let j = 0; j < splitItems.length; j++) {
            let currentInventory = readFileSync(
              new URL("./txt/current_inventory.txt", import.meta.url),
              "utf8"
            );
            let newInventory = currentInventory + "\n" + splitItems[j];
            updateInventory(newInventory);
            console.log(
              "[UPDATE] Inventory updated with new item:",
              splitItems[j]
            );
          }
          match2[i] = null; // Mark as processed
        } else if (match2[i]) {
          let currentInventory = readFileSync(
            new URL("./txt/current_inventory.txt", import.meta.url),
            "utf8"
          );
          let newInventory = currentInventory + "\n" + match2[i];
          updateInventory(newInventory);
          console.log("[UPDATE] Inventory updated with new item:", match2[i]);
        }
      }
      // if (match2[1]) {
      //   let currentInventory = readFileSync(
      //     new URL("./txt/current_inventory.txt", import.meta.url),
      //     "utf8"
      //   );
      //   let newInventory = currentInventory + "\n" + match2[1];
      //   updateInventory(newInventory);
      //   console.log("[UPDATE] Inventory updated with new item:", match2[1]);
      // }
    }
    //accomplishments handling (multi-occurrence)
    if (answer.includes("You have accomplished:")) {
      const accRegex = /You have accomplished:\s*([^\n]+)/g;
      let currentAccomplishments = readFileSync(
        new URL("./txt/current_accomplishments.txt", import.meta.url),
        "utf8"
      );
      let lines = currentAccomplishments
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l !== "");
      const set = new Set(lines);
      let match;
      let added = false;
      while ((match = accRegex.exec(answer)) !== null) {
        const val = match[1].trim();
        if (!set.has(val)) {
          set.add(val);
          added = true;
          console.log("[UPDATE] (pending) accomplishment:", val);
        }
      }
      if (added) {
        updateAccomplishments(Array.from(set).join("\n"));
        console.log("[UPDATE] Accomplishments file updated.");
      }
    }

    //health handling (multi-occurrence)
    if (answer.includes("You have been afflicted by:")) {
      const afflictAddRegex = /You have been afflicted by:\s*([^\n]+)/g;
      let currentHealth = readFileSync(
        new URL("./txt/current_health.txt", import.meta.url),
        "utf8"
      );
      let lines = currentHealth
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l !== "");
      const set = new Set(lines);
      let match;
      let added = false;
      while ((match = afflictAddRegex.exec(answer)) !== null) {
        const val = match[1].trim();
        if (!set.has(val)) {
          set.add(val);
          added = true;
          console.log("[UPDATE] (pending) affliction added:", val);
        }
      }
      if (added) {
        updateHealth(Array.from(set).join("\n"));
        console.log("[UPDATE] Health file updated (added afflictions).");
      }
    }
    if (answer.includes("You are no longer afflicted by:")) {
      const afflictRemoveRegex = /You are no longer afflicted by:\s*([^\n]+)/g;
      let currentHealth = readFileSync(
        new URL("./txt/current_health.txt", import.meta.url),
        "utf8"
      );
      let lines = currentHealth
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l !== "");
      const toRemove = new Set();
      let match;
      let removed = false;
      while ((match = afflictRemoveRegex.exec(answer)) !== null) {
        toRemove.add(match[1].trim());
      }
      if (toRemove.size > 0) {
        const newLines = lines.filter((l) => !toRemove.has(l));
        if (newLines.length !== lines.length) {
          removed = true;
          updateHealth(newLines.join("\n"));
          console.log(
            "[UPDATE] Health file updated (removed afflictions):",
            Array.from(toRemove).join(", ")
          );
        }
      }
    }
    isReady = true;
  }
  isReady = true;
  console.log("[STATE] 5 isReady reset -> true");
  return;
});
// End of file
console.log("[INIT] index.js loaded and events registered.");
