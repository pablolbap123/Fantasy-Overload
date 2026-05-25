// Fichajes realizados a partir del 11/05/2026 (después de la jornada 6).
// Para jornadas 1-6, estos jugadores deben mostrarse con su equipo ANTERIOR.
// Generado a partir de las capturas del historial de transferencias de Challenge.
//
// effectiveFromMatchday: 7 para fichajes del 15/05/2026 y 21/05/2026
// effectiveFromMatchday: 7 para fichajes del 19/05/2026 (Mehr, Droll, Rhine, Darehn)

export interface TransferOverride {
  playerId: string;
  /** Equipo actual (al que llegó, ya reflejado en los datos del sistema) */
  newTeamId: string;
  newTeamName: string;
  /** Equipo anterior (el que tenía en jornadas 1-6) */
  previousTeamId: string;
  previousTeamName: string;
  /** Primera jornada en la que ya juega con el nuevo equipo */
  effectiveFromMatchday: number;
}

export const transferOverrides: TransferOverride[] = [
  // ── 21/05/2026 ─ Bolsa → nuevo club ─────────────────────────────────────
  { playerId: "player-69aad2e8f1d58c27ec8ecdad", newTeamId: "team-lyo",  newTeamName: "Olympique de Lyon",      previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Crocodile
  { playerId: "player-6963c70921c1166719eeacb1", newTeamId: "team-mar",  newTeamName: "Olympique de Marsella",  previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Banzlay
  { playerId: "player-68486e4bce4b47e756479feb", newTeamId: "team-mar",  newTeamName: "Olympique de Marsella",  previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Mike
  { playerId: "player-690cf385fe4def64bac5dbec", newTeamId: "team-psg",  newTeamName: "PSG",                    previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Azrael
  { playerId: "player-69944a7fc0f68d6fa11e1dfa", newTeamId: "team-juv",  newTeamName: "Juventus",               previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Alexi
  { playerId: "player-685d5f01e9f378d6b07a530a", newTeamId: "team-juv",  newTeamName: "Juventus",               previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Amdu
  { playerId: "player-69971e88663645950e0e6397", newTeamId: "team-lev",  newTeamName: "Bayer Leverkusen",       previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Kuster
  { playerId: "player-68486e4bce4b47e756479f1f", newTeamId: "team-bay",  newTeamName: "Bayern Münich",          previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Jean-Luc Janeway
  { playerId: "player-699c76456d141383e55bc28e", newTeamId: "team-mun",  newTeamName: "Manchester United",      previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Alia Pavey
  { playerId: "player-68486e4bce4b47e756479fef", newTeamId: "team-mun",  newTeamName: "Manchester United",      previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Obscura
  { playerId: "player-690cf3143a5979417f9d0557", newTeamId: "team-mci",  newTeamName: "Manchester City",        previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Eisberg
  { playerId: "player-69867362eed6e169e68fa3f4", newTeamId: "team-ath",  newTeamName: "Athletic Club",          previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Occifer
  { playerId: "player-6903e2db3bd748acb863eac8", newTeamId: "team-ath",  newTeamName: "Athletic Club",          previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Skipper
  { playerId: "player-699c7cafd6f7817874da531e", newTeamId: "team-ben",  newTeamName: "Benfica",                previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Tonto
  { playerId: "player-69922eac85dd029e33e1e3f7", newTeamId: "team-ben",  newTeamName: "Benfica",                previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Lilia
  { playerId: "player-68486e4bce4b47e75647a010", newTeamId: "team-dor",  newTeamName: "Borussia Dortmund",      previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Krypto
  { playerId: "player-685e61f3d0ea2db3ed5b2fce", newTeamId: "team-nap",  newTeamName: "Napoli",                 previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Belphegor
  { playerId: "player-685002d707850364582b69fb", newTeamId: "team-nap",  newTeamName: "Napoli",                 previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Pazuzu
  { playerId: "player-68486e4bce4b47e756479f51", newTeamId: "team-liv",  newTeamName: "Liverpool",              previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Kidd
  { playerId: "player-6997059f409e57cdd3151502", newTeamId: "team-che",  newTeamName: "Chelsea",                previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Narcisse

  // ── 21/05/2026 ─ Entre clubes ───────────────────────────────────────────
  { playerId: "player-699c616af6546d4feed13c98", newTeamId: "team-fcb",  newTeamName: "Barcelona",              previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Cricket
  { playerId: "player-69946c665db4258925b2067a", newTeamId: "team-atm",  newTeamName: "Atlético de Madrid",     previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Trixie
  { playerId: "player-6994470df9246e1365534c57", newTeamId: "team-rma",  newTeamName: "Real Madrid",            previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Esau Tariq
  { playerId: "player-69287417a6d5971dc9f15e88", newTeamId: "team-rma",  newTeamName: "Real Madrid",            previousTeamId: "team-blsa", previousTeamName: "Bolsa de Jugadores", effectiveFromMatchday: 7 },  // Nev Erin
  { playerId: "player-68486e4bce4b47e75647a00a", newTeamId: "team-rma",  newTeamName: "Real Madrid",            previousTeamId: "team-nap",  previousTeamName: "Napoli",             effectiveFromMatchday: 7 },  // Bala: Napoles → Real Madrid
  { playerId: "player-68486e4bce4b47e756479de6", newTeamId: "team-nap",  newTeamName: "Napoli",                 previousTeamId: "team-rma",  previousTeamName: "Real Madrid",        effectiveFromMatchday: 7 },  // Julieta: Real Madrid → Napoles
  { playerId: "player-68486e4bce4b47e75647a078", newTeamId: "team-mun",  newTeamName: "Manchester United",      previousTeamId: "team-lyo",  previousTeamName: "Olympique de Lyon",  effectiveFromMatchday: 7 },  // Starkey: Lyon → Man Utd
  { playerId: "player-68486e4bce4b47e75647a005", newTeamId: "team-fey",  newTeamName: "Feyenoord",              previousTeamId: "team-lev",  previousTeamName: "Bayer Leverkusen",   effectiveFromMatchday: 7 },  // Frank: Leverkusen → Feyenoord
  { playerId: "player-699231638334d431b34397d2", newTeamId: "team-lev",  newTeamName: "Bayer Leverkusen",       previousTeamId: "team-fey",  previousTeamName: "Feyenoord",          effectiveFromMatchday: 7 },  // Crimson: Feyenoord → Leverkusen
  { playerId: "player-68486e4bce4b47e756479dde", newTeamId: "team-fcb",  newTeamName: "Barcelona",              previousTeamId: "team-ath",  previousTeamName: "Athletic Club",      effectiveFromMatchday: 7 },  // Almeida: Athletic → Barcelona
  { playerId: "player-68486e4bce4b47e756479e19", newTeamId: "team-ath",  newTeamName: "Athletic Club",          previousTeamId: "team-fcb",  previousTeamName: "Barcelona",          effectiveFromMatchday: 7 },  // Joan Asensi: Barcelona → Athletic
  { playerId: "player-68486e4bce4b47e75647a025", newTeamId: "team-rom",  newTeamName: "AS Roma",                previousTeamId: "team-oly",  previousTeamName: "Olympiakos",         effectiveFromMatchday: 7 },  // Willow Proude: Olympiakos → Roma
  { playerId: "player-699230877b4555b9bda1d180", newTeamId: "team-oly",  newTeamName: "Olympiakos",             previousTeamId: "team-rom",  previousTeamName: "AS Roma",            effectiveFromMatchday: 7 },  // Rogers: Roma → Olympiakos
  { playerId: "player-68486e4bce4b47e75647a0b7", newTeamId: "team-mar",  newTeamName: "Olympique de Marsella",  previousTeamId: "team-ars",  previousTeamName: "Arsenal",            effectiveFromMatchday: 7 },  // Scotty: Arsenal → Marsella
  { playerId: "player-68486e4bce4b47e75647a0a4", newTeamId: "team-ars",  newTeamName: "Arsenal",                previousTeamId: "team-mar",  previousTeamName: "Olympique de Marsella", effectiveFromMatchday: 7 },  // Emerico Lorca: Marsella → Arsenal
  { playerId: "player-68486e4bce4b47e756479dfe", newTeamId: "team-lyo",  newTeamName: "Olympique de Lyon",      previousTeamId: "team-mun",  previousTeamName: "Manchester United",  effectiveFromMatchday: 7 },  // Kappa: Man Utd → Lyon
  { playerId: "player-68486e4bce4b47e756479e5a", newTeamId: "team-mar",  newTeamName: "Olympique de Marsella",  previousTeamId: "team-juv",  previousTeamName: "Juventus",           effectiveFromMatchday: 7 },  // Díaz: Juventus → Marsella
  { playerId: "player-68486e4bce4b47e75647a026", newTeamId: "team-juv",  newTeamName: "Juventus",               previousTeamId: "team-mar",  previousTeamName: "Olympique de Marsella", effectiveFromMatchday: 7 },  // Wenel: Marsella → Juventus
  { playerId: "player-68486e4bce4b47e756479dea", newTeamId: "team-mar",  newTeamName: "Olympique de Marsella",  previousTeamId: "team-che",  previousTeamName: "Chelsea",            effectiveFromMatchday: 7 },  // Falcao Da Silva: Chelsea → Marsella
  { playerId: "player-68486e4bce4b47e75647a086", newTeamId: "team-che",  newTeamName: "Chelsea",                previousTeamId: "team-mar",  previousTeamName: "Olympique de Marsella", effectiveFromMatchday: 7 },  // Luceafar: Marsella → Chelsea
  { playerId: "player-68486e4bce4b47e75647a09f", newTeamId: "team-juv",  newTeamName: "Juventus",               previousTeamId: "team-s04",  previousTeamName: "Schalke 04",         effectiveFromMatchday: 7 },  // Dost Gales: Schalke → Juventus
  { playerId: "player-69922fccdab44c3798532277", newTeamId: "team-s04",  newTeamName: "Schalke 04",             previousTeamId: "team-juv",  previousTeamName: "Juventus",           effectiveFromMatchday: 7 },  // Loathe: Juventus → Schalke
  { playerId: "player-68486e4bce4b47e756479ffa", newTeamId: "team-atm",  newTeamName: "Atlético de Madrid",     previousTeamId: "team-int",  previousTeamName: "Inter de Milan",     effectiveFromMatchday: 7 },  // Piers Thompson: Inter → Atlético
  { playerId: "player-68486e4bce4b47e756479f2b", newTeamId: "team-int",  newTeamName: "Inter de Milan",         previousTeamId: "team-atm",  previousTeamName: "Atlético de Madrid",  effectiveFromMatchday: 7 },  // Meenan: Atlético → Inter
  { playerId: "player-68486e4bce4b47e75647a0d0", newTeamId: "team-liv",  newTeamName: "Liverpool",              previousTeamId: "team-psg",  previousTeamName: "PSG",                effectiveFromMatchday: 7 },  // Icer: PSG → Liverpool
  { playerId: "player-68486e4bce4b47e756479e4a", newTeamId: "team-psg",  newTeamName: "PSG",                    previousTeamId: "team-liv",  previousTeamName: "Liverpool",          effectiveFromMatchday: 7 },  // Buckingham: Liverpool → PSG
  { playerId: "player-6992317f489a7b887d2ce308", newTeamId: "team-bay",  newTeamName: "Bayern Münich",          previousTeamId: "team-mil",  previousTeamName: "AC Milan",           effectiveFromMatchday: 7 },  // Harper: AC Milan → Bayern
  { playerId: "player-6992309b19491beeb353496e", newTeamId: "team-mil",  newTeamName: "AC Milan",               previousTeamId: "team-bay",  previousTeamName: "Bayern Münich",      effectiveFromMatchday: 7 },  // Thaddeus: Bayern → AC Milan
  { playerId: "player-68486e4bce4b47e75647a00e", newTeamId: "team-tot",  newTeamName: "Tottenham",              previousTeamId: "team-fcb",  previousTeamName: "Barcelona",          effectiveFromMatchday: 7 },  // Betelgeuse: Barcelona → Tottenham
  { playerId: "player-69922f4632694b82e199fb58", newTeamId: "team-fcb",  newTeamName: "Barcelona",              previousTeamId: "team-tot",  previousTeamName: "Tottenham",          effectiveFromMatchday: 7 },  // Clement: Tottenham → Barcelona
  { playerId: "player-68486e4bce4b47e756479fbe", newTeamId: "team-mil",  newTeamName: "AC Milan",               previousTeamId: "team-mci",  previousTeamName: "Manchester City",    effectiveFromMatchday: 7 },  // Sebastián Forthwright: Man City → AC Milan
  { playerId: "player-68486e4bce4b47e75647a087", newTeamId: "team-mci",  newTeamName: "Manchester City",        previousTeamId: "team-mil",  previousTeamName: "AC Milan",           effectiveFromMatchday: 7 },  // Tyrah: AC Milan → Man City
  { playerId: "player-68486e4bce4b47e75647a0ae", newTeamId: "team-ath",  newTeamName: "Athletic Club",          previousTeamId: "team-por",  previousTeamName: "Oporto",             effectiveFromMatchday: 7 },  // Zephyr Vitesse: Oporto → Athletic
  { playerId: "player-68486e4bce4b47e756479fd6", newTeamId: "team-por",  newTeamName: "Oporto",                 previousTeamId: "team-ath",  previousTeamName: "Athletic Club",      effectiveFromMatchday: 7 },  // Marco Maserati: Athletic → Oporto
  { playerId: "player-699231215af6640949e5e82c", newTeamId: "team-oly",  newTeamName: "Olympiakos",             previousTeamId: "team-fey",  previousTeamName: "Feyenoord",          effectiveFromMatchday: 7 },  // Darian: Feyenoord → Olympiakos
  { playerId: "player-6992312f4177d9f2b85d1a2d", newTeamId: "team-fey",  newTeamName: "Feyenoord",              previousTeamId: "team-oly",  previousTeamName: "Olympiakos",         effectiveFromMatchday: 7 },  // Yoshizaki: Olympiakos → Feyenoord
  { playerId: "player-68486e4bce4b47e756479fda", newTeamId: "team-lev",  newTeamName: "Bayer Leverkusen",       previousTeamId: "team-aja",  previousTeamName: "Ajax",               effectiveFromMatchday: 7 },  // Yale: Ajax → Leverkusen
  { playerId: "player-69922fc8f9246e136587a012", newTeamId: "team-aja",  newTeamName: "Ajax",                   previousTeamId: "team-lev",  previousTeamName: "Bayer Leverkusen",   effectiveFromMatchday: 7 },  // Singleton: Leverkusen → Ajax

  // ── 19/05/2026 ──────────────────────────────────────────────────────────
  { playerId: "player-68486e4bce4b47e75647a01f", newTeamId: "team-dor",  newTeamName: "Borussia Dortmund",      previousTeamId: "team-tot",  previousTeamName: "Tottenham",          effectiveFromMatchday: 7 },  // Mehr: Tottenham → Dortmund
  { playerId: "player-68486e4bce4b47e75647a0d5", newTeamId: "team-tot",  newTeamName: "Tottenham",              previousTeamId: "team-dor",  previousTeamName: "Borussia Dortmund",  effectiveFromMatchday: 7 },  // Droll: Dortmund → Tottenham
  { playerId: "player-68486e4bce4b47e756479f47", newTeamId: "team-dor",  newTeamName: "Borussia Dortmund",      previousTeamId: "team-ben",  previousTeamName: "Benfica",            effectiveFromMatchday: 7 },  // Rhine: Benfica → Dortmund
  { playerId: "player-69de8515089e4b671d8f2b66", newTeamId: "team-ben",  newTeamName: "Benfica",                previousTeamId: "team-dor",  previousTeamName: "Borussia Dortmund",  effectiveFromMatchday: 7 },  // Darehn: Dortmund → Benfica

  // ── 15/05/2026 ──────────────────────────────────────────────────────────
  { playerId: "player-68486e4bce4b47e756479fc4", newTeamId: "team-ars",  newTeamName: "Arsenal",                previousTeamId: "team-val",  previousTeamName: "Valencia",           effectiveFromMatchday: 7 },  // Austin: Valencia → Arsenal
  { playerId: "player-69922f6d232f90c18a964402", newTeamId: "team-val",  newTeamName: "Valencia",               previousTeamId: "team-ars",  previousTeamName: "Arsenal",            effectiveFromMatchday: 7 },  // Talon: Arsenal → Valencia
  { playerId: "player-68486e4bce4b47e756479e35", newTeamId: "team-oly",  newTeamName: "Olympiakos",             previousTeamId: "team-lyo",  previousTeamName: "Olympique de Lyon",  effectiveFromMatchday: 7 },  // Iggie Loo: Lyon → Olympiakos
  { playerId: "player-699231368f33d6d4aebec347", newTeamId: "team-lyo",  newTeamName: "Olympique de Lyon",      previousTeamId: "team-oly",  previousTeamName: "Olympiakos",         effectiveFromMatchday: 7 },  // Lyndalyn: Olympiakos → Lyon
  { playerId: "player-68486e4bce4b47e75647a0b5", newTeamId: "team-liv",  newTeamName: "Liverpool",              previousTeamId: "team-fcb",  previousTeamName: "Barcelona",          effectiveFromMatchday: 7 },  // Salvador Castell: Barcelona → Liverpool
  { playerId: "player-68486e4bce4b47e756479df6", newTeamId: "team-fcb",  newTeamName: "Barcelona",              previousTeamId: "team-liv",  previousTeamName: "Liverpool",          effectiveFromMatchday: 7 },  // Terry: Liverpool → Barcelona
  { playerId: "player-699230d9999ccd1bd7dc2e45", newTeamId: "team-bay",  newTeamName: "Bayern Münich",          previousTeamId: "team-ben",  previousTeamName: "Benfica",            effectiveFromMatchday: 7 },  // Anastasia: Benfica → Bayern
  { playerId: "player-68486e4bce4b47e756479e3d", newTeamId: "team-ben",  newTeamName: "Benfica",                previousTeamId: "team-bay",  previousTeamName: "Bayern Münich",      effectiveFromMatchday: 7 },  // Eagle: Bayern → Benfica
  { playerId: "player-68486e4bce4b47e75647a07a", newTeamId: "team-liv",  newTeamName: "Liverpool",              previousTeamId: "team-mun",  previousTeamName: "Manchester United",  effectiveFromMatchday: 7 },  // Destra: Man Utd → Liverpool
  { playerId: "player-68486e4bce4b47e756479f5a", newTeamId: "team-mun",  newTeamName: "Manchester United",      previousTeamId: "team-liv",  previousTeamName: "Liverpool",          effectiveFromMatchday: 7 },  // Soundtown: Liverpool → Man Utd
  { playerId: "player-69de7dfbe81e2ddf15cc166f", newTeamId: "team-bay",  newTeamName: "Bayern Münich",          previousTeamId: "team-rom",  previousTeamName: "AS Roma",            effectiveFromMatchday: 7 },  // Giacomo: Roma → Bayern
  { playerId: "player-68486e4bce4b47e756479f5d", newTeamId: "team-rom",  newTeamName: "AS Roma",                previousTeamId: "team-bay",  previousTeamName: "Bayern Münich",      effectiveFromMatchday: 7 },  // Lucas Skywalk: Bayern → Roma
  { playerId: "player-68486e4bce4b47e75647a041", newTeamId: "team-rom",  newTeamName: "AS Roma",                previousTeamId: "team-int",  previousTeamName: "Inter de Milan",     effectiveFromMatchday: 7 },  // Kevin: Inter → Roma
  { playerId: "player-68486e4bce4b47e75647a0bb", newTeamId: "team-int",  newTeamName: "Inter de Milan",         previousTeamId: "team-rom",  previousTeamName: "AS Roma",            effectiveFromMatchday: 7 },  // Yoga: Roma → Inter
  { playerId: "player-68486e4bce4b47e75647a020", newTeamId: "team-juv",  newTeamName: "Juventus",               previousTeamId: "team-lyo",  previousTeamName: "Olympique de Lyon",  effectiveFromMatchday: 7 },  // Arthur: Lyon → Juventus
  { playerId: "player-68486e4bce4b47e756479e0d", newTeamId: "team-lyo",  newTeamName: "Olympique de Lyon",      previousTeamId: "team-juv",  previousTeamName: "Juventus",           effectiveFromMatchday: 7 },  // Torch: Juventus → Lyon
  { playerId: "player-699230935af6640949e45082", newTeamId: "team-s04",  newTeamName: "Schalke 04",             previousTeamId: "team-mil",  previousTeamName: "AC Milan",           effectiveFromMatchday: 7 },  // Ciro: AC Milan → Schalke
  { playerId: "player-68486e4bce4b47e75647a008", newTeamId: "team-mil",  newTeamName: "AC Milan",               previousTeamId: "team-s04",  previousTeamName: "Schalke 04",         effectiveFromMatchday: 7 },  // Clario: Schalke → AC Milan
  { playerId: "player-68486e4bce4b47e75647a04f", newTeamId: "team-psg",  newTeamName: "PSG",                    previousTeamId: "team-s04",  previousTeamName: "Schalke 04",         effectiveFromMatchday: 7 },  // Viktor Sedov: Schalke → PSG
  { playerId: "player-68486e4bce4b47e756479e2e", newTeamId: "team-s04",  newTeamName: "Schalke 04",             previousTeamId: "team-psg",  previousTeamName: "PSG",                effectiveFromMatchday: 7 },  // Octavus Kraken: PSG → Schalke
  { playerId: "player-68486e4bce4b47e756479e59", newTeamId: "team-che",  newTeamName: "Chelsea",                previousTeamId: "team-dor",  previousTeamName: "Borussia Dortmund",  effectiveFromMatchday: 7 },  // Gandares: Dortmund → Chelsea
  { playerId: "player-69922fdc999ccd1bd7dc2e5a0", newTeamId: "team-dor",  newTeamName: "Borussia Dortmund",     previousTeamId: "team-che",  previousTeamName: "Chelsea",            effectiveFromMatchday: 7 },  // Blaine: Chelsea → Dortmund (nota: ID puede variar)
  { playerId: "player-69922fdc999ccd1bd7d75fa0", newTeamId: "team-dor",  newTeamName: "Borussia Dortmund",      previousTeamId: "team-che",  previousTeamName: "Chelsea",            effectiveFromMatchday: 7 },  // Blaine (ID alternativo)
  { playerId: "player-68486e4bce4b47e756479fec", newTeamId: "team-che",  newTeamName: "Chelsea",                previousTeamId: "team-int",  previousTeamName: "Inter de Milan",     effectiveFromMatchday: 7 },  // Archer: Inter → Chelsea
  { playerId: "player-68486e4bce4b47e756479f52", newTeamId: "team-int",  newTeamName: "Inter de Milan",         previousTeamId: "team-che",  previousTeamName: "Chelsea",            effectiveFromMatchday: 7 },  // Caleb: Chelsea → Inter
  { playerId: "player-68486e4bce4b47e75647a060", newTeamId: "team-ath",  newTeamName: "Athletic Club",          previousTeamId: "team-fey",  previousTeamName: "Feyenoord",          effectiveFromMatchday: 7 },  // Thor: Feyenoord → Athletic
  { playerId: "player-68486e4bce4b47e756479f65", newTeamId: "team-fey",  newTeamName: "Feyenoord",              previousTeamId: "team-ath",  previousTeamName: "Athletic Club",      effectiveFromMatchday: 7 },  // Falco: Athletic → Feyenoord
];

/** Devuelve el equipo que tenía el jugador en una jornada concreta. */
export const getPlayerTeamForMatchday = (
  playerId: string,
  matchdayNumber: number,
  currentTeamId: string,
  currentTeamName: string,
): { teamId: string; teamName: string } => {
  const override = transferOverrides.find((t) => t.playerId === playerId);
  if (override && matchdayNumber < override.effectiveFromMatchday) {
    return { teamId: override.previousTeamId, teamName: override.previousTeamName };
  }
  return { teamId: currentTeamId, teamName: currentTeamName };
};