import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClass: Record<Variant, string> = {
  primary: "bg-gradient-to-r from-[#21d17f] to-[#62d7ff] text-[#08101f] shadow-lg shadow-[#21d17f]/15 hover:brightness-110",
  secondary: "border border-white/15 bg-[#202a43]/90 text-white hover:border-[#62d7ff]/50 hover:bg-[#26314a]",
  ghost: "text-slate-100 hover:bg-white/10 hover:text-white",
  danger: "bg-[#ff3f55] text-white hover:bg-[#ff586b] shadow-lg shadow-[#ff3f55]/25",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = ({ className, variant = "primary", loading, icon, children, disabled, ...props }: ButtonProps) => (
  <button
    className={clsx(
      "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
      variantClass[variant],
      className,
    )}
    disabled={disabled || loading}
    {...props}
  >
    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
    {children}
  </button>
);
