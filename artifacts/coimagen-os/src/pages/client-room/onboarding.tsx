import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOrganization, getGetOrganizationQueryKey,
  useGetClientOnboarding, getGetClientOnboardingQueryKey,
  usePatchClientOnboarding,
} from "@workspace/api-client-react";
import type { ClientOnboarding, ClientOnboardingModuleContact } from "@workspace/api-client-react";
import { ClientRoomLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, ChevronRight, ArrowLeft, CheckCircle2, Trash2, Plus } from "lucide-react";
import { useLang } from "@/context/LanguageContext";

type Org = { id: number; slug: string; name: string; clientId?: number | null };

type BoolKey = "hasLogo" | "hasBrandColors" | "hasBusinessInfo" | "hasWebsiteAccess" | "hasDomainAccess" | "hasHostingAccess" | "hasFacebookAccess" | "hasInstagramAccess" | "hasGoogleBusinessAccess" | "hasWhatsappAccess";

const ALL_KEYS: BoolKey[] = [
  "hasLogo", "hasBrandColors", "hasBusinessInfo", "hasWebsiteAccess", "hasDomainAccess",
  "hasHostingAccess", "hasFacebookAccess", "hasInstagramAccess", "hasGoogleBusinessAccess", "hasWhatsappAccess",
];

// The 5 wizard steps, grouped by topic — step index (0-based) -> which
// boolean checklist keys live on that step. Steps 4 (contacts) and 5
// (notes) have no checklist keys of their own.
const STEP_KEYS: BoolKey[][] = [
  ["hasLogo", "hasBrandColors", "hasBusinessInfo"],
  ["hasWebsiteAccess", "hasDomainAccess", "hasHostingAccess"],
  ["hasFacebookAccess", "hasInstagramAccess", "hasGoogleBusinessAccess", "hasWhatsappAccess"],
  [],
  [],
];

const MODULE_OPTIONS = ["general", "facturacion", "marketing_contenido", "redes_sociales", "aprobaciones", "ecommerce", "seo"];

type FormState = {
  bools: Record<BoolKey, boolean>;
  moduleContacts: ClientOnboardingModuleContact[];
  notes: string;
};

const emptyForm: FormState = {
  bools: Object.fromEntries(ALL_KEYS.map((k) => [k, false])) as Record<BoolKey, boolean>,
  moduleContacts: [],
  notes: "",
};

function fromServer(ob: ClientOnboarding): FormState {
  return {
    bools: Object.fromEntries(ALL_KEYS.map((k) => [k, !!ob[k]])) as Record<BoolKey, boolean>,
    moduleContacts: ob.moduleContacts ?? [],
    notes: ob.notes ?? "",
  };
}

export function ClientOnboarding() {
  const [, params] = useRoute("/client/:slug/onboarding");
  const slug = params?.slug ?? "";

  return (
    <ClientRoomLayout slug={slug}>
      <ClientOnboardingBody slug={slug} />
    </ClientRoomLayout>
  );
}

// useLang() must run inside LanguageProvider's subtree, which ClientRoomLayout
// mounts as a child — calling it in the exported route component (an ancestor
// of ClientRoomLayout) throws on every render (fixed 2026-08-26).
function ClientOnboardingBody({ slug }: { slug: string }) {
  const { t } = useLang();
  const queryClient = useQueryClient();

  const { data: rawOrg } = useGetOrganization(slug, { query: { queryKey: getGetOrganizationQueryKey(slug) } });
  const org = rawOrg as Org | undefined;
  const clientId = org?.clientId ?? 0;

  const { data: onboarding, isLoading } = useGetClientOnboarding(clientId, {
    query: { queryKey: getGetClientOnboardingQueryKey(clientId), enabled: !!clientId },
  });

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (onboarding) setForm(fromServer(onboarding));
  }, [onboarding?.id]);

  const { mutate: patch, isPending: saving } = usePatchClientOnboarding({
    mutation: {
      onSuccess: (result) => {
        queryClient.setQueryData(getGetClientOnboardingQueryKey(clientId), result);
      },
    },
  });

  const save = useCallback((overrides?: Partial<FormState> & { submit?: boolean }) => {
    const next = { ...form, ...overrides };
    patch({
      clientId,
      data: {
        ...next.bools,
        moduleContacts: next.moduleContacts,
        notes: next.notes,
        submit: overrides?.submit,
      },
    });
    setForm(next);
  }, [form, clientId, patch]);

  const toggleBool = (key: BoolKey) => {
    setForm((f) => ({ ...f, bools: { ...f.bools, [key]: !f.bools[key] } }));
  };

  const addContact = () => {
    setForm((f) => ({
      ...f,
      moduleContacts: [...f.moduleContacts, { module: MODULE_OPTIONS[0]!, contactName: "", contactEmail: null, notes: null }],
    }));
  };

  const updateContact = (idx: number, patch: Partial<ClientOnboardingModuleContact>) => {
    setForm((f) => ({
      ...f,
      moduleContacts: f.moduleContacts.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }));
  };

  const removeContact = (idx: number) => {
    setForm((f) => ({ ...f, moduleContacts: f.moduleContacts.filter((_, i) => i !== idx) }));
  };

  if (!clientId || isLoading) {
    return (
      <div className="space-y-5">
        <Card><CardContent className="p-6 animate-pulse text-sm text-muted-foreground">{t.common.loading}</CardContent></Card>
      </div>
    );
  }

  const stepLabels = t.onboarding.wizard.stepLabels;
  const doneCount = ALL_KEYS.filter((k) => form.bools[k]).length;
  const progress = Math.round((doneCount / ALL_KEYS.length) * 100);
  const isSubmitted = !!onboarding?.submittedAt;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">{t.onboarding.title}</h1>
          <p className="text-sm text-muted-foreground">{t.onboarding.subtitle}</p>
        </div>
        <Badge
          variant="outline"
          className={`ml-auto text-[10px] ${isSubmitted ? "bg-green-400/10 text-green-400 border-green-400/30" : "bg-blue-400/10 text-blue-400 border-blue-400/30"}`}
        >
          {isSubmitted ? t.onboarding.wizard.submittedBadge : t.onboarding.wizard.editableBadge}
        </Badge>
      </div>

      {isSubmitted && onboarding?.submittedAt && (
        <p className="text-xs text-muted-foreground">
          {t.onboarding.wizard.submittedAt(new Date(onboarding.submittedAt).toLocaleDateString())}
        </p>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t.onboarding.wizard.stepOf(step + 1, stepLabels.length)}</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="flex items-center justify-between overflow-x-auto pb-1 gap-1">
        {stepLabels.map((label, idx) => (
          <button
            key={label}
            onClick={() => setStep(idx)}
            className={`flex-1 min-w-[70px] text-center px-1 py-1.5 rounded-md text-[10px] font-medium transition-all ${
              idx === step ? "bg-primary/15 text-primary border border-primary/40" : "text-muted-foreground border border-transparent hover:border-border/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="border-border/50">
        <CardContent className="p-5 space-y-3">
          {step < 3 && STEP_KEYS[step]!.map((key) => (
            <label key={key} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 cursor-pointer hover:border-border transition-colors">
              <input
                type="checkbox"
                checked={form.bools[key]}
                onChange={() => toggleBool(key)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm">{t.onboarding.checklist[key]}</span>
              {form.bools[key] && <CheckCircle2 className="h-4 w-4 text-green-400 ml-auto" />}
            </label>
          ))}

          {step === 3 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold">{t.onboarding.wizard.moduleContactsTitle}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t.onboarding.wizard.moduleContactsHint}</p>
              </div>
              {form.moduleContacts.length === 0 && (
                <p className="text-xs text-muted-foreground">{t.onboarding.wizard.moduleContactsEmpty}</p>
              )}
              <div className="space-y-3">
                {form.moduleContacts.map((c, idx) => (
                  <div key={idx} className="rounded-lg border border-border/40 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">{t.onboarding.wizard.moduleLabel}</Label>
                        <Select value={c.module} onValueChange={(v) => updateContact(idx, { module: v })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MODULE_OPTIONS.map((m) => (
                              <SelectItem key={m} value={m}>{t.onboarding.wizard.moduleOptions[m] ?? m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 mt-4" onClick={() => removeContact(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">{t.onboarding.wizard.contactNameLabel}</Label>
                        <Input className="h-8 text-xs" value={c.contactName} onChange={(e) => updateContact(idx, { contactName: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">{t.onboarding.wizard.contactEmailLabel}</Label>
                        <Input className="h-8 text-xs" type="email" value={c.contactEmail ?? ""} onChange={(e) => updateContact(idx, { contactEmail: e.target.value || null })} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">{t.onboarding.wizard.contactNotesLabel}</Label>
                      <Input className="h-8 text-xs" value={c.notes ?? ""} onChange={(e) => updateContact(idx, { notes: e.target.value || null })} />
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addContact} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />{t.onboarding.wizard.addContact}
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t.onboarding.wizard.notesLabel}</Label>
                <Textarea
                  rows={4}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={t.onboarding.wizard.notesPlaceholder}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t.onboarding.wizard.submitConfirm}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-1">
        <Button variant="outline" size="sm" onClick={() => save()} disabled={saving}>
          {saving ? t.common.saving : t.common.save}
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />{t.common.previous}
            </Button>
          )}
          {step < stepLabels.length - 1 && (
            <Button size="sm" onClick={() => { save(); setStep((s) => s + 1); }} disabled={saving}>
              {t.common.next}<ChevronRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          )}
          {step === stepLabels.length - 1 && (
            <Button size="sm" onClick={() => save({ submit: true })} disabled={saving} className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="h-4 w-4 mr-1.5" />{saving ? t.common.submitting : t.onboarding.wizard.markDone}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
