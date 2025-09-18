import { Ollama } from "ollama";
import { readFileSync } from "node:fs";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log("[INIT] Loading config.json");
//update these later with the 'current' files instead of the defaults
const bigPrompt = readFileSync(path.join(__dirname, "..", "txt", "systemPromptRunning.txt"), "utf8");
const bigBits = bigPrompt.split("\n");
let healthPrompt = readFileSync(path.join(__dirname, "..", "txt", "current_health.txt"), "utf8");
let inventoryPrompt = readFileSync(path.join(__dirname, "..", "txt", "current_inventory.txt"), "utf8");
let statsPrompt = readFileSync(path.join(__dirname, "..", "txt", "current_stats.txt"), "utf8");
let accomplishmentsPrompt = readFileSync(path.join(__dirname, "..", "txt", "current_accomplishments.txt"), "utf8");
//this doesn't load the txts after they update, need to fix that.
let biggerPrompt = `${bigBits[0]}\n${statsPrompt}\n${bigBits[1]}\n${inventoryPrompt}\n${bigBits[2]}\n${healthPrompt}\n${bigBits[3]}\n${accomplishmentsPrompt}\n${bigBits[4]}\n${bigBits[5]}\n${bigBits[6]}\n${bigBits[7]}\n${bigBits[8]}\n${bigBits[9]}\n${bigBits[10]}\n${bigBits[11]}\n${bigBits[12]}\n${bigBits[13]}\n${bigBits[14]}`;
const configPath = path.join(__dirname, "..", "config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const sysPrompt = config.system_prompt;
const topBorder = readFileSync(path.join(__dirname, "..", "txt", "top_border.txt"), "utf8");
const bottomBorder = readFileSync(path.join(__dirname, "..", "txt", "bottom_border.txt"), "utf8");
let messageMemory = [];
export async function nextRoom() {
    const ollama = new Ollama();
    healthPrompt = await readFileSync(path.join(__dirname, "..", "txt", "current_health.txt"), "utf8");
    inventoryPrompt = await readFileSync(path.join(__dirname, "..", "txt", "current_inventory.txt"), "utf8");
    statsPrompt = await readFileSync(path.join(__dirname, "..", "txt", "current_stats.txt"), "utf8");
    accomplishmentsPrompt = await readFileSync(path.join(__dirname, "..", "txt", "current_accomplishments.txt"), "utf8");
    biggerPrompt = `${bigBits[0]}\n${statsPrompt}\n${bigBits[1]}\n${inventoryPrompt}\n${bigBits[2]}\n${healthPrompt}\n${bigBits[3]}\n${accomplishmentsPrompt}\n${bigBits[4]}\n${bigBits[5]}\n${bigBits[6]}\n${bigBits[7]}\n${bigBits[8]}\n${bigBits[9]}\n${bigBits[10]}\n${bigBits[11]}\n${bigBits[12]}\n${bigBits[13]}\n${bigBits[14]}`;
    const response = await ollama.generate({
        model: config.model_name,
        prompt: biggerPrompt +
            "\nThe user has just entered a new room in the dungeon. Describe what they see.",
    });
    const reply = response.response ?? "(no response)";
    const finalReply = topBorder + "\n" + reply + "\n" + bottomBorder;
    console.log(finalReply);
    messageMemory.push({ role: "assistant", content: response.response || "" });
    console.log(response?.response ?? "(no response)");
    return finalReply;
}
export async function chatter(userInput = "(says nothing, takes no action)", userName = "User") {
    const ollama = new Ollama();
    healthPrompt = readFileSync(path.join(__dirname, "..", "txt", "current_health.txt"), "utf8");
    inventoryPrompt = readFileSync(path.join(__dirname, "..", "txt", "current_inventory.txt"), "utf8");
    statsPrompt = readFileSync(path.join(__dirname, "..", "txt", "current_stats.txt"), "utf8");
    accomplishmentsPrompt = readFileSync(path.join(__dirname, "..", "txt", "current_accomplishments.txt"), "utf8");
    biggerPrompt = `${bigBits[0]}\n${statsPrompt}\n${bigBits[1]}\n${inventoryPrompt}\n${bigBits[2]}\n${healthPrompt}\n${bigBits[3]}\n${accomplishmentsPrompt}\n${bigBits[4]}\n${bigBits[5]}\n${bigBits[6]}\n${bigBits[7]}\n${bigBits[8]}\n${bigBits[9]}\n${bigBits[10]}\n${bigBits[11]}\n${bigBits[12]}\n${bigBits[13]}\n${bigBits[14]}`;
    // Regular response
    const response = await ollama.chat({
        model: config.model_name,
        messages: [
            { role: "system", content: biggerPrompt },
            ...messageMemory,
            { role: "user", content: `${userName}: ${userInput}` },
        ],
    });
    const reply = response?.message?.content ?? "(no response)";
    const finalReply = topBorder + "\n" + reply + "\n" + bottomBorder;
    console.log(finalReply);
    messageMemory.push({ role: "user", content: `${userName}: ${userInput}` }, { role: "assistant", content: response.message?.content || "" });
    return finalReply;
}
export async function scungeonAboveTable(userInput = "(says nothing, takes no action)", userName = "User") {
    const ollama = new Ollama();
    const response = await ollama.chat({
        model: config.model_name,
        messages: [
            { role: "system", content: sysPrompt },
            ...messageMemory,
            { role: "user", content: `${userName}: ${userInput}` },
        ],
    });
    const reply = response?.message?.content ?? "(no response)";
    console.log(reply);
    messageMemory.push({ role: "user", content: `${userName}: ${userInput}` }, { role: "assistant", content: response.message?.content || "" });
    return reply;
}
export async function memoryWipe() {
    messageMemory = [];
    return;
}
export function updateHealth(newHealth) {
    writeFileSync(path.join(__dirname, "..", "txt", "current_health.txt"), newHealth, "utf8");
    healthPrompt = readFileSync(path.join(__dirname, "..", "txt", "current_health.txt"), "utf8");
}
export function updateStats(newStats) {
    writeFileSync(path.join(__dirname, "..", "txt", "current_stats.txt"), newStats, "utf8");
    statsPrompt = readFileSync(path.join(__dirname, "..", "txt", "current_stats.txt"), "utf8");
}
export function updateInventory(newInventory) {
    writeFileSync(path.join(__dirname, "..", "txt", "current_inventory.txt"), newInventory, "utf8");
    inventoryPrompt = readFileSync(path.join(__dirname, "..", "txt", "current_inventory.txt"), "utf8");
}
export function updateAccomplishments(newAccomplishments) {
    writeFileSync(path.join(__dirname, "..", "txt", "current_accomplishments.txt"), newAccomplishments, "utf8");
    accomplishmentsPrompt = readFileSync(path.join(__dirname, "..", "txt", "current_accomplishments.txt"), "utf8");
}
export async function scungeonMemoryUpdate(userInput, userNameInput) {
    messageMemory.push({
        role: "user",
        content: `${userNameInput}: ${userInput}`,
    });
    return;
}
