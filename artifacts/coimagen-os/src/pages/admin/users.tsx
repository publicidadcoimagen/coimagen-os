import { useState } from "react";
import {
  useListSystemUsers,
  useUpdateSystemUser,
  useDeleteSystemUser,
  getListSystemUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Trash2, UserCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROLE_COLORS: Record<string, string> = {
  ceo: "bg-primary/20 text-primary border-primary/30",
  admin: "bg-secondary/20 text-secondary border-secondary/30",
  viewer: "bg-muted text-muted-foreground border-border",
};

const ROLE_LABELS: Record<string, string> = {
  ceo: "CEO",
  admin: "Admin",
  viewer: "Viewer",
};

export function AdminUsers() {
  const { user } = useAuth();
  const isCeo = user?.role === "ceo";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: users, isLoading } = useListSystemUsers({
    query: { queryKey: getListSystemUsersQueryKey() }
  });

  const updateUser = useUpdateSystemUser({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSystemUsersQueryKey() });
        toast({ title: "Rol actualizado" });
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

  const handleRoleChange = (id: string, role: string) => {
    updateUser.mutate({ id, data: { role } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <UserCog className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roles y Accesos</h1>
          <p className="text-sm text-muted-foreground">Usuarios del sistema y sus niveles de acceso</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {["ceo", "admin", "viewer"].map((role) => {
          const count = users?.filter((u) => u.role === role).length ?? 0;
          return (
            <Card key={role} className="border-border/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{ROLE_LABELS[role]}</p>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                  <Shield className="h-8 w-8 text-primary/30" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Usuarios del Sistema</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Cargando usuarios...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  {isCeo && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {u.profileImageUrl ? (
                          <img src={u.profileImageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-secondary/20 flex items-center justify-center text-xs font-bold text-secondary">
                            {(u.firstName?.[0] ?? u.email?.[0] ?? "?").toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">
                            {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.firstName ?? "—"}
                          </p>
                          {u.id === user?.id && (
                            <span className="text-[10px] text-primary">Tú</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                    <TableCell>
                      {isCeo && u.id !== user?.id ? (
                        <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, v)}>
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ceo">CEO</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={ROLE_COLORS[u.role] ?? ""}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </Badge>
                      )}
                    </TableCell>
                    {isCeo && (
                      <TableCell>
                        {u.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive/60 hover:text-destructive"
                            onClick={() => setDeleteId(u.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción revoca el acceso al sistema. El usuario no podrá iniciar sesión hasta que vuelva a autenticarse.
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
