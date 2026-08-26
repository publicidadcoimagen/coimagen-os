import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

// React error boundaries must be class components — there is no hook
// equivalent. Scoped to Client Room routes: a render-time crash there
// (e.g. a hook called outside its provider) previously reached no boundary
// at all and rendered a silent solid-black screen (found 2026-08-26,
// useLang-outside-LanguageProvider bug).
export class ClientRoomErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("Client Room render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center bg-background px-4">
          <div className="flex flex-col items-center gap-3 text-center max-w-sm">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <p className="text-sm font-semibold">Algo salió mal cargando esta página.</p>
            <p className="text-xs text-muted-foreground">
              Intenta recargar la página. Si el problema continúa, contacta a tu agencia.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
