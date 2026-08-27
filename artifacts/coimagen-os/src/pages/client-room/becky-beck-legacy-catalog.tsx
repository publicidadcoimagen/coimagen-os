import { useListBeckyBeckLegacyProducts } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag } from "lucide-react";
import { useLang } from "@/context/LanguageContext";

// Becky Beck's real catalog (48 products) lives in the original P-77
// Netlify Functions + Blobs storefront (becky-beck-site), never migrated
// into the newer Postgres `products` table (pendiente #5) — this page reads
// it read-only through the api-server proxy in becky-beck-legacy.ts instead
// of the generic CatalogContent/products table every other ecommerce client
// uses. Product management still happens on the original storefront's own
// admin flow, not here.
export function BeckyBeckLegacyCatalog() {
  const { lang, t } = useLang();
  const { data: products = [], isLoading } = useListBeckyBeckLegacyProducts();

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
              <CardContent className="p-3 space-y-1">
                <p className="text-sm font-medium leading-tight">{lang === "es" ? p.nameEs : p.nameEn}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">${p.priceUsd.toFixed(2)} USD</span>
                  <Badge variant={p.available ? "default" : "secondary"} className="text-[10px]">
                    {p.available ? "Disponible" : "Agotado"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
