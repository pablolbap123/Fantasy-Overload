import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/Button";
import { useFantasy } from "../../store/fantasyStore";

interface ChallengeSyncButtonProps {
  className?: string;
  label?: string;
  compact?: boolean;
}

export const ChallengeSyncButton = ({ className, label = "Actualizar Challenge", compact }: ChallengeSyncButtonProps) => {
  const { requestChallengeSync, onlineReady } = useFantasy();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const sync = async () => {
    setSyncing(true);
    setMessage("");
    setError("");
    try {
      await requestChallengeSync();
      setMessage("Solicitud enviada al watcher.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar Challenge.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className={className}>
      <Button
        variant="secondary"
        className="w-full"
        icon={<RefreshCw className="h-4 w-4" />}
        loading={syncing}
        onClick={() => void sync()}
      >
        {label}
      </Button>
      {!compact ? (
        <p className="mt-2 text-xs font-semibold text-slate-400">
          {message || error || (onlineReady ? "Solo actualiza cuando alguien pulsa este boton." : "Disponible aunque no hayas entrado aun a una liga.")}
        </p>
      ) : null}
    </div>
  );
};
