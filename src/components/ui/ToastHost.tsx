import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { clsx } from "clsx";
import { useFantasy } from "../../store/fantasyStore";

const toneClass = {
  success: "border-emerald-300/30 bg-emerald-500/15 text-emerald-50",
  error: "border-rose-300/30 bg-rose-500/15 text-rose-50",
  info: "border-sky-300/30 bg-sky-500/15 text-sky-50",
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
            className={clsx(
              "pointer-events-auto flex items-start justify-between gap-3 rounded-xl border p-3 text-sm shadow-2xl backdrop-blur",
              toneClass[toast.tone],
            )}
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
