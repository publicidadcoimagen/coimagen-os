import { useMemo, useState } from "react";
import { useListClients, getListClientsQueryKey } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CatalogContent } from "./catalog-content";

// Staff admin view — one client's catalog at a time, since the underlying
// data is now real multi-tenant storage (P-77 generalized, pendiente #5),
// not the single hardcoded Becky Beck store it used to be.
export function CatalogAdmin() {
  const { data: clients = [] } = useListClients({ query: { queryKey: getListClientsQueryKey() } });
  const ecommerceClients = useMemo(
    () => clients.filter((c) => c.enabledModules?.includes("ecommerce")),
    [clients],
  );
  const [selected, setSelected] = useState<number | null>(null);
  const clientId = selected ?? ecommerceClients[0]?.id ?? null;

  if (ecommerceClients.length === 0) {
    return <p className="text-sm text-muted-foreground p-6">Ningún cliente tiene el módulo de e-commerce activado todavía.</p>;
  }

  return (
    <div className="space-y-4">
      {ecommerceClients.length > 1 && (
        <Select value={String(clientId)} onValueChange={(v) => setSelected(Number(v))}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ecommerceClients.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {clientId != null && <CatalogContent clientId={clientId} />}
    </div>
  );
}
