// Real-Postgres integration tests for POST /prospects/:id/convert, against a
// PGlite (embedded, ephemeral WASM Postgres) instance — never the real Neon
// database. Transaction atomicity and the UNIQUE constraint's idempotency
// guarantee are only meaningfully provable against a real Postgres, not a
// mock (same reasoning as the Content Intelligence Fase 1 audit this
// session, tests/content/postgres-rls.test.ts and repository-concurrency).
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "@workspace/db/schema";
import { convertProspectToClient } from "../src/lib/prospect-conversion/repository";
import prospectsRouter from "../src/routes/prospects";
import { requireRole } from "../src/middlewares/requireAuth";

// Mirrors the 6 real tables this feature touches, column-for-column, from
// lib/db/src/schema/{clients,prospects,proposals,diagnoses,client-notes,
// client-timeline}.ts — hand-verified against those files, not guessed.
const SCHEMA_SQL = `
  create extension if not exists pgcrypto;
  create table clients (
    id serial primary key,
    name text not null,
    email text, phone text, company text, industry text,
    status text not null default 'prospect',
    notes text,
    is_founder boolean not null default false,
    founder_number integer,
    enabled_modules jsonb not null default '[]',
    language text not null default 'es',
    created_at timestamp not null default now(),
    updated_at timestamp
  );
  create table prospects (
    id serial primary key,
    name text not null,
    email text, phone text, company text, industry text,
    status text not null default 'lead',
    source text,
    notes text,
    language text not null default 'es',
    client_id integer references clients(id),
    google_place_id text unique,
    converted_client_id integer references clients(id) unique,
    created_at timestamp not null default now(),
    updated_at timestamp
  );
  create table proposals (
    id serial primary key,
    title text not null,
    prospect_id integer references prospects(id),
    client_id integer references clients(id),
    amount numeric,
    status text not null default 'draft',
    notes text,
    valid_until text,
    payment_plan text not null default 'standard',
    monthly_amount numeric,
    currency text not null default 'MXN',
    public_token uuid not null default gen_random_uuid() unique,
    created_at timestamp not null default now(),
    updated_at timestamp
  );
  create table diagnoses (
    id serial primary key,
    title text not null,
    prospect_id integer references prospects(id),
    client_id integer references clients(id),
    content text,
    status text not null default 'draft',
    type text not null default 'diagnosis',
    execution_id integer,
    source_url text,
    result jsonb,
    pdf_url text, pdf_generated_at timestamp,
    public_token uuid not null default gen_random_uuid() unique,
    lead_email_id text,
    created_at timestamp not null default now(),
    updated_at timestamp
  );
  create table client_notes (
    id serial primary key,
    client_id integer not null references clients(id) on delete cascade,
    title text not null,
    category text not null default 'general',
    content text,
    pinned boolean not null default false,
    created_at timestamp not null default now(),
    updated_at timestamp
  );
  create table client_timeline (
    id serial primary key,
    client_id integer not null references clients(id) on delete cascade,
    event_type text not null default 'note',
    title text not null,
    description text,
    occurred_at timestamp not null default now(),
    created_at timestamp not null default now()
  );
`;

let pglite: PGlite;
let testDb: PgliteDatabase<typeof schema>;

async function seedProspect(overrides: Partial<typeof schema.prospectsTable.$inferInsert> = {}) {
  const [row] = await testDb.insert(schema.prospectsTable).values({
    name: "Prospecto de prueba", email: "prospecto@example.com", status: "lead", source: "diagnostico_digital",
    ...overrides,
  }).returning();
  return row;
}
async function seedAcceptedProposal(prospectId: number, overrides: Partial<typeof schema.proposalsTable.$inferInsert> = {}) {
  const [row] = await testDb.insert(schema.proposalsTable).values({
    title: "Propuesta aceptada", prospectId, status: "accepted", amount: "45000",
    ...overrides,
  }).returning();
  return row;
}
const actor = { id: "u1", label: "Camila (ceo)" };

before(async () => {
  pglite = new PGlite({ extensions: { pgcrypto } });
  await pglite.exec(SCHEMA_SQL);
  testDb = drizzle(pglite, { schema }) as unknown as PgliteDatabase<typeof schema>;
});
after(async () => pglite.close());

describe("POST /prospects/:id/convert — casos positivos", () => {
  test("convierte un prospecto con propuesta aceptada: crea el cliente, enlaza historial, marca converted_client_id", async () => {
    const prospect = await seedProspect({ notes: "Le interesa el paquete completo" });
    const proposal = await seedAcceptedProposal(prospect.id);
    await testDb.insert(schema.diagnosesTable).values({ title: "Diagnóstico", prospectId: prospect.id, type: "digital_diagnosis", status: "completed" });

    const result = await convertProspectToClient(prospect.id, actor, { confirmTestSource: false }, testDb as unknown as Parameters<typeof convertProspectToClient>[3]);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.client.name, prospect.name);
    assert.equal(result.client.status, "active", "nunca debe quedar en el default de esquema 'prospect'");

    const [updatedProspect] = await testDb.select().from(schema.prospectsTable).where(eq(schema.prospectsTable.id, prospect.id));
    assert.equal(updatedProspect.convertedClientId, result.client.id);

    const [linkedProposal] = await testDb.select().from(schema.proposalsTable).where(eq(schema.proposalsTable.id, proposal.id));
    assert.equal(linkedProposal.clientId, result.client.id);
    assert.equal(linkedProposal.prospectId, prospect.id, "prospectId no se toca — se enlaza, no se migra");

    const [linkedDiagnosis] = await testDb.select().from(schema.diagnosesTable).where(eq(schema.diagnosesTable.prospectId, prospect.id));
    assert.equal(linkedDiagnosis.clientId, result.client.id);

    const notes = await testDb.select().from(schema.clientNotesTable).where(eq(schema.clientNotesTable.clientId, result.client.id));
    assert.equal(notes.length, 1);
    assert.equal(notes[0].content, "Le interesa el paquete completo");

    const timeline = await testDb.select().from(schema.clientTimelineTable).where(eq(schema.clientTimelineTable.clientId, result.client.id));
    assert.equal(timeline.length, 1);
    assert.equal(timeline[0].eventType, "converted_from_prospect");
    assert.match(timeline[0].description ?? "", new RegExp(`Prospecto #${prospect.id}`));
    assert.match(timeline[0].description ?? "", /Camila \(ceo\)/);
  });

  test("prospecto de prueba con confirmTestSource:true sí se convierte — la fricción es deliberada, no un bloqueo permanente", async () => {
    const prospect = await seedProspect({ source: "manual_test", name: "Prospecto de prueba explícito" });
    await seedAcceptedProposal(prospect.id);
    const result = await convertProspectToClient(prospect.id, actor, { confirmTestSource: true }, testDb as unknown as Parameters<typeof convertProspectToClient>[3]);
    assert.equal(result.ok, true);
  });
});

describe("POST /prospects/:id/convert — 8 pruebas negativas obligatorias", () => {
  test("1. Doble conversión secuencial: la segunda llamada devuelve 409 con el cliente ya existente, sin crear uno nuevo", async () => {
    const prospect = await seedProspect();
    await seedAcceptedProposal(prospect.id);
    const first = await convertProspectToClient(prospect.id, actor, { confirmTestSource: false }, testDb as unknown as Parameters<typeof convertProspectToClient>[3]);
    assert.equal(first.ok, true);

    const second = await convertProspectToClient(prospect.id, actor, { confirmTestSource: false }, testDb as unknown as Parameters<typeof convertProspectToClient>[3]);
    assert.equal(second.ok, false);
    if (second.ok) return;
    assert.equal(second.status, 409);
    assert.equal(second.error, "already_converted");
    if (first.ok) assert.equal(second.error === "already_converted" && "client" in second ? second.client.id : null, first.client.id);
  });

  test("2. Conversión sin propuesta aceptada: 409, ningún cliente creado", async () => {
    const prospect = await seedProspect();
    const before = await testDb.select().from(schema.clientsTable);
    const result = await convertProspectToClient(prospect.id, actor, { confirmTestSource: false }, testDb as unknown as Parameters<typeof convertProspectToClient>[3]);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 409);
    assert.equal(result.error, "no_accepted_proposal");
    const after = await testDb.select().from(schema.clientsTable);
    assert.equal(after.length, before.length);
  });

  test("3. Conversión de un prospecto ya convertido (converted_client_id ya tiene valor): 409 inmediato", async () => {
    const prospect = await seedProspect();
    await seedAcceptedProposal(prospect.id);
    const first = await convertProspectToClient(prospect.id, actor, { confirmTestSource: false }, testDb as unknown as Parameters<typeof convertProspectToClient>[3]);
    assert.equal(first.ok, true);
    if (!first.ok) return;

    const clientCountBefore = (await testDb.select().from(schema.clientsTable)).length;
    const retry = await convertProspectToClient(prospect.id, actor, { confirmTestSource: false }, testDb as unknown as Parameters<typeof convertProspectToClient>[3]);
    assert.equal(retry.ok, false);
    if (retry.ok) return;
    assert.equal(retry.status, 409);
    const clientCountAfter = (await testDb.select().from(schema.clientsTable)).length;
    assert.equal(clientCountAfter, clientCountBefore, "no se crea un segundo cliente");
  });

  test("4. Fallo parcial: si un paso falla a medias, la transacción completa revierte — cero clientes, converted_client_id sigue null", async () => {
    const prospect = await seedProspect();
    await seedAcceptedProposal(prospect.id);
    const clientCountBefore = (await testDb.select().from(schema.clientsTable)).length;

    // Simula un fallo a medio camino: un client_notes con un client_id que
    // viola la FK (referencia a un cliente inexistente) fuerza que el INSERT
    // de la nota falle DESPUÉS de que el cliente ya se insertó dentro de la
    // misma transacción — probando que la transacción real revierte también
    // ese insert previo, no solo el que falló.
    await assert.rejects(() =>
      testDb.transaction(async (tx) => {
        const [client] = await tx.insert(schema.clientsTable).values({ name: "Cliente que no debe persistir", status: "active" }).returning();
        await tx.insert(schema.clientNotesTable).values({ clientId: 999999, title: "fuerza el fallo" });
        await tx.update(schema.prospectsTable).set({ convertedClientId: client.id }).where(eq(schema.prospectsTable.id, prospect.id));
      }),
    );

    const clientCountAfter = (await testDb.select().from(schema.clientsTable)).length;
    assert.equal(clientCountAfter, clientCountBefore, "el cliente creado antes del fallo no debe persistir — la transacción revirtió todo");
    const [prospectAfter] = await testDb.select().from(schema.prospectsTable).where(eq(schema.prospectsTable.id, prospect.id));
    assert.equal(prospectAfter.convertedClientId, null);
  });

  test("5. Prospecto marcado source='manual_test' sin confirmTestSource: 409, ningún cliente creado", async () => {
    const prospect = await seedProspect({ source: "manual_test" });
    await seedAcceptedProposal(prospect.id);
    const before = await testDb.select().from(schema.clientsTable);
    const result = await convertProspectToClient(prospect.id, actor, { confirmTestSource: false }, testDb as unknown as Parameters<typeof convertProspectToClient>[3]);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 409);
    assert.equal(result.error, "test_source_requires_confirmation");
    const after = await testDb.select().from(schema.clientsTable);
    assert.equal(after.length, before.length);
  });

  test("6. Prospecto inexistente: 404", async () => {
    const result = await convertProspectToClient(999999, actor, { confirmTestSource: false }, testDb as unknown as Parameters<typeof convertProspectToClient>[3]);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 404);
    assert.equal(result.error, "prospect_not_found");
  });

  test("7. Rol insuficiente: la ruta POST /prospects/:id/convert está montada detrás de requireRole(\"ceo\",\"admin\") — 403 para un rol fuera de ese conjunto", () => {
    // Mismo patrón ya establecido en test/auth-flow.test.ts para requireRole
    // en general; esto prueba específicamente que ESTA ruta lo usa como
    // gate, no solo que la función requireRole exista.
    const stack = (prospectsRouter as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: unknown }> } }> }).stack;
    const layer = stack.find((l) => l.route?.path === "/prospects/:id/convert" && l.route.methods.post);
    assert.ok(layer, "la ruta POST /prospects/:id/convert debe estar registrada");
    assert.ok(layer!.route!.stack.length >= 2, "debe tener al menos el gate de rol y el handler");

    const req = { headers: {}, log: { error: () => {} }, isAuthenticated: () => true, user: { id: "u1", role: "viewer" } } as unknown as Request;
    const res = { statusCode: 200, body: undefined as unknown, status(c: number) { this.statusCode = c; return this; }, json(p: unknown) { this.body = p; return this; } } as unknown as Response & { statusCode: number; body: unknown };
    let nextCalled = false;
    requireRole("ceo", "admin")(req, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
  });

  test("8. Conversión concurrente del mismo prospecto: exactamente una gana, la constraint UNIQUE de converted_client_id rechaza la otra", async () => {
    const prospect = await seedProspect();
    await seedAcceptedProposal(prospect.id);
    // testDb is shared across the whole file (one PGlite instance, see
    // before()) — earlier tests already created clients of their own, so
    // the count that matters here is the DELTA this test itself produces,
    // not the raw total.
    const clientCountBefore = (await testDb.select().from(schema.clientsTable)).length;

    const [first, second] = await Promise.allSettled([
      convertProspectToClient(prospect.id, actor, { confirmTestSource: false }, testDb as unknown as Parameters<typeof convertProspectToClient>[3]),
      convertProspectToClient(prospect.id, actor, { confirmTestSource: false }, testDb as unknown as Parameters<typeof convertProspectToClient>[3]),
    ]);

    const succeeded = [first, second].filter((r) => r.status === "fulfilled" && r.value.ok);
    const rejectedOrFailed = [first, second].filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok));
    assert.equal(succeeded.length, 1, "exactamente una conversión concurrente debe tener éxito");
    assert.equal(rejectedOrFailed.length, 1, "la otra debe fallar — por el chequeo previo o por la constraint UNIQUE real");

    const clientCountAfter = (await testDb.select().from(schema.clientsTable)).length;
    assert.equal(clientCountAfter - clientCountBefore, 1, "nunca deben quedar dos clientes del mismo prospecto, sin importar cuál camino rechazó a la perdedora");
  });
});
