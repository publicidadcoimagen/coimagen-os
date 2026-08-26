import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";

function slugFromPath(pathname: string): string {
  const match = pathname.match(/^\/client\/([^/]+)/);
  return match?.[1] ?? "(desconocido)";
}

// Fire-and-forget: reports the crash to staff (incident + email alert, see
// api-server/src/routes/client-room-errors.ts). Never blocks or affects the
// fallback UI — if this itself fails (network down, etc.) the user still
// just sees the generic message below, and it's logged to the console for
// whoever eventually looks.
function reportCrash(error: Error, componentStack: string) {
  const path = window.location.pathname;
  customFetch("/api/client-room/report-error", {
    method: "POST",
    body: JSON.stringify({
      slug: slugFromPath(path),
      path,
      message: error.message,
      stack: error.stack,
      componentStack,
      userAgent: navigator.userAgent,
    }),
  }).catch((reportErr) => {
    console.error("No se pudo reportar el error del Client Room al equipo:", reportErr);
  });
}

// React error boundaries must be class components — there is no hook
// equivalent. Scoped to Client Room routes: a render-time crash there
// (e.g. a hook called outside its provider) previously reached no boundary
// at all and rendered a silent solid-black screen, undetected for 9 days
// (found 2026-08-26, useLang-outside-LanguageProvider bug). Now: catches
// any React error in this subtree (not just that one), alerts staff before
// the client has to report it, and never shows the client technical detail.
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
    reportCrash(error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center bg-background px-4">
          <div className="flex flex-col items-center gap-3 text-center max-w-sm">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <p className="text-sm font-semibold">Estamos trabajando en esto.</p>
            <p className="text-xs text-muted-foreground">
              Ya lo sabemos y lo estamos resolviendo. Si es urgente, contacta a soporte.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
