import type { PlayerPosition, PlayerStatus } from "../types";

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

export const formatCompactMoney = (value: number) => `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export const positionLabel: Record<PlayerPosition, string> = {
  POR: "Portero",
  DEF: "Defensa",
  MED: "Medio",
  DEL: "Delantero",
};

export const statusLabel: Record<PlayerStatus, string> = {
  disponible: "Disponible",
  lesionado: "Lesionado",
  sancionado: "Sancionado",
  duda: "Duda",
};

export const positionTone: Record<PlayerPosition, string> = {
  POR: "bg-[#62d7ff] text-[#08101f] ring-[#b8efff]/60",
  DEF: "bg-[#21d17f] text-[#07120d] ring-[#93f5c4]/60",
  MED: "bg-[#f5bd43] text-[#201505] ring-[#ffe2a2]/60",
  DEL: "bg-[#ff3f55] text-white ring-[#ff9aa7]/60",
};

export const statusTone: Record<PlayerStatus, string> = {
  disponible: "bg-[#21d17f]/20 text-[#a9ffd4] ring-[#21d17f]/35",
  duda: "bg-[#f5bd43]/20 text-[#ffe0a2] ring-[#f5bd43]/35",
  lesionado: "bg-[#ff3f55]/20 text-[#ffc0c8] ring-[#ff3f55]/35",
  sancionado: "bg-red-500/25 text-red-100 ring-red-300/35",
};
