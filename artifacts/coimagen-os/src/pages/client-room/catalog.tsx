import { useRoute } from "wouter";
import { useGetOrganization, getGetOrganizationQueryKey } from "@workspace/api-client-react";
import { ClientRoomLayout } from "./layout";
import { CatalogContent } from "@/pages/catalog/catalog-content";
import { BeckyBeckLegacyCatalog } from "./becky-beck-legacy-catalog";

export function ClientCatalog() {
  const [, params] = useRoute("/client/:slug/catalog");
  const slug = params?.slug ?? "";
  // Resolves the real clientId from the org (not just relying on session
  // auto-scoping) so this also renders correctly for a staff member
  // browsing a specific client's portal, not only for that client's own
  // cliente-role login.
  const { data: org } = useGetOrganization(slug, { query: { queryKey: getGetOrganizationQueryKey(slug) } });

  return (
    <ClientRoomLayout slug={slug}>
      {slug === "beckybeck" ? (
        <BeckyBeckLegacyCatalog />
      ) : (
        <CatalogContent clientId={org?.clientId ?? undefined} />
      )}
    </ClientRoomLayout>
  );
}
