import type { ReactNode } from "react";
import { Card } from "./Card";

export const EmptyState = ({ title, description, action }: { title: string; description: string; action?: ReactNode }) => (
  <Card className="flex min-h-48 flex-col items-center justify-center text-center">
    <h3 className="text-lg font-semibold text-white">{title}</h3>
    <p className="mt-2 max-w-md text-sm text-slate-400">{description}</p>
    {action ? <div className="mt-4">{action}</div> : null}
  </Card>
);
