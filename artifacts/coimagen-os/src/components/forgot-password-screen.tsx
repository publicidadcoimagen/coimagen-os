import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import logoUrl from "@assets/logo-coimagen_1782794060071.png";

export function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await requestPasswordReset(email);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
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
        {submitted ? (
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-center">
              Si ese correo existe en el sistema, te enviamos un enlace para restablecer tu contraseña.
              Revisá tu bandeja de entrada.
            </p>
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href="/">Volver a iniciar sesión</Link>
            </Button>
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <p className="text-sm text-muted-foreground text-center">
                Ingresá tu correo y te enviamos un enlace para restablecerla.
              </p>
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
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" size="lg" disabled={isSubmitting}>
                  {isSubmitting && <Spinner />}
                  Enviar enlace
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/">Volver a iniciar sesión</Link>
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
