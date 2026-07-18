import { and, eq } from "drizzle-orm";
import { db, clientSocialCredentialsTable, decrypt } from "@workspace/db";

export interface PublishTarget {
  network: string; // "meta_facebook" | "meta_instagram" | "linkedin" | ...
  caption: string;
  mediaUrls?: string[];
}

export interface PublishResult {
  externalPostId: string;
  publishedAt: Date;
}

export interface Publisher {
  readonly mode: "metricool" | "direct";
  publish(target: PublishTarget): Promise<PublishResult>;
}

// Coimagen's own Metricool subscription is one account shared across every
// client — only the blogId (which brand within that account) is per-client,
// so the token/userId live as env vars rather than in client_social_credentials.
class MetricoolPublisher implements Publisher {
  readonly mode = "metricool" as const;

  constructor(
    private readonly userToken: string,
    private readonly userId: string,
    private readonly blogId: string,
  ) {}

  async publish(_target: PublishTarget): Promise<PublishResult> {
    // Auth: header X-Mc-Auth: <userToken>, query params userId + blogId
    // (https://help.metricool.com/en/article/basic-guide-for-api-integration-abukgf/).
    // Not wired to the real Metricool API yet — structure only.
    throw new Error("MetricoolPublisher.publish no está conectado todavía — solo estructura, pendiente de credenciales reales");
  }
}

// A client with their own Meta Developer app (e.g. Dr. Segovia) — token and
// page/IG ids are real secrets specific to that client, so they live in
// client_social_credentials like any other direct credential.
class MetaDirectPublisher implements Publisher {
  readonly mode = "direct" as const;

  constructor(
    private readonly pageAccessToken: string,
    private readonly pageId: string,
    private readonly igBusinessAccountId?: string,
  ) {}

  async publish(_target: PublishTarget): Promise<PublishResult> {
    // Facebook: POST /{page-id}/feed. Instagram: 3-step container model —
    // create container, poll until FINISHED, then publish by creation_id
    // (https://developers.facebook.com/docs/instagram-platform/content-publishing/).
    // Not wired to the real Graph API yet — structure only.
    throw new Error("MetaDirectPublisher.publish no está conectado todavía — solo estructura, pendiente de credenciales reales");
  }
}

function networkToDirectPlatform(network: string): string {
  switch (network) {
    case "meta_facebook":
    case "meta_instagram":
      return "meta";
    case "linkedin":
      return "linkedin";
    default:
      throw new Error(`Red "${network}" no tiene un publicador directo definido todavía`);
  }
}

async function getActiveCredentials(clientId: number, platform: string) {
  return db.select().from(clientSocialCredentialsTable).where(
    and(
      eq(clientSocialCredentialsTable.clientId, clientId),
      eq(clientSocialCredentialsTable.platform, platform),
      eq(clientSocialCredentialsTable.status, "active"),
    ),
  );
}

// The rest of the agent (calendar, approval flow) only ever calls this — it
// never imports MetricoolPublisher or MetaDirectPublisher directly, and
// doesn't know or care which one a given client resolves to.
export async function getPublisherForClient(clientId: number, network: string): Promise<Publisher> {
  const metricoolRows = await getActiveCredentials(clientId, "metricool");
  const blogIdRow = metricoolRows.find((r) => r.credentialType === "blog_id");
  if (blogIdRow) {
    const userToken = process.env.METRICOOL_USER_TOKEN;
    const userId = process.env.METRICOOL_USER_ID;
    if (!userToken || !userId) {
      throw new Error("METRICOOL_USER_TOKEN / METRICOOL_USER_ID no están configuradas — requeridas para publicar vía Metricool");
    }
    return new MetricoolPublisher(userToken, userId, decrypt(blogIdRow.encryptedValue));
  }

  const directPlatform = networkToDirectPlatform(network);
  const directRows = await getActiveCredentials(clientId, directPlatform);
  if (directPlatform === "meta") {
    const tokenRow = directRows.find((r) => r.credentialType === "page_access_token");
    const pageIdRow = directRows.find((r) => r.credentialType === "page_id");
    if (tokenRow && pageIdRow) {
      const igRow = directRows.find((r) => r.credentialType === "ig_business_account_id");
      return new MetaDirectPublisher(
        decrypt(tokenRow.encryptedValue),
        decrypt(pageIdRow.encryptedValue),
        igRow ? decrypt(igRow.encryptedValue) : undefined,
      );
    }
  }

  throw new Error(`No hay credenciales configuradas para cliente ${clientId} / red "${network}"`);
}
