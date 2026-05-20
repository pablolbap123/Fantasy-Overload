import { motion } from "framer-motion";
import type { FantasyStanding } from "../../types";

export const Podium = ({ standings }: { standings: FantasyStanding[] }) => {
  const top = standings.slice(0, 3);
  const heights = ["h-28", "h-36", "h-24"];
  const order = [1, 0, 2];

  return (
    <div className="grid grid-cols-3 items-end gap-2">
      {order.map((index) => {
        const item = top[index];
        if (!item) return <div key={index} />;
        return (
          <motion.div layout key={item.userId} className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 font-black text-white ring-1 ring-white/10">
              {item.username.slice(0, 2).toUpperCase()}
            </div>
            <div className={`${heights[index]} flex flex-col justify-end rounded-2xl border border-white/10 bg-white/[0.06] p-3`}>
              <div className="text-2xl font-black text-turbo-gold">#{item.position}</div>
              <div className="truncate text-sm font-bold text-white">{item.username}</div>
              <div className="text-xs text-slate-400">{item.totalPoints} pts</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
