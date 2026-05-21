const url = process.argv[2] ?? "https://challenge.place/c/68486e1155cbb0e036a0559f";
const html = await (await fetch(url)).text();
const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
console.log(JSON.stringify({
  transferWordCount: (html.match(/transfers/gi) ?? []).length,
  transferHrefs: hrefs.filter((href) => href.toLowerCase().includes("transfer")),
  seeAllHrefs: hrefs.filter((href) => href.toLowerCase().includes("all")),
}, null, 2));
