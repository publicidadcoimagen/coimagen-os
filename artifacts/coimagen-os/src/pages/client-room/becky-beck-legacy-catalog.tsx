import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBeckyBeckLegacyProducts, getListBeckyBeckLegacyProductsQueryKey,
  useCreateBeckyBeckLegacyProduct, useUpdateBeckyBeckLegacyProduct, useDeleteBeckyBeckLegacyProduct,
} from "@workspace/api-client-react";
import type { BeckyBeckLegacyProduct } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShoppingBag, Plus, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/context/LanguageContext";

const CATEGORIES = ["bolso", "mochila", "llavero"] as const;

const EMPTY_FORM = {
  nameEs: "", nameEn: "", category: "bolso" as (typeof CATEGORIES)[number], priceUsd: "", available: true,
  imageBase64: undefined as string | undefined,
};

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Becky Beck's real catalog (48 products) lives in the original P-77
// Netlify Functions + Blobs storefront (becky-beck-site), never migrated
// into the newer Postgres `products` table (pendiente #5) — this page
// reads and writes it through the api-server proxy in becky-beck-legacy.ts
// instead of the generic CatalogContent/products table every other
// ecommerce client uses. Writes land in the same Netlify Blobs store her
// public site's own Functions read from, so they show up there directly
// (subject to that endpoint's ~60s cache).
export function BeckyBeckLegacyCatalog() {
  const { lang, t } = useLang();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const queryKey = getListBeckyBeckLegacyProductsQueryKey();
  const invalidate = () => qc.invalidateQueries({ queryKey });

  const { data: products = [], isLoading } = useListBeckyBeckLegacyProducts({ query: { queryKey } });
  const create = useCreateBeckyBeckLegacyProduct({ mutation: { onSuccess: () => { invalidate(); closeDialog(); toast({ title: "Producto agregado" }); } } });
  const update = useUpdateBeckyBeckLegacyProduct({ mutation: { onSuccess: () => { invalidate(); closeDialog(); toast({ title: "Producto actualizado" }); } } });
  const del = useDeleteBeckyBeckLegacyProduct({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Producto eliminado" }); } } });

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  };

  const openCreate = () => { closeDialog(); setOpen(true); };
  const openEdit = (p: BeckyBeckLegacyProduct) => {
    setEditing(p.id);
    setForm({ nameEs: p.nameEs, nameEn: p.nameEn, category: p.category, priceUsd: p.priceUsd.toFixed(2), available: p.available, imageBase64: undefined });
    setOpen(true);
  };

  const handleDelete = (p: BeckyBeckLegacyProduct) => {
    if (!confirm(`¿Eliminar "${lang === "es" ? p.nameEs : p.nameEn}"? Esto lo borra del catálogo real, no se puede deshacer.`)) return;
    del.mutate({ id: p.id });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/jpeg") {
      toast({ title: "La imagen debe ser JPEG", variant: "destructive" });
      return;
    }
    const imageBase64 = await fileToDataUri(file);
    setForm((f) => ({ ...f, imageBase64 }));
  };

  const handleSubmit = () => {
    const price = Number(form.priceUsd);
    if (!form.nameEs || !form.nameEn || Number.isNaN(price) || price < 0) return;
    const data = {
      nameEs: form.nameEs,
      nameEn: form.nameEn,
      category: form.category,
      priceUsd: price,
      available: form.available,
      ...(form.imageBase64 ? { imageBase64: form.imageBase64 } : {}),
    };
    if (editing) update.mutate({ id: editing, data });
    else create.mutate({ data });
  };

  const isSaving = create.isPending || update.isPending;
  const editingProduct = editing ? products.find((p) => p.id === editing) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShoppingBag className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.nav.catalog}</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? t.common.loading : `${products.length} productos`}
          </p>
        </div>
        <Button size="sm" className="ml-auto gap-1.5" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Agregar producto
        </Button>
      </div>

      {!isLoading && products.length === 0 ? (
        <Card><CardContent className="text-center py-8 text-muted-foreground text-sm">Sin productos todavía</CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {products.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="aspect-square bg-muted">
                {p.imageUrl && (
                  <img src={p.imageUrl} alt={lang === "es" ? p.nameEs : p.nameEn} className="h-full w-full object-cover" />
                )}
              </div>
              <CardContent className="p-3 space-y-2">
                <p className="text-sm font-medium leading-tight">{lang === "es" ? p.nameEs : p.nameEn}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">${p.priceUsd.toFixed(2)} USD</span>
                  <Badge variant={p.available ? "default" : "secondary"} className="text-[10px]">
                    {p.available ? "Disponible" : "Agotado"}
                  </Badge>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => handleDelete(p)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nombre (Español) *</Label>
              <Input value={form.nameEs} onChange={(e) => setForm({ ...form, nameEs: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Nombre (Inglés) *</Label>
              <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Categoría *</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as (typeof CATEGORIES)[number] })}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Precio (USD) *</Label>
                <Input type="number" min="0" step="0.01" value={form.priceUsd} onChange={(e) => setForm({ ...form, priceUsd: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Disponible</Label>
              <Switch checked={form.available} onCheckedChange={(v) => setForm({ ...form, available: v })} />
            </div>
            <div>
              <Label className="text-xs">Foto (JPEG){editing ? " — deja vacío para conservar la actual" : ""}</Label>
              <input type="file" accept="image/jpeg" onChange={handleFile} className="mt-1 text-sm" />
              {(form.imageBase64 ?? editingProduct?.imageUrl) && (
                <img src={form.imageBase64 ?? editingProduct?.imageUrl ?? undefined} alt="" className="mt-2 h-16 w-16 rounded object-cover opacity-90" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSaving || !form.nameEs || !form.nameEn || !form.priceUsd}>
              {editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
