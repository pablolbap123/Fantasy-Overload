import type { ReactNode } from "react";
import { Card } from "../ui/Card";

export const RankingList = <T,>({
  title,
  items,
  renderName,
  renderValue,
}: {
  title: string;
  items: T[];
  renderName: (item: T) => ReactNode;
  renderValue: (item: T) => ReactNode;
}) => (
  <Card>
    <h3 className="mb-3 text-base font-black text-white">{title}</h3>
    <div className="space-y-2">
      {items.slice(0, 6).map((item, index) => (
        <div key={index} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] p-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-xs font-black text-white">
              {index + 1}
            </span>
            <div className="min-w-0 text-sm font-semibold text-slate-100">{renderName(item)}</div>
          </div>
          <div className="text-sm font-black text-sky-200">{renderValue(item)}</div>
        </div>
      ))}
    </div>
  </Card>
);
