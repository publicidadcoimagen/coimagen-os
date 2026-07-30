import { and, eq } from "drizzle-orm";
import { db, clientSocialCredentialsTable, systemCredentialsTable, decrypt } from "@workspace/db";

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

const METRICOOL_API_BASE = "https://app.metricool.com/v2";

// Metricool's timezone is required per-post (publicationDate.timezone) and
// isn't tracked per-client anywhere yet — hardcoded to Coimagen's own base
// until client-level timezones become a real need.
const METRICOOL_DEFAULT_TIMEZONE = process.env.METRICOOL_DEFAULT_TIMEZONE ?? "America/Tijuana";

// Metricool has no dedicated "publish now" endpoint — it's the scheduler API
// with autoPublish:true and a publicationDate of right now
// (https://help.metricool.com/en/article/basic-guide-for-api-integration-abukgf/).
// Note: for Instagram/TikTok, autoPublish:true only actually auto-publishes
// if the account is connected in Metricool as a proper Business/Creator
// account — otherwise Metricool silently falls back to sending a human a
// push notification to publish manually instead
// (https://help.metricool.com/en/article/why-cant-i-enable-auto-publishing-qb77c0/).
// This function can't detect that case from the API response alone; it's a
// known gap to watch for once real credentials exist.
function networkToMetricoolProvider(network: string): string {
  switch (network) {
    case "meta_facebook":
      return "facebook";
    case "meta_instagram":
      return "instagram";
    case "linkedin":
      return "linkedin";
    default:
      throw new Error(`Red "${network}" no tiene mapeo a un provider de Metricool todavía`);
  }
}

export interface MetricoolCredentials {
  userToken: string;
  userId: string;
  blogId: string;
}

export interface MetricoolRequest {
  url: string;
  headers: Record<string, string>;
  body: {
    providers: string[];
    text: string;
    media: string[];
    publicationDate: { dateTime: string; timezone: string };
    autoPublish: true;
  };
}

// Pure — no network I/O — so this can be unit-tested without spending real
// Metricool API usage or needing real credentials.
export function buildMetricoolPublishRequest(target: PublishTarget, creds: MetricoolCredentials): MetricoolRequest {
  const url = `${METRICOOL_API_BASE}/scheduler/posts?userId=${encodeURIComponent(creds.userId)}&blogId=${encodeURIComponent(creds.blogId)}`;
  return {
    url,
    headers: {
      "X-Mc-Auth": creds.userToken,
      "Content-Type": "application/json",
    },
    body: {
      providers: [networkToMetricoolProvider(target.network)],
      text: target.caption,
      media: target.mediaUrls ?? [],
      // ISO 8601 without a trailing "Z" — Metricool takes the offset from
      // the separate "timezone" field, not from the dateTime string itself.
      publicationDate: { dateTime: new Date().toISOString().slice(0, 19), timezone: METRICOOL_DEFAULT_TIMEZONE },
      autoPublish: true,
    },
  };
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

  async publish(target: PublishTarget): Promise<PublishResult> {
    const { url, headers, body } = buildMetricoolPublishRequest(target, {
      userToken: this.userToken,
      userId: this.userId,
      blogId: this.blogId,
    });

    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Metricool respondió ${response.status} al publicar en "${target.network}": ${errorBody}`);
    }

    // Field name unconfirmed — no successful real call has been made yet
    // (no Metricool subscription contracted as of this writing). Verify
    // this against a real response during the first end-to-end test and
    // adjust here if the id comes back under a different key.
    const data = await response.json() as { id?: string | number };
    if (data.id === undefined) {
      throw new Error(`Metricool no devolvió un id de post reconocible al publicar en "${target.network}": ${JSON.stringify(data)}`);
    }

    return { externalPostId: String(data.id), publishedAt: new Date() };
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

// Account-level secret (e.g. Coimagen's own Metricool subscription) — see
// system_credentials, the account-scoped counterpart of client_social_credentials.
async function getSystemCredential(provider: string, credentialType: string): Promise<string> {
  const [row] = await db.select().from(systemCredentialsTable).where(
    and(
      eq(systemCredentialsTable.provider, provider),
      eq(systemCredentialsTable.credentialType, credentialType),
      eq(systemCredentialsTable.status, "active"),
    ),
  );
  if (!row) {
    throw new Error(`Credencial de sistema "${provider}/${credentialType}" no configurada — agrégala en Configuración > Integraciones API`);
  }
  return decrypt(row.encryptedValue);
}

// The rest of the agent (calendar, approval flow) only ever calls this — it
// never imports MetricoolPublisher or MetaDirectPublisher directly, and
// doesn't know or care which one a given client resolves to.
export async function getPublisherForClient(clientId: number, network: string): Promise<Publisher> {
  const metricoolRows = await getActiveCredentials(clientId, "metricool");
  const blogIdRow = metricoolRows.find((r) => r.credentialType === "blog_id");
  if (blogIdRow) {
    const userToken = await getSystemCredential("metricool", "user_token");
    const userId = await getSystemCredential("metricool", "user_id");
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
