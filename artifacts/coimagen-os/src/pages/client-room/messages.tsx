import { useRoute } from "wouter";
import { ClientRoomLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Construction, Send, Users } from "lucide-react";

export function ClientMessages() {
  const [, params] = useRoute("/client/:slug/messages");
  const slug = params?.slug ?? "";

  const features = [
    "Mensajes directos con tu equipo COIMAGEN",
    "Hilos por proyecto y tarea",
    "Notificaciones de actualizaciones",
    "Historial completo de conversaciones",
    "Adjuntar archivos y referencias",
    "Menciones con @nombre",
  ];

  return (
    <ClientRoomLayout slug={slug}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Mensajes</h1>
            <p className="text-sm text-muted-foreground">Canal de comunicación directa con tu equipo</p>
          </div>
          <Badge variant="outline" className="ml-auto text-[9px] py-0 bg-amber-400/10 text-amber-400 border-amber-400/30">Próximamente</Badge>
        </div>

        <div className="flex flex-col items-center justify-center py-14 gap-6">
          <div className="relative">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-10 w-10 text-primary/40" />
            </div>
            <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-amber-400/20 flex items-center justify-center">
              <Construction className="h-3.5 w-3.5 text-amber-400" />
            </div>
          </div>
          <div className="text-center space-y-2 max-w-sm">
            <h2 className="text-lg font-bold">Canal de mensajes en construcción</h2>
            <p className="text-sm text-muted-foreground">
              Muy pronto podrás comunicarte directamente con el equipo de COIMAGEN desde tu Client Room, sin necesidad de correo externo.
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-3">Lo que vendrá</p>
          <div className="grid grid-cols-2 gap-2">
            {features.map((feat) => (
              <Card key={feat} className="border-border/40">
                <CardContent className="p-3 flex items-center gap-2">
                  <Send className="h-3.5 w-3.5 text-primary/40 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">{feat}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs font-semibold text-primary">¿Necesitas comunicarte ahora?</p>
              <p className="text-[11px] text-muted-foreground">Escríbenos a hola@coimagenmedia.com o a tu Director asignado</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </ClientRoomLayout>
  );
}
