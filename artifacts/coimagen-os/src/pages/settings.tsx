import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListConfig,
  useUpsertConfig,
  getListConfigQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Link, Info, CheckCircle2, XCircle, ScrollText } from "lucide-react";
import { Link as WouterLink } from "wouter";

const INTEGRATIONS = [
  { key: "openai", name: "OpenAI", description: "GPT-4o, modelos de lenguaje", color: "#10a37f" },
  { key: "anthropic", name: "Anthropic (Claude)", description: "Claude Sonnet, Haiku", color: "#e07b39" },
  { key: "gemini", name: "Google Gemini", description: "Gemini Pro, Vision", color: "#4285f4" },
  { key: "gmail", name: "Gmail", description: "Envío de correos", color: "#ea4335" },
  { key: "google_calendar", name: "Google Calendar", description: "Gestión de agenda", color: "#34a853" },
  { key: "google_drive", name: "Google Drive", description: "Almacenamiento de archivos", color: "#fbbc04" },
  { key: "whatsapp", name: "WhatsApp Business", description: "Mensajería automatizada", color: "#25d366" },
  { key: "facebook", name: "Facebook", description: "Páginas y campañas", color: "#1877f2" },
  { key: "instagram", name: "Instagram", description: "Publicaciones y métricas", color: "#e1306c" },
  { key: "youtube", name: "YouTube", description: "Canal y analytics", color: "#ff0000" },
  { key: "n8n", name: "n8n", description: "Automatizaciones y workflows", color: "#ef5d31" },
  { key: "stripe", name: "Stripe", description: "Pagos y facturación", color: "#635bff" },
  { key: "twilio", name: "Twilio", description: "SMS y voz", color: "#f22f46" },
];

export function Settings() {
  const qc = useQueryClient();
  const { data: config, isLoading } = useListConfig({ query: { queryKey: getListConfigQueryKey() } });
  const upsert = useUpsertConfig();

  const getVal = (key: string) => config?.find((c) => c.key === key)?.value ?? "";
  const isConnected = (key: string) => getVal(`${key}_connected`) === "true";

  const [companyName, setCompanyName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#7c3aed");
  const [secondaryColor, setSecondaryColor] = useState("#0891b2");
  const [language, setLanguage] = useState("es");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) {
      setCompanyName(getVal("company_name") || "Coimagen Media Agency");
      setPrimaryColor(getVal("primary_color") || "#7c3aed");
      setSecondaryColor(getVal("secondary_color") || "#0891b2");
      setLanguage(getVal("language") || "es");
    }
  }, [config]);

  const saveGeneral = async () => {
    const pairs = [
      { key: "company_name", value: companyName },
      { key: "primary_color", value: primaryColor },
      { key: "secondary_color", value: secondaryColor },
      { key: "language", value: language },
    ];
    for (const { key, value } of pairs) {
      await new Promise<void>((res) => {
        upsert.mutate({ key, data: { value } }, { onSettled: () => res() });
      });
    }
    qc.invalidateQueries({ queryKey: getListConfigQueryKey() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="integrations">Integraciones API</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="text-base">Configuración General</CardTitle>
              <CardDescription>Personaliza la identidad de tu agencia en el sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {isLoading ? <div className="text-muted-foreground text-sm">Cargando...</div> : (
                <>
                  <div>
                    <Label>Nombre de la empresa</Label>
                    <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>Logo</Label>
                    <div className="mt-1 flex items-center gap-3 p-3 rounded-lg border border-dashed border-border/60 bg-muted/20">
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">PNG</div>
                      <div>
                        <p className="text-sm text-muted-foreground">Carga de logo disponible en V2</p>
                        <p className="text-xs text-muted-foreground/60">PNG, SVG · máx 2MB</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Color primario</Label>
                      <div className="flex gap-2 mt-1">
                        <Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-9 p-1 cursor-pointer" />
                        <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="font-mono text-sm" />
                      </div>
                    </div>
                    <div>
                      <Label>Color secundario</Label>
                      <div className="flex gap-2 mt-1">
                        <Input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-10 h-9 p-1 cursor-pointer" />
                        <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="font-mono text-sm" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Idioma</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="mt-1 w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={saveGeneral} disabled={upsert.isPending}>
                    {saved ? "Guardado" : upsert.isPending ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/40 max-w-2xl">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">Las API keys se configuran como variables de entorno en el servidor. Las conexiones OAuth se activarán en V2. Nunca se muestran las claves completas.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {INTEGRATIONS.map((intg) => {
                const connected = isConnected(intg.key);
                return (
                  <Card key={intg.key} className="border-border/50">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ backgroundColor: intg.color }}>
                            {intg.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{intg.name}</div>
                            <div className="text-xs text-muted-foreground">{intg.description}</div>
                          </div>
                        </div>
                        {connected
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          : <XCircle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 mt-0.5" />}
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">API Key</span>
                          <span className="text-xs font-mono text-muted-foreground/60">
                            {connected ? "••••••••••••" : "No configurada"}
                          </span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" disabled className="mt-3 w-full text-xs h-7 text-muted-foreground">
                        <Link className="h-3 w-3 mr-1.5" /> Conectar (V2)
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="system">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle className="text-base">Información del Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-muted-foreground">Versión</div><div className="font-mono">v1.0.0</div>
                <div className="text-muted-foreground">Entorno</div><div><Badge variant="outline" className="text-xs">Desarrollo</Badge></div>
                <div className="text-muted-foreground">Base de datos</div><div className="font-mono text-xs">PostgreSQL 16</div>
                <div className="text-muted-foreground">Runtime</div><div className="font-mono text-xs">Node.js 24</div>
                <div className="text-muted-foreground">Stack</div><div className="font-mono text-xs">Express · Drizzle · React</div>
                <div className="text-muted-foreground">Propietario</div><div>Camila Segovia · CEO</div>
              </div>
              <div className="pt-3 border-t border-border/40">
                <WouterLink href="/audit" className="text-sm text-primary hover:underline flex items-center gap-1.5">
                  <ScrollText className="h-3.5 w-3.5" /> Ver Bitácora del Sistema
                </WouterLink>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
