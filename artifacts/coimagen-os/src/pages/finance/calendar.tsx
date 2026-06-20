import { useListInvoices, useListSubscriptions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_ES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

interface CalEvent { day: number; label: string; color: string; }

export function PaymentCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const { data: invoices } = useListInvoices();
  const { data: subs } = useListSubscriptions();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const events: Record<number, CalEvent[]> = {};

  const addEvent = (day: number, label: string, color: string) => {
    if (!events[day]) events[day] = [];
    events[day].push({ day, label, color });
  };

  invoices?.forEach((inv) => {
    if (!inv.dueDate) return;
    const d = new Date(inv.dueDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const color = inv.status === "overdue" ? "bg-red-500/80" : inv.status === "paid" ? "bg-emerald-500/60" : "bg-amber-500/80";
      addEvent(d.getDate(), `${inv.number} · ${inv.clientName ?? ""}`, color);
    }
  });

  subs?.forEach((s) => {
    if (!s.nextBillingDate) return;
    const d = new Date(s.nextBillingDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      addEvent(d.getDate(), `${s.plan}`, "bg-violet-500/70");
    }
  });

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Calendario de Pagos</h1>
        <span className="text-muted-foreground text-sm">{MONTHS_ES[month]} {year}</span>
      </div>

      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" /> Facturas pendientes</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" /> Vencidas</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60 inline-block" /> Pagadas</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-500/70 inline-block" /> Suscripciones</span>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS_ES.map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              const isToday = day === now.getDate();
              const dayEvents = day ? (events[day] ?? []) : [];
              return (
                <div key={idx} className={`min-h-[80px] rounded-lg p-1.5 border ${day ? "border-border/40 bg-card/30 hover:bg-muted/20 transition-colors" : "border-transparent"} ${isToday ? "border-primary/60 bg-primary/5" : ""}`}>
                  {day && (
                    <>
                      <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</div>
                      <div className="space-y-0.5">
                        {dayEvents.map((ev, i) => (
                          <div key={i} className={`text-[9px] px-1 py-0.5 rounded truncate text-white ${ev.color}`}>{ev.label}</div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
