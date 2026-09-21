// Real-Postgres tests (PGlite, embedded/ephemeral) for lib/agent-scope.ts —
// Context Engine v0. Same rationale as prospect-conversion.test.ts: this is
// specifically an authorization boundary, so it's tested against a real
// Postgres `inArray`/`eq` evaluation, not a mock.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "@workspace/db/schema";
import { agentClientIds, agentOwnsClientId } from "../src/lib/agent-scope";

const SCHEMA_SQL = `
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
    access_gate_exempt boolean not null default false,
    created_at timestamp not null default now(),
    updated_at timestamp
  );
  create table mcp_agent_scopes (
    agent_key varchar(128) not null,
    client_id integer not null references clients(id) on delete cascade,
    note text,
    created_at timestamp with time zone not null default now(),
    primary key (agent_key, client_id)
  );
`;

let pglite: PGlite;
let testDb: PgliteDatabase<typeof schema>;

async function seedClient(name: string) {
  const [row] = await testDb.insert(schema.clientsTable).values({ name }).returning();
  return row;
}

before(async () => {
  pglite = new PGlite();
  await pglite.exec(SCHEMA_SQL);
  testDb = drizzle(pglite, { schema }) as unknown as PgliteDatabase<typeof schema>;
});
after(async () => pglite.close());

describe("agentClientIds / agentOwnsClientId — Context Engine v0", () => {
  test("agentKey con cero filas de scope: falla cerrado ([-1]), nunca 've todo'", async () => {
    const ids = await agentClientIds("agent-sin-scopes", testDb as unknown as Parameters<typeof agentClientIds>[1]);
    assert.deepEqual(ids, [-1]);
    const owns = await agentOwnsClientId("agent-sin-scopes", 1, testDb as unknown as Parameters<typeof agentOwnsClientId>[2]);
    assert.equal(owns, false);
  });

  test("agentKey con un solo clientId autorizado: solo ese id, ningún otro", async () => {
    const chimiChimi = await seedClient("Chimi Chimi");
    const emt = await seedClient("Clínica EMT");
    await testDb.insert(schema.mcpAgentScopesTable).values({ agentKey: "agent-chimichimi", clientId: chimiChimi.id, note: "piloto MCP" });

    const ids = await agentClientIds("agent-chimichimi", testDb as unknown as Parameters<typeof agentClientIds>[1]);
    assert.deepEqual(ids, [chimiChimi.id]);

    assert.equal(await agentOwnsClientId("agent-chimichimi", chimiChimi.id, testDb as unknown as Parameters<typeof agentOwnsClientId>[2]), true);
    assert.equal(await agentOwnsClientId("agent-chimichimi", emt.id, testDb as unknown as Parameters<typeof agentOwnsClientId>[2]), false, "un agente scoped a Chimi Chimi jamás debe leer EMT");
  });

  test("agentKey con varios clientId autorizados: exactamente esos, ninguno más", async () => {
    const drSegovia = await seedClient("Dr. Segovia");
    const coimagen = await seedClient("Coimagen Media");
    const otro = await seedClient("Marca sin relación");
    await testDb.insert(schema.mcpAgentScopesTable).values([
      { agentKey: "agent-multi", clientId: drSegovia.id },
      { agentKey: "agent-multi", clientId: coimagen.id },
    ]);

    const ids = await agentClientIds("agent-multi", testDb as unknown as Parameters<typeof agentClientIds>[1]);
    assert.deepEqual(new Set(ids), new Set([drSegovia.id, coimagen.id]));
    assert.equal(await agentOwnsClientId("agent-multi", otro.id, testDb as unknown as Parameters<typeof agentOwnsClientId>[2]), false);
  });

  test("dos agentKey distintos no se filtran entre sí, aunque compartan clientId autorizado en uno de los dos", async () => {
    const marca = await seedClient("Marca compartida");
    const soloA = await seedClient("Solo de A");
    await testDb.insert(schema.mcpAgentScopesTable).values([
      { agentKey: "agent-A", clientId: marca.id },
      { agentKey: "agent-A", clientId: soloA.id },
    ]);
    // agent-B nunca recibió ninguna fila — no debe heredar nada de agent-A.
    assert.equal(await agentOwnsClientId("agent-B", marca.id, testDb as unknown as Parameters<typeof agentOwnsClientId>[2]), false);
    assert.equal(await agentOwnsClientId("agent-B", soloA.id, testDb as unknown as Parameters<typeof agentOwnsClientId>[2]), false);
    assert.equal(await agentOwnsClientId("agent-A", soloA.id, testDb as unknown as Parameters<typeof agentOwnsClientId>[2]), true);
  });

  test("clientId null/undefined nunca pasa, sin importar el scope del agente", async () => {
    const marca = await seedClient("Cualquier marca");
    await testDb.insert(schema.mcpAgentScopesTable).values({ agentKey: "agent-null-check", clientId: marca.id });
    assert.equal(await agentOwnsClientId("agent-null-check", null, testDb as unknown as Parameters<typeof agentOwnsClientId>[2]), false);
    assert.equal(await agentOwnsClientId("agent-null-check", undefined, testDb as unknown as Parameters<typeof agentOwnsClientId>[2]), false);
  });
});
