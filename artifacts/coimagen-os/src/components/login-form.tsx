import { useState, type FormEvent } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import logoUrl from "@assets/logo-coimagen_1782794060071.png";

export function LoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await signIn(email, password);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-8">
      <div className="flex flex-col items-center gap-4">
        <img src={logoUrl} alt="Coimagen" className="h-28 w-auto" />
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">COIMAGEN OS</h1>
          <p className="text-muted-foreground text-sm">Sistema Operativo Interno</p>
        </div>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="text-sm text-muted-foreground text-center">Inicia sesión con tu cuenta</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              Iniciar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
