import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListOrganizations, getListOrganizationsQueryKey,
  useCreateOrganization, useDeleteOrganization,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2, Plus, ExternalLink, Trash2, Users, Globe,
} from "lucide-react";

type Org = {
  id: number; slug: string; name: string; description?: string | null;
  clientId?: number | null; contactEmail?: string | null; createdAt: string;
};

function CreateOrgDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");

  const { mutate: create, isPending } = useCreateOrganization({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
        onClose(); reset();
      },
    },
  });

  function reset() {
    setSlug(""); setName(""); setDescription(""); setClientId(""); setContactEmail(""); setPrimaryColor("#6366f1");
  }

  const cleanSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />Nueva Organización (Client Room)</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Slug * <span className="text-[10px] text-muted-foreground">(URL: /client/slug)</span></Label>
            <Input value={slug} onChange={(e) => setSlug(cleanSlug(e.target.value))} placeholder="dr-segovia" />
          </div>
          <div className="space-y-1.5"><Label>Nombre *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Segovia Clínica" autoFocus /></div>
          <div className="space-y-1.5"><Label>Descripción</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>ID Cliente</Label><Input type="number" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="ID en OS" /></div>
            <div className="space-y-1.5"><Label>Color</Label><Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 p-1 cursor-pointer" /></div>
          </div>
          <div className="space-y-1.5"><Label>Email de contacto</Label><Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
            <Button size="sm" onClick={() => create({ data: { slug, name, description: description || undefined, clientId: clientId ? parseInt(clientId) : undefined, contactEmail: contactEmail || undefined, primaryColor } })} disabled={!slug.trim() || !name.trim() || isPending}>
              {isPending ? "Creando..." : "Crear Client Room"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ClientRoomAdmin() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);

  const { data: rawOrgs = [], isLoading } = useListOrganizations({
    query: { queryKey: getListOrganizationsQueryKey() },
  });

  const { mutate: deleteOrg } = useDeleteOrganization({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
        setDeleteSlug(null);
      },
    },
  });

  const orgs = rawOrgs as Org[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Client Room</h1>
            <p className="text-sm text-muted-foreground">Portal privado por cliente — {orgs.length} organizaciones activas</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />Nueva Organización
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array(3).fill(0).map((_, i) => <Card key={i} className="animate-pulse border-border/30"><CardContent className="h-24 bg-muted/20" /></Card>)}
        </div>
      ) : orgs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border/50 rounded-xl gap-4 text-muted-foreground">
          <Building2 className="h-12 w-12 opacity-20" />
          <p className="text-sm">No hay organizaciones creadas aún</p>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Crear primera organización</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {orgs.map((org) => (
            <Card key={org.id} className="border-border/50 hover:border-primary/30 transition-all group">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">
                    {org.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{org.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">/client/{org.slug}</p>
                    {org.description && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{org.description}</p>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {org.clientId && <Badge variant="outline" className="text-[9px] py-0 bg-blue-400/10 text-blue-400 border-blue-400/30"><Users className="h-2.5 w-2.5 mr-0.5" />Cliente #{org.clientId}</Badge>}
                      <Badge variant="outline" className="text-[9px] py-0 bg-green-400/10 text-green-400 border-green-400/30"><Globe className="h-2.5 w-2.5 mr-0.5" />Activo</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
                  <Button size="sm" className="flex-1 h-7 text-xs gap-1" asChild>
                    <Link href={`/client/${org.slug}`}>
                      <ExternalLink className="h-3 w-3" />Abrir Client Room
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all" onClick={() => setDeleteSlug(org.slug)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateOrgDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <AlertDialog open={deleteSlug !== null} onOpenChange={(o) => { if (!o) setDeleteSlug(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar organización?</AlertDialogTitle>
            <AlertDialogDescription>El Client Room "{deleteSlug}" será eliminado permanentemente. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteSlug) deleteOrg({ slug: deleteSlug }); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
