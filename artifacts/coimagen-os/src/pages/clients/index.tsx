import { useState } from "react";
import { Link } from "wouter";
import {
  useListClients,
  useCreateClient,
  getListClientsQueryKey,
  useListClientOverview,
  getListClientOverviewQueryKey,
  type ClientOverview,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Check, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CONTRACT_LABELS: Record<string, { label: string; color: string }> = {
  signed: { label: "Firmado", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  sent: { label: "Enviado", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  draft: { label: "Borrador", color: "bg-muted text-muted-foreground border-border" },
};

const MODULE_LABELS: Record<string, string> = { ecommerce: "E-commerce", autopublicador: "Autopublicador", seo: "SEO" };

function PaymentsCell({ row }: { row: ClientOverview | undefined }) {
  if (!row) return <span className="text-muted-foreground">—</span>;
  if (row.overdueInvoices > 0) return <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/30">{row.overdueInvoices} vencida{row.overdueInvoices > 1 ? "s" : ""}</Badge>;
  if (row.pendingInvoices > 0) return <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30">{row.pendingInvoices} pendiente{row.pendingInvoices > 1 ? "s" : ""}</Badge>;
  if (row.proBono) return <span className="text-xs text-muted-foreground">No aplica</span>;
  return <span className="text-xs text-emerald-400">Al día</span>;
}

function ContractCell({ row }: { row: ClientOverview | undefined }) {
  if (!row?.contractStatus) return <span className="text-xs text-muted-foreground">Sin contrato</span>;
  const c = CONTRACT_LABELS[row.contractStatus] ?? { label: row.contractStatus, color: "bg-muted text-muted-foreground border-border" };
  return <Badge variant="outline" className={c.color}>{c.label}</Badge>;
}

export function Clients() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", industry: "", status: "active" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: clients, isLoading } = useListClients({
    query: { queryKey: getListClientsQueryKey() }
  });
  const { data: overview } = useListClientOverview({
    query: { queryKey: getListClientOverviewQueryKey() }
  });
  const overviewById = new Map((overview ?? []).map((o) => [o.clientId, o]));

  const createClient = useCreateClient({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
        qc.invalidateQueries({ queryKey: getListClientOverviewQueryKey() });
        setOpen(false);
        setForm({ name: "", email: "", phone: "", company: "", industry: "", status: "active" });
        toast({ title: "Cliente creado correctamente" });
      },
      onError: () => toast({ title: "Error al crear cliente", variant: "destructive" }),
    }
  });

  const filteredClients = clients?.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(search.toLowerCase()) ||
      client.company?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    const row = overviewById.get(client.id);
    if (filter === "overdue") return (row?.overdueInvoices ?? 0) > 0;
    if (filter === "no-portal") return !row?.hasPortalAccount;
    if (filter === "probono") return row?.proBono ?? false;
    if (filter !== "all") return client.status === filter;
    return true;
  }) || [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    createClient.mutate({ data: form as Parameters<typeof createClient.mutate>[0]["data"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Cliente
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm border-0 focus-visible:ring-0 px-0 h-8"
            />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="ml-auto w-48 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
                <SelectItem value="suspended">Suspendidos</SelectItem>
                <SelectItem value="overdue">Con pagos vencidos</SelectItem>
                <SelectItem value="no-portal">Sin acceso al portal</SelectItem>
                <SelectItem value="probono">Pro bono</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Pagos</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead>Módulos</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No se encontraron clientes.</TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => {
                  const row = overviewById.get(client.id);
                  return (
                  <TableRow key={client.id} className="hover:bg-muted/50 cursor-pointer">
                    <TableCell className="font-medium">
                      <Link href={`/clients/${client.id}`} className="hover:underline">
                        {client.name}
                      </Link>
                      {row?.proBono && <Badge variant="outline" className="ml-2 text-[10px] py-0 bg-primary/10 text-primary border-primary/30">Pro bono</Badge>}
                      {client.company && <div className="text-xs text-muted-foreground font-normal">{client.company}</div>}
                    </TableCell>
                    <TableCell><StatusBadge status={client.status} /></TableCell>
                    <TableCell><PaymentsCell row={row} /></TableCell>
                    <TableCell><ContractCell row={row} /></TableCell>
                    <TableCell>
                      {row?.hasPortalAccount
                        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><Check className="h-3.5 w-3.5" />Activo</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="h-3.5 w-3.5" />Sin acceso</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row && row.enabledModules.length > 0 ? row.enabledModules.map((m) => MODULE_LABELS[m] ?? m).join(", ") : "Base"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/clients/${client.id}`}>
                        <Button variant="ghost" size="sm">Ver</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre completo" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@ejemplo.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 000 000 0000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Nombre de empresa" />
              </div>
              <div className="space-y-1.5">
                <Label>Industria</Label>
                <Input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} placeholder="Ej: Salud, Finanzas" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                  <SelectItem value="suspended">Suspendido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createClient.isPending}>
                {createClient.isPending ? "Guardando..." : "Crear Cliente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
