import { useRef, useState } from "react";
import {
  useListBeckyBeckProducts, useCreateBeckyBeckProduct, useUpdateBeckyBeckProduct, useDeleteBeckyBeckProduct,
  getListBeckyBeckProductsQueryKey,
} from "@workspace/api-client-react";
import type { BeckyBeckProduct, BeckyBeckProductCategory } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShoppingBag, Plus, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_LABEL: Record<BeckyBeckProductCategory, string> = {
  bolso: "Bolso", mochila: "Mochila", llavero: "Llavero",
};

const EMPTY_FORM = {
  nameEs: "", nameEn: "", category: "bolso" as BeckyBeckProductCategory, priceUsd: "", available: true,
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

// Shared catalog UI — used by the staff admin route (/becky-beck) and the
// client-room ecommerce module (/client/:slug/catalog, P-79). Both hit the
// same backend (Netlify Blobs, single store), so there's one catalog, not
// a parallel one per surface.
export function BeckyBeckCatalogContent() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListBeckyBeckProductsQueryKey() });

  const { data: products = [], isLoading } = useListBeckyBeckProducts({ query: { queryKey: getListBeckyBeckProductsQueryKey() } });
  const create = useCreateBeckyBeckProduct({ mutation: { onSuccess: () => { invalidate(); closeDialog(); toast({ title: "Producto agregado" }); } } });
  const update = useUpdateBeckyBeckProduct({ mutation: { onSuccess: () => { invalidate(); closeDialog(); toast({ title: "Producto actualizado" }); } } });
  const del = useDeleteBeckyBeckProduct({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Producto eliminado" }); } } });

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setImagePreview(null);
  };

  const openCreate = () => { closeDialog(); setOpen(true); };
  const openEdit = (p: BeckyBeckProduct) => {
    setEditing(p.id);
    setForm({ nameEs: p.nameEs, nameEn: p.nameEn, category: p.category, priceUsd: String(p.priceUsd), available: p.available, imageBase64: undefined });
    setImagePreview(p.imageUrl ?? null);
    setOpen(true);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUri = await fileToDataUri(file);
    setForm({ ...form, imageBase64: dataUri });
    setImagePreview(dataUri);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShoppingBag className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo</h1>
          <p className="text-sm text-muted-foreground">{products.length} productos · beckybech.netlify.app</p>
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
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.nameEs} className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{p.nameEs}</TableCell>
                    <TableCell>{CATEGORY_LABEL[p.category]}</TableCell>
                    <TableCell>${p.priceUsd} USD</TableCell>
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
              <Label className="text-xs">Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as BeckyBeckProductCategory })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bolso">Bolso</SelectItem>
                  <SelectItem value="mochila">Mochila</SelectItem>
                  <SelectItem value="llavero">Llavero</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Precio (USD) *</Label>
              <Input type="number" min="0" step="0.01" value={form.priceUsd} onChange={(e) => setForm({ ...form, priceUsd: e.target.value })} className="mt-1" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Disponible</Label>
              <Switch checked={form.available} onCheckedChange={(v) => setForm({ ...form, available: v })} />
            </div>
            <div>
              <Label className="text-xs">Foto</Label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="mt-1 text-sm" />
              {imagePreview && <img src={imagePreview} alt="Vista previa" className="mt-2 h-24 w-24 rounded object-cover" />}
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
