const url = process.argv[2] ?? "https://challenge.place/c/68486e1155cbb0e036a0559f";

const response = await fetch(url);
if (!response.ok) throw new Error(`Challenge responded ${response.status}`);
const html = await response.text();
const marker = "window.__INITIAL_STATE__=";
const start = html.indexOf(marker);
if (start === -1) throw new Error("Initial state marker not found");
const jsonStart = start + marker.length;
const jsonEnd = html.indexOf("</script>", jsonStart);
const state = JSON.parse(html.slice(jsonStart, jsonEnd));
const room = Object.values(state.rooms ?? {})[0] ?? {};

const summarize = (value) => {
  if (!value || typeof value !== "object") return typeof value;
  if (Array.isArray(value)) return `array(${value.length})`;
  return Object.keys(value).slice(0, 20);
};

console.log(JSON.stringify({
  topKeys: Object.keys(state),
  roomKeys: Object.keys(room),
  possibleTransfers: Object.fromEntries(
    Object.entries(room).filter(([key]) => key.toLowerCase().includes("transfer")).map(([key, value]) => [key, summarize(value)]),
  ),
  possibleTransactions: Object.fromEntries(
    Object.entries(room).filter(([key]) => key.toLowerCase().includes("transaction") || key.toLowerCase().includes("movement")).map(([key, value]) => [key, summarize(value)]),
  ),
  transferSample: (room.transfers ?? room.latestTransfers ?? []).slice?.(0, 5),
  playerSample: Object.values(room.players ?? {}).slice(0, 3),
  competitorSample: Object.values(room.competitors ?? {}).slice(0, 3),
}, null, 2));
