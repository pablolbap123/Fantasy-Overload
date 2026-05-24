import { ArrowDownToLine, ArrowUpFromLine, Clock3, Eye, Gavel, HandCoins, ShieldPlus } from "lucide-react";
import { motion } from "framer-motion";
import type { Player } from "../../types";
import { formatMoney, positionTone, statusLabel, statusTone } from "../../utils/formatters";
import { playerPositions } from "../../utils/calculatePoints";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { PlayerAvatar } from "./PlayerAvatar";

interface PlayerCardProps {
  player: Player;
  ownerName?: string;
  ownerLabel?: string;
  price?: number;
  releaseClause?: number;
  clauseUpgradeCost?: number;
  highestBid?: number;
  bidCount?: number;
  marketTimeLeft?: string;
  nextBidAmount?: number;
  action?: "buy" | "bid" | "sell" | "clause" | "offer" | "detail";
  compact?: boolean;
  onBuy?: () => void;
  onBid?: () => void;
  onSell?: () => void;
  onClause?: () => void;
  onRaiseClause?: () => void;
  onOffer?: () => void;
  onDetail?: () => void;
}

export const PlayerCard = ({
  player,
  ownerName,
  ownerLabel,
  price,
  releaseClause,
  clauseUpgradeCost,
  highestBid,
  bidCount,
  marketTimeLeft,
  nextBidAmount,
  action = "detail",
  compact,
  onBuy,
  onBid,
  onSell,
  onClause,
  onRaiseClause,
  onOffer,
  onDetail,
}: PlayerCardProps) => (
  <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <Card className="h-full">
      <div className="flex items-start gap-3">
        <PlayerAvatar player={player} />
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
            <div className="min-w-0 pr-1">
              <h3 className="truncate text-sm font-black text-white">{player.name}</h3>
              <p className="truncate text-xs text-slate-400">{player.teamName}</p>
            </div>
            <div className="shrink-0 rounded-lg bg-white/[0.06] px-2 py-1 text-center ring-1 ring-white/10">
              <div className="text-lg font-black text-white">{player.totalPoints}</div>
              <div className="text-[10px] uppercase text-slate-500">pts</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {playerPositions(player).map((position) => (
              <Badge key={position} className={positionTone[position]}>{position}</Badge>
            ))}
            <Badge className={statusTone[player.status]}>{statusLabel[player.status]}</Badge>
            <Badge className="bg-white/10 text-white ring-white/15">{formatMoney(price ?? player.currentPrice)}</Badge>
            {releaseClause ? <Badge className="bg-[#f5bd43]/20 text-[#ffe2a2] ring-[#f5bd43]/35">Cl. {formatMoney(releaseClause)}</Badge> : null}
            {typeof highestBid === "number" ? <Badge className="bg-[#62d7ff]/20 text-[#c5f2ff] ring-[#62d7ff]/35">Puja {formatMoney(highestBid)}</Badge> : null}
          </div>
          {marketTimeLeft ? (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-sky-300/10 bg-sky-300/[0.06] px-3 py-2 text-xs">
              <span className="flex items-center gap-1 font-bold text-sky-100">
                <Clock3 className="h-3.5 w-3.5" />
                Cierra en {marketTimeLeft}
              </span>
              <span className="text-slate-400">{bidCount ?? 0} pujas</span>
            </div>
          ) : null}
          {!compact ? (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-white/[0.04] p-2">
                <div className="font-bold text-white">{player.stats.goals}</div>
                <div className="text-slate-500">Goles</div>
              </div>
              <div className="rounded-lg bg-white/[0.04] p-2">
                <div className="font-bold text-white">{player.stats.assists}</div>
                <div className="text-slate-500">Asist.</div>
              </div>
              <div className="rounded-lg bg-white/[0.04] p-2">
                <div className="font-bold text-white">{player.fantasyValue}</div>
                <div className="text-slate-500">Media</div>
              </div>
            </div>
          ) : null}
          {ownerName || ownerLabel ? <p className="mt-2 text-xs text-slate-400">{ownerLabel ?? `Dueño: ${ownerName}`}</p> : null}
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            {action === "buy" ? (
              <Button className="min-w-0 px-2" icon={<ArrowDownToLine className="h-4 w-4" />} onClick={onBuy}>
                Comprar
              </Button>
            ) : null}
            {action === "bid" ? (
              <Button className="min-w-0 px-2" icon={<Gavel className="h-4 w-4" />} onClick={onBid}>
                Pujar{nextBidAmount ? ` ${formatMoney(nextBidAmount)}` : ""}
              </Button>
            ) : null}
            {action === "sell" ? (
              <Button className="min-w-0 px-2" variant="secondary" icon={<ArrowUpFromLine className="h-4 w-4" />} onClick={onSell}>
                Vender
              </Button>
            ) : null}
            {action === "offer" ? (
              <Button className="min-w-0 px-2" variant="secondary" icon={<HandCoins className="h-4 w-4" />} onClick={onOffer}>
                Ofertar
              </Button>
            ) : null}
            {action === "clause" ? (
              <Button className="min-w-0 px-2" variant="secondary" icon={<ShieldPlus className="h-4 w-4" />} onClick={onClause}>
                Pagar cláusula
              </Button>
            ) : null}
            <Button variant="ghost" className="px-3" aria-label="Ver detalle" onClick={onDetail}>
              <Eye className="h-4 w-4" />
            </Button>
          </div>
          {onRaiseClause ? (
            <Button className="mt-2 w-full" variant="ghost" icon={<ShieldPlus className="h-4 w-4" />} onClick={onRaiseClause}>
              Subir cláusula{clauseUpgradeCost ? ` (${formatMoney(clauseUpgradeCost)})` : ""}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  </motion.div>
);
