import { useState } from "react";
import { useListAuditLogs } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollText } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLOR: Record<string, string> = {
  success: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  error: "bg-red-500/20 text-red-300 border-red-500/30",
  warning: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};
const STATUS_ES: Record<string, string> = { success: "Exitoso", error: "Error", warning: "Advertencia" };

export function AuditLog() {
  const [moduleFilter, setModuleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: logs, isLoading } = useListAuditLogs();

  const filtered = logs?.filter((l) => {
    const matchModule = !moduleFilter || l.module.toLowerCase().includes(moduleFilter.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchModule && matchStatus;
  }) ?? [];

  const formatTs = (iso: string) => {
    try {
      const d = new Date(iso);
      return { date: format(d, "dd/MM/yyyy"), time: format(d, "HH:mm:ss") };
    } catch { return { date: "-", time: "-" }; }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ScrollText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Bitácora del Sistema</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} registros</span>
      </div>

      <div className="flex gap-3 items-center">
        <Input placeholder="Filtrar por módulo..." value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="max-w-xs h-8 text-sm" />
        <div className="flex gap-2">
          {[{ k: "all", l: "Todos" }, { k: "success", l: "Exitoso" }, { k: "error", l: "Error" }, { k: "warning", l: "Advertencia" }].map(({ k, l }) => (
            <Button key={k} size="sm" variant={statusFilter === k ? "default" : "outline"} onClick={() => setStatusFilter(k)} className="text-xs h-7">{l}</Button>
          ))}
        </div>
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Fecha</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Hora</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Usuario</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Módulo</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Acción</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Resultado</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Estado</th>
            </tr></thead>
            <tbody>
              {filtered.map((log) => {
                const { date, time } = formatTs(log.createdAt);
                return (
                  <tr key={log.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors font-mono">
                    <td className="px-3 py-2.5 text-muted-foreground">{date}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{time}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{log.userId ?? "sistema"}</td>
                    <td className="px-3 py-2.5 font-medium font-sans">{log.module}</td>
                    <td className="px-3 py-2.5 font-sans">{log.action}</td>
                    <td className="px-3 py-2.5 text-muted-foreground font-sans max-w-xs truncate">{log.result ?? "-"}</td>
                    <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full border text-[10px] ${STATUS_COLOR[log.status] ?? "bg-muted text-muted-foreground"}`}>{STATUS_ES[log.status] ?? log.status}</span></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Sin registros.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
