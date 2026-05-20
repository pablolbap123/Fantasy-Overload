import type { ActivityItem } from "../../types";
import { formatDate } from "../../utils/formatters";
import { Card } from "../ui/Card";

export const ActivityFeed = ({ items }: { items: ActivityItem[] }) => (
  <Card>
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-black text-white">Noticias y actividad</h2>
      <span className="text-xs text-slate-500">{items.length} eventos</span>
    </div>
    <div className="space-y-3">
      {items.slice(0, 8).map((item) => (
        <div key={item.id} className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-sm text-slate-100">{item.message}</p>
          <p className="mt-1 text-xs text-slate-500">{formatDate(item.createdAt)}</p>
        </div>
      ))}
    </div>
  </Card>
);
