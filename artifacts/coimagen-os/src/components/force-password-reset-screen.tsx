import { useState, type FormEvent } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useChangeOwnPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import logoUrl from "@assets/logo-coimagen_1782794060071.png";

export function ForcePasswordResetScreen() {
  const { refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const changePassword = useChangeOwnPassword();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }

    try {
      await changePassword.mutateAsync({ data: { currentPassword, newPassword } });
      // Re-reads the session so the shared AuthProvider state reflects
      // forcePasswordReset: false, which is what lets AuthGate move past
      // this screen — same Context mechanism as the sign-in fix.
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-8">
      <div className="flex flex-col items-center gap-4">
        <img src={logoUrl} alt="Coimagen" className="h-28 w-auto" />
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">COIMAGEN OS</h1>
          <p className="text-muted-foreground text-sm">Cambio de contraseña obligatorio</p>
        </div>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="text-sm text-muted-foreground text-center">
            Por seguridad, tenés que definir tu propia contraseña antes de continuar.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currentPassword">Contraseña actual</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={changePassword.isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={changePassword.isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={changePassword.isPending}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" disabled={changePassword.isPending}>
              {changePassword.isPending && <Spinner />}
              Cambiar contraseña
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
