import { useRoute } from "wouter";
import { ClientRoomLayout } from "./layout";
import { BeckyBeckCatalogContent } from "@/pages/becky-beck/catalog-content";

export function ClientCatalog() {
  const [, params] = useRoute("/client/:slug/catalog");
  const slug = params?.slug ?? "";

  return (
    <ClientRoomLayout slug={slug}>
      <BeckyBeckCatalogContent />
    </ClientRoomLayout>
  );
}
