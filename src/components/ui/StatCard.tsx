import type { ReactNode } from "react";
import { Card } from "./Card";

export const StatCard = ({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) => (
  <Card className="min-h-24 border-emerald-300/10">
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className="rounded-lg bg-emerald-300/10 p-2 text-emerald-200">{icon}</span>
    </div>
    <div className="mt-3 text-2xl font-black text-white">{value}</div>
  </Card>
);
