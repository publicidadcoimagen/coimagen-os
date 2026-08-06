import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@workspace/better-auth-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import logoUrl from "@assets/logo-coimagen_1782794060071.png";

export function ResetPasswordScreen() {
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("El enlace no es válido. Solicitá uno nuevo.");
      return;
    }
    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);
    const result = await resetPassword(newPassword, token);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-8">
      <div className="flex flex-col items-center gap-4">
        <img src={logoUrl} alt="Coimagen" className="h-28 w-auto" />
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">COIMAGEN OS</h1>
          <p className="text-muted-foreground text-sm">Restablecer contraseña</p>
        </div>
      </div>

      <Card className="w-full max-w-sm">
        {done ? (
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-center">Tu contraseña fue actualizada. Ya podés iniciar sesión.</p>
            <Button asChild size="lg" className="w-full">
              <Link href="/">Ir a iniciar sesión</Link>
            </Button>
          </CardContent>
        ) : !token ? (
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-center text-destructive">
              Este enlace no es válido o venció. Solicitá uno nuevo.
            </p>
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href="/forgot-password">Solicitar nuevo enlace</Link>
            </Button>
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <p className="text-sm text-muted-foreground text-center">Ingresá tu nueva contraseña.</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="newPassword">Nueva contraseña</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      className="pr-9"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      className="pr-9"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" size="lg" disabled={isSubmitting}>
                  {isSubmitting && <Spinner />}
                  Restablecer contraseña
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
