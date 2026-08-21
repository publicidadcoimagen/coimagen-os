import { useRef, useState } from "react";
import {
  useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShoppingBag, Plus, Trash2, Pencil, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EMPTY_FORM = {
  nameEs: "", nameEn: "", description: "", category: "", priceUsd: "", stock: "", sku: "", available: true,
  imagesBase64: [] as string[],
};

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Generalizes the old Becky-Beck-only catalog (P-77) into a real
// multi-tenant catalog — used by the staff admin route (/catalog) and the
// client-room ecommerce module (/client/:slug/catalog, P-79). `clientId`
// scopes staff views to one client at a time; a cliente-role session is
// always forced to its own client server-side regardless of what's passed
// here, so omitting it there is safe.
export function CatalogContent({ clientId }: { clientId?: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const queryKey = getListProductsQueryKey({ clientId });
  const invalidate = () => qc.invalidateQueries({ queryKey });

  const { data: products = [], isLoading } = useListProducts({ clientId }, { query: { queryKey } });
  const create = useCreateProduct({ mutation: { onSuccess: () => { invalidate(); closeDialog(); toast({ title: "Producto agregado" }); } } });
  const update = useUpdateProduct({ mutation: { onSuccess: () => { invalidate(); closeDialog(); toast({ title: "Producto actualizado" }); } } });
  const del = useDeleteProduct({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Producto eliminado" }); } } });

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  };

  const openCreate = () => { closeDialog(); setOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p.id);
    setForm({
      nameEs: p.nameEs, nameEn: p.nameEn, description: p.description ?? "", category: p.category,
      priceUsd: (p.priceCents / 100).toFixed(2), stock: p.stock != null ? String(p.stock) : "", sku: p.sku ?? "",
      available: p.available, imagesBase64: [],
    });
    setOpen(true);
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const dataUris = await Promise.all(files.map(fileToDataUri));
    setForm((f) => ({ ...f, imagesBase64: [...f.imagesBase64, ...dataUris] }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeNewImage = (index: number) => {
    setForm((f) => ({ ...f, imagesBase64: f.imagesBase64.filter((_, i) => i !== index) }));
  };

  const handleSubmit = () => {
    const price = Number(form.priceUsd);
    if (!form.nameEs || !form.nameEn || !form.category || Number.isNaN(price) || price < 0) return;
    const data = {
      ...(clientId != null ? { clientId } : {}),
      nameEs: form.nameEs,
      nameEn: form.nameEn,
      description: form.description || undefined,
      category: form.category,
      priceCents: Math.round(price * 100),
      stock: form.stock ? Number(form.stock) : undefined,
      sku: form.sku || undefined,
      available: form.available,
      ...(form.imagesBase64.length ? { imagesBase64: form.imagesBase64 } : {}),
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
          <h1 className="text-2xl font-bold tracking-tight">Catálogo</h1>
          <p className="text-sm text-muted-foreground">{products.length} productos</p>
        </div>
        <Button size="sm" className="ml-auto gap-1.5" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Agregar producto
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Cargando...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Sin productos todavía</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16"></TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.imageUrls[0] ? (
                        <img src={p.imageUrls[0]} alt={p.nameEs} className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{p.nameEs}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell>${(p.priceCents / 100).toFixed(2)} {p.currency}</TableCell>
                    <TableCell>{p.stock ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={p.available ? "default" : "secondary"}>
                        {p.available ? "Disponible" : "Agotado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => del.mutate({ id: p.id })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
            <div>
              <Label className="text-xs">Descripción</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" rows={3} />
            </div>
            <div>
              <Label className="text-xs">Categoría *</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1" placeholder="p. ej. bolso, playera, servicio" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Precio (USD) *</Label>
                <Input type="number" min="0" step="0.01" value={form.priceUsd} onChange={(e) => setForm({ ...form, priceUsd: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Stock (vacío = ilimitado)</Label>
                <Input type="number" min="0" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">SKU</Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="mt-1" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Disponible</Label>
              <Switch checked={form.available} onCheckedChange={(v) => setForm({ ...form, available: v })} />
            </div>
            <div>
              <Label className="text-xs">Fotos {editing ? "(reemplaza todas las existentes si agregas alguna)" : ""}</Label>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleFiles} className="mt-1 text-sm" />
              <div className="mt-2 flex flex-wrap gap-2">
                {form.imagesBase64.map((uri, i) => (
                  <div key={i} className="relative">
                    <img src={uri} alt="" className="h-16 w-16 rounded object-cover" />
                    <button type="button" onClick={() => removeNewImage(i)} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {!form.imagesBase64.length && editingProduct?.imageUrls.map((url, i) => (
                  <img key={i} src={url} alt="" className="h-16 w-16 rounded object-cover opacity-70" />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSaving || !form.nameEs || !form.nameEn || !form.category || !form.priceUsd}>
              {editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
