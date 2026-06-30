import { useState } from "react";
import {
  useListSystemUsers,
  useCreateSystemUser,
  useUpdateSystemUser,
  useDeleteSystemUser,
  getListSystemUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Trash2, UserCog, Plus, Info, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROLES = ["ceo", "admin", "viewer", "cliente"] as const;
type Role = typeof ROLES[number];

const ROLE_COLORS: Record<string, string> = {
  ceo:     "bg-primary/20 text-primary border-primary/30",
  admin:   "bg-secondary/20 text-secondary border-secondary/30",
  viewer:  "bg-muted text-muted-foreground border-border",
  cliente: "bg-blue-400/15 text-blue-400 border-blue-400/30",
};
const ROLE_LABELS: Record<string, string> = {
  ceo: "CEO", admin: "Admin", viewer: "Viewer", cliente: "Cliente",
};
const STATUS_COLORS: Record<string, string> = {
  active:   "bg-green-400/15 text-green-400 border-green-400/30",
  inactive: "bg-muted text-muted-foreground border-border",
  invited:  "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
};

const EMPTY_FORM = { firstName: "", lastName: "", email: "", role: "viewer", status: "active" };

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AdminUsers() {
  const { user } = useAuth();
  const isCeo = user?.role === "ceo";
  const isAdmin = user?.role === "admin";
  const canView = isCeo || isAdmin;

  const { toast } = useToast();
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: users, isLoading, error } = useListSystemUsers({
    query: { queryKey: getListSystemUsersQueryKey() }
  });

  const createUser = useCreateSystemUser({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSystemUsersQueryKey() });
        setCreateOpen(false);
        setForm({ ...EMPTY_FORM });
        toast({ title: "Usuario creado" });
      },
      onError: () => toast({ title: "Error al crear usuario", variant: "destructive" }),
    }
  });

  const updateUser = useUpdateSystemUser({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSystemUsersQueryKey() });
        toast({ title: "Usuario actualizado" });
      },
      onError: () => toast({ title: "Error al actualizar", variant: "destructive" }),
    }
  });

  const deleteUser = useDeleteSystemUser({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSystemUsersQueryKey() });
        toast({ title: "Usuario eliminado" });
        setDeleteId(null);
      },
      onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
    }
  });

  // Viewer / Cliente: access denied
  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Shield className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  const totalByRole = (role: string) => users?.filter((u) => u.role === role).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <UserCog className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roles y Accesos</h1>
          <p className="text-sm text-muted-foreground">Usuarios del sistema y niveles de acceso</p>
        </div>
        {isCeo && (
          <Button size="sm" className="ml-auto gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Crear Usuario
          </Button>
        )}
      </div>

      {/* Role summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {ROLES.map((role) => (
          <Card key={role} className="border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{ROLE_LABELS[role]}</p>
                  <p className="text-2xl font-bold">{totalByRole(role)}</p>
                </div>
                <Shield className="h-7 w-7 text-primary/20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Password note */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/40">
        <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Los accesos se gestionan mediante autenticación externa (Replit Auth / proveedor de identidad).
          Las contraseñas <strong>no se administran</strong> desde COIMAGEN OS. El rol <strong>Cliente</strong> está preparado para el futuro Client Room — sin acceso al panel actual.
        </p>
      </div>

      {/* Users table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Usuarios del Sistema</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Cargando usuarios...</div>
          ) : error ? (
            <div className="p-8 text-center text-destructive text-sm">Error al cargar usuarios. Verifica que tienes permisos.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Último acceso</TableHead>
                  <TableHead>Creado</TableHead>
                  {isCeo && <TableHead className="w-16"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users && users.length > 0 ? users.map((u) => {
                  const isCurrentUser = u.id === user?.id;
                  const isTargetCeo = u.role === "ceo";
                  const canEditRole = isCeo && !isCurrentUser;
                  const canDelete = isCeo && !isCurrentUser;

                  return (
                    <TableRow key={u.id} className={isCurrentUser ? "bg-primary/5" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {u.profileImageUrl ? (
                            <img src={u.profileImageUrl} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-secondary/20 flex items-center justify-center text-xs font-bold text-secondary flex-shrink-0">
                              {(u.firstName?.[0] ?? u.email?.[0] ?? "?").toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm">
                              {u.firstName || u.lastName
                                ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
                                : <span className="text-muted-foreground">Sin nombre</span>}
                            </p>
                            {isCurrentUser && (
                              <span className="text-[10px] text-primary font-medium">Tú</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                      <TableCell>
                        {canEditRole ? (
                          <Select
                            value={u.role}
                            onValueChange={(v) => updateUser.mutate({ id: u.id, data: { role: v } })}
                          >
                            <SelectTrigger className="h-7 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={`text-xs ${ROLE_COLORS[u.role] ?? ""}`}>
                            {ROLE_LABELS[u.role] ?? u.role}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isCeo && !isCurrentUser ? (
                          <Select
                            value={u.status}
                            onValueChange={(v) => updateUser.mutate({ id: u.id, data: { status: v } })}
                          >
                            <SelectTrigger className="h-7 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Activo</SelectItem>
                              <SelectItem value="inactive">Inactivo</SelectItem>
                              <SelectItem value="invited">Invitado</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[u.status] ?? ""}`}>
                            {u.status === "active" ? "Activo" : u.status === "inactive" ? "Inactivo" : "Invitado"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          {formatDate(u.lastLogin)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                      {isCeo && (
                        <TableCell>
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive/50 hover:text-destructive"
                              onClick={() => setDeleteId(u.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={isCeo ? 7 : 6} className="text-center py-8 text-muted-foreground text-sm">
                      No hay usuarios registrados aún. Al iniciar sesión, los usuarios aparecen automáticamente.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Usuario Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nombre</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="mt-1" placeholder="Nombre" />
              </div>
              <div>
                <Label className="text-xs">Apellido</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="mt-1" placeholder="Apellido" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" placeholder="correo@ejemplo.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Rol</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                    <SelectItem value="invited">Invitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/40 border border-border/40">
              <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground">
                Los usuarios creados manualmente no pueden iniciar sesión hasta que se autentiquen con Replit Auth. Este registro es para referencia y preparación del Client Room.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createUser.mutate({ data: form })}
              disabled={createUser.isPending}
            >
              Crear Usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción elimina el registro del usuario del sistema. Si el usuario vuelve a iniciar sesión, será recreado con rol Viewer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteUser.mutate({ id: deleteId })}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
