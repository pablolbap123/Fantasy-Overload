import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClass: Record<Variant, string> = {
  primary: "bg-[#23c979] text-[#06130d] shadow-lg shadow-[#23c979]/15 hover:bg-[#36dc8d]",
  secondary: "border border-white/10 bg-[#111a23] text-white hover:border-[#4bb3fd]/50 hover:bg-[#162230]",
  ghost: "text-slate-100 hover:bg-white/10 hover:text-white",
  danger: "bg-[#f0445a] text-white hover:bg-[#ff5d70] shadow-lg shadow-[#f0445a]/20",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = ({ className, variant = "primary", loading, icon, children, disabled, ...props }: ButtonProps) => (
  <button
    className={clsx(
      "inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-center text-sm font-black leading-tight transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
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
