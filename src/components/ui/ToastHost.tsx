import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { clsx } from "clsx";
import { useFantasy } from "../../store/fantasyStore";

const toneClass = {
  success: "border-emerald-300/35 bg-[#10261f]/95 text-emerald-50 shadow-emerald-950/30",
  error: "border-rose-300/35 bg-[#2a1119]/95 text-rose-50 shadow-rose-950/30",
  info: "border-sky-300/35 bg-[#101f2c]/95 text-sky-50 shadow-sky-950/30",
};

export const ToastHost = () => {
  const { toasts, dismissToast } = useFantasy();

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-50 flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            className={clsx("pointer-events-auto flex items-start justify-between gap-3 rounded-lg border p-3 text-sm shadow-2xl backdrop-blur-xl", toneClass[toast.tone])}
          >
            <span>{toast.message}</span>
            <button aria-label="Cerrar" onClick={() => dismissToast(toast.id)} className="rounded-lg p-1 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
