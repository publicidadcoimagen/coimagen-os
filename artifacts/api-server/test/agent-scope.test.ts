// Real-Postgres tests (PGlite, embedded/ephemeral) for lib/agent-scope.ts —
// MCP Agent Scope v0. Same rationale as prospect-conversion.test.ts: this is
// specifically an authorization boundary, so it's tested against a real
// Postgres `inArray`/`eq` evaluation, not a mock.
//
// The schema below is NOT hand-copied — generateSchemaSql() runs the real
// drizzle-kit generator against the live `clientsTable`/`mcpAgentScopesTable`
// definitions in lib/db/src/schema/*.ts and returns the actual CREATE TABLE
// SQL drizzle-kit would emit. A hand-typed copy here previously could (and
// silently did, in this file's first version) drift from the real table the
// moment someone edited it without remembering to update the test's SQL —
// see the audit finding this PR fixes.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "@workspace/db/schema";
import { generateSchemaSql } from "@workspace/db/testing";
import { agentClientIds, agentOwnsClientId } from "../src/lib/agent-scope";

let pglite: PGlite;
let testDb: PgliteDatabase<typeof schema>;

async function seedClient(name: string) {
  const [row] = await testDb.insert(schema.clientsTable).values({ name }).returning();
  return row;
}

before(async () => {
  pglite = new PGlite();
  const sql = generateSchemaSql(["clientsTable", "mcpAgentScopesTable"]);
  await pglite.exec(sql);
  testDb = drizzle(pglite, { schema }) as unknown as PgliteDatabase<typeof schema>;
});
after(async () => pglite.close());

describe("agentClientIds / agentOwnsClientId — MCP Agent Scope v0", () => {
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
