import { useState } from "react";
import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOrganization, getGetOrganizationQueryKey,
  getListOrganizationsQueryKey, useUpdateOrganization,
} from "@workspace/api-client-react";
import { ClientRoomLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  User, Building2, Globe, Mail, Phone, Edit2,
  Shield, CheckCircle2,
} from "lucide-react";

type Org = {
  id: number; slug: string; name: string; description?: string | null;
  clientId?: number | null; logoUrl?: string | null; primaryColor?: string | null;
  contactEmail?: string | null; contactPhone?: string | null; createdAt: string;
};

function EditProfileDialog({ org, open, onClose }: { org: Org; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? "");
  const [contactEmail, setContactEmail] = useState(org.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(org.contactPhone ?? "");
  const [primaryColor, setPrimaryColor] = useState(org.primaryColor ?? "#6366f1");

  const { mutate: update, isPending } = useUpdateOrganization({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOrganizationQueryKey(org.slug) });
        queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
        onClose();
      },
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Editar perfil de organización</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5"><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Descripción</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div className="space-y-1.5"><Label>Email de contacto</Label><Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Teléfono</Label><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Color de marca</Label><Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 p-1 cursor-pointer" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={() => update({ slug: org.slug, data: { name, description: description || undefined, contactEmail: contactEmail || undefined, contactPhone: contactPhone || undefined, primaryColor } })} disabled={!name.trim() || isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ClientProfile() {
  const [, params] = useRoute("/client/:slug/profile");
  const slug = params?.slug ?? "";
  const [editOpen, setEditOpen] = useState(false);

  const { data: rawOrg, isLoading } = useGetOrganization(slug, { query: { queryKey: getGetOrganizationQueryKey(slug) } });
  const org = rawOrg as Org | undefined;

  if (isLoading) return (
    <ClientRoomLayout slug={slug}>
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-muted-foreground animate-pulse">Cargando...</p>
      </div>
    </ClientRoomLayout>
  );

  return (
    <ClientRoomLayout slug={slug}>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Perfil</h1>
              <p className="text-sm text-muted-foreground">Información de tu organización</p>
            </div>
          </div>
          {org && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit2 className="h-3.5 w-3.5 mr-1.5" />Editar
            </Button>
          )}
        </div>

        {org && (
          <>
            {/* Org header */}
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div
                    className="h-16 w-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
                    style={{ background: org.primaryColor ?? "hsl(var(--primary))" }}
                  >
                    {org.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold">{org.name}</h2>
                      <Badge variant="outline" className="text-[9px] py-0 bg-green-400/10 text-green-400 border-green-400/30"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Activo</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">/client/{org.slug}</p>
                    {org.description && <p className="text-sm text-muted-foreground mt-1">{org.description}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Globe, label: "Client Room URL", value: `/client/${org.slug}` },
                { icon: Building2, label: "ID Organización", value: `ORG-${String(org.id).padStart(4, "0")}` },
                { icon: Mail, label: "Email de contacto", value: org.contactEmail ?? "—" },
                { icon: Phone, label: "Teléfono", value: org.contactPhone ?? "—" },
              ].map(({ icon: Icon, label, value }) => (
                <Card key={label} className="border-border/50">
                  <CardContent className="p-3 flex items-start gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
                      <p className="text-xs font-medium break-all">{value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Security info */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-3 flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-primary">Seguridad del portal</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Tu Client Room está aislado. Solo puedes ver información de tu organización. 
                    El acceso es controlado por el equipo de COIMAGEN.
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Creado: {new Date(org.createdAt).toLocaleDateString("es-MX")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {org && <EditProfileDialog org={org} open={editOpen} onClose={() => setEditOpen(false)} />}
    </ClientRoomLayout>
  );
}
