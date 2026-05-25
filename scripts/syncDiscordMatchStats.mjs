import dotenv from "dotenv";
import path from "node:path";
import { Client, GatewayIntentBits } from "discord.js";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const RESULTS_CHANNEL_ID = process.env.DISCORD_RESULTS_CHANNEL_ID;
const SINCE = new Date(process.env.DISCORD_IMPORT_SINCE);

if (!SUPABASE_URL) throw new Error("Falta VITE_SUPABASE_URL en .env.local");
if (!SUPABASE_KEY) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY o VITE_SUPABASE_ANON_KEY");
if (!RESULTS_CHANNEL_ID) throw new Error("Falta DISCORD_RESULTS_CHANNEL_ID en .env.local");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const addStat = (map, playerName, key, amount = 1) => {
  const cleanName = String(playerName ?? "")
    .replace(/[📊⚽🧤🟨🟥🔴🔵⚪🟢🟡🟣🟠]/g, "")
    .replace(/[.:]+$/g, "")
    .trim();

  if (!cleanName || /^ninguna$/i.test(cleanName)) return;

  const id = normalize(cleanName);

  if (!map.has(id)) {
    map.set(id, {
      playerName: cleanName,
      minutes: 0,
      goals: 0,
      assists: 0,
      keyPasses: 0,
      shotsOnTarget: 0,
      boxEntries: 0,
      goalsConceded: 0,
      ballsLost: 0,
      ballsRecovered: 0,
      clearances: 0,
      penaltiesScored: 0,
      penaltiesMissed: 0,
      penaltiesProvoked: 0,
      yellowCards: 0,
      doubleYellowCards: 0,
      redCards: 0,
      ownGoals: 0,
      saves: 0,
      overloadScore: null,
      overloadRating: 0,
    });
  }

  map.get(id)[key] = Number(map.get(id)[key] ?? 0) + Number(amount);
};

const parseMatch = (text) => {
  const stats = new Map();

  const finalMatch =
    text.match(/RESULTADO FINAL[\s\S]*?\n\s*[🔵🔴⚪⚫🟢🟡🟣🟠]*\s*(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+?)(?:\n|$)/i) ||
    text.match(/[🔵🔴⚪⚫🟢🟡🟣🟠]*\s*([A-Za-zÀ-ÿ0-9 .'-]+?)\s+(\d+)\s*-\s*(\d+)\s+[🔵🔴⚪⚫🟢🟡🟣🟠]*\s*([A-Za-zÀ-ÿ0-9 .'-]+)(?:\n|$)/i);

  if (!finalMatch) return null;

  const homeTeam = finalMatch[1].trim();
  const homeScore = Number(finalMatch[2]);
  const awayScore = Number(finalMatch[3]);
  const awayTeam = finalMatch[4].trim();

  const goalSection =
    text.match(/⚽\s*GOLES[\s\S]*?(?=🟨|🟥|━━━━━━━━|$)/i)?.[0] ?? "";

  for (const match of goalSection.matchAll(/^[^\nA-Za-zÀ-ÿ]*([A-Za-zÀ-ÿ0-9 '\-.]+?)\s*\(/gmu)) {
    addStat(stats, match[1], "goals", 1);
  }

  for (const match of text.matchAll(/🧤\s*([A-Za-zÀ-ÿ0-9 '\-.]+)/gu)) {
    addStat(stats, match[1], "saves", 1);
  }

  for (const match of text.matchAll(/🟨\s*([A-Za-zÀ-ÿ0-9 '\-.]+)/gu)) {
    addStat(stats, match[1], "yellowCards", 1);
  }

  for (const match of text.matchAll(/🟥\s*([A-Za-zÀ-ÿ0-9 '\-.]+)/gu)) {
    addStat(stats, match[1], "redCards", 1);
  }

  for (const match of text.matchAll(/\b([A-Za-zÀ-ÿ0-9 '\-.]+?)\s+(?:roba|recupera|intercepta)/giu)) {
    addStat(stats, match[1], "ballsRecovered", 1);
  }

  for (const match of text.matchAll(/\b([A-Za-zÀ-ÿ0-9 '\-.]+?)\s+(?:pierde el balón|pierde la pelota|regala el balón)/giu)) {
    addStat(stats, match[1], "ballsLost", 1);
  }

  for (const match of text.matchAll(/\b([A-Za-zÀ-ÿ0-9 '\-.]+?)\s+(?:despeja|aleja el peligro|saca el balón)/giu)) {
    addStat(stats, match[1], "clearances", 1);
  }

  for (const match of text.matchAll(/\b([A-Za-zÀ-ÿ0-9 '\-.]+?)\s+(?:filtra|centra|asiste|pase perfecto|pase vertical|encuentra hueco|encuentra espacio)/giu)) {
    addStat(stats, match[1], "keyPasses", 1);
  }

  for (const match of text.matchAll(/⚽\s*([A-Za-zÀ-ÿ0-9 '\-.]+)[\s\S]{0,80}?(?:disparo|remate)/giu)) {
    addStat(stats, match[1], "shotsOnTarget", 1);
  }

  for (const match of text.matchAll(/\b([A-Za-zÀ-ÿ0-9 '\-.]+?)\s+(?:entra al área|llega al área|rompe hacia dentro|aparece en el área)/giu)) {
    addStat(stats, match[1], "boxEntries", 1);
  }

  for (const stat of stats.values()) {
    if (
      stat.goals ||
      stat.saves ||
      stat.keyPasses ||
      stat.shotsOnTarget ||
      stat.ballsRecovered ||
      stat.yellowCards ||
      stat.redCards
    ) {
      stat.minutes = 90;
    }
  }

  return {
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    playerStats: [...stats.values()],
  };
};

discord.once("clientReady", async () => {
  console.log("Bot conectado");

  const channel = await discord.channels.fetch(RESULTS_CHANNEL_ID);

  const messages = await channel.messages.fetch({ limit: 100 });

  const orderedMessages = [...messages.values()]
    .reverse()
    .filter((message) => message.createdAt >= SINCE);

  console.log("Mensajes leídos:", orderedMessages.length);

  const fullText = orderedMessages
    .map((message) => message.content)
    .join("\n\n");

  console.log("Texto unido:", fullText.slice(0, 1000));

  const parsed = parseMatch(fullText);

  if (!parsed) {
    console.log("No parseado texto unido");
    await discord.destroy();
    process.exit(0);
  }

  console.log(`${parsed.homeTeam} ${parsed.homeScore}-${parsed.awayScore} ${parsed.awayTeam}`);
  console.log(parsed.playerStats);

  const { error } = await supabase.from("official_matches").insert({
  home_team: parsed.homeTeam,
  away_team: parsed.awayTeam,
  home_score: parsed.homeScore,
  away_score: parsed.awayScore,
  player_stats_json: parsed.playerStats,
});

  if (error) {
    console.error("Error Supabase:", error);
  } else {
    console.log("Partido guardado");
  }

  await discord.destroy();
  process.exit(0);
});

discord.login(process.env.DISCORD_BOT_TOKEN);