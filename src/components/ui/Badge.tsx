import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

export const Badge = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={clsx(
      "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-black uppercase tracking-wide ring-1 ring-inset",
      className,
    )}
    {...props}
  />
);
