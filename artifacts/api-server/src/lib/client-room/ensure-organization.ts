import { eq, like, or } from "drizzle-orm";
import { db, clientsTable, organizationsTable } from "@workspace/db";

type Executor = Pick<typeof db, "select" | "insert">;
type Organization = typeof organizationsTable.$inferSelect;

// Client Room URL slug — Camila's convention (2026-09-25): the client's name,
// lowercased, accents stripped, anything non-alphanumeric collapsed to "-".
// "Milevia Ubers Flotilla" -> "milevia-ubers-flotilla".
export function slugifyClientName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "cliente";
}

// First free slug: the base itself, then base-2, base-3, ... ("número si ya
// existe"). Pure so it's testable without a database.
export function nextFreeSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

// Every client must have a Client Room organization before anything points
// them at the portal — before this existed, organizations were only ever
// created by hand (POST /organizations), so a client converted from a
// prospect and paid through PayPal got portal credentials that led nowhere,
// and "Ver como cliente" 409'd (real case: client 24, Milevia). Idempotent:
// returns the existing organization untouched if there already is one.
// Takes an executor so prospect conversion can run it inside its own
// transaction.
export async function ensureClientRoom(clientId: number, executor: Executor = db): Promise<Organization> {
  const [existing] = await executor.select().from(organizationsTable).where(eq(organizationsTable.clientId, clientId)).limit(1);
  if (existing) return existing;

  const [client] = await executor.select().from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);
  if (!client) throw new Error(`ensureClientRoom: el cliente ${clientId} no existe`);

  const base = slugifyClientName(client.name);
  const taken = await executor.select({ slug: organizationsTable.slug }).from(organizationsTable)
    .where(or(eq(organizationsTable.slug, base), like(organizationsTable.slug, `${base}-%`)));
  const slug = nextFreeSlug(base, taken.map((r) => r.slug));

  const [created] = await executor.insert(organizationsTable).values({
    slug,
    name: client.company || client.name,
    clientId: client.id,
    contactEmail: client.email,
    contactPhone: client.phone,
    language: client.language,
  }).returning();
  return created;
}
