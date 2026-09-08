import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Eye, LogOut } from "lucide-react";
import { useImpersonation } from "@/hooks/use-impersonation";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const ss = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

// Full-width bar above the whole Client Room layout (sidebar + main), not
// just above <main> — unmissable regardless of sidebar/content scroll,
// since a staff member acting on what they see here is acting on a real
// client's Client Room.
export function ImpersonationBanner() {
  const { impersonation, isImpersonating, remainingMs, endImpersonation } = useImpersonation();
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!isImpersonating) return;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isImpersonating]);

  if (!isImpersonating || !impersonation) return null;

  return (
    <Alert className="rounded-none border-x-0 border-t-0 flex items-center justify-between gap-4 bg-amber-500/10 border-amber-500/40 py-2 flex-shrink-0">
      <AlertDescription className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
        <Eye className="h-4 w-4 shrink-0" />
        Viendo como {impersonation.clientName} · Modo solo lectura · expira en {formatRemaining(remainingMs)}
      </AlertDescription>
      <Button variant="outline" size="sm" className="shrink-0 border-amber-500/40" onClick={endImpersonation}>
        <LogOut className="h-3.5 w-3.5 mr-1.5" />Salir
      </Button>
    </Alert>
  );
}
