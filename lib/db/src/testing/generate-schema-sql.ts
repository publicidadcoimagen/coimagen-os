import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Runs the REAL drizzle-kit generator against a chosen subset of this
// package's actual exported tables and returns the resulting CREATE TABLE
// SQL — so a test can stand up a real Postgres schema (PGlite) derived from
// the live table definitions in ./schema/*.ts, instead of a hand-copied SQL
// string that silently drifts the moment someone edits the real table and
// forgets to update the copy (this is exactly how prospect-conversion.test.ts
// used to do it, and how agent-scope.test.ts did it before this fix).
//
// Pass the exact export names from "../schema" you need, PLUS whatever they
// reference via foreign keys — drizzle-kit does not resolve that for you,
// and generate fails loudly (missing FK target) if you forget one.
export function generateSchemaSql(exportNames: string[]): string {
  const outDir = mkdtempSync(path.join(tmpdir(), "coimagen-db-test-"));
  try {
    const schemaIndexPath = path.join(__dirname, "../schema/index.ts").split(path.sep).join("/");
    const schemaEntry = path.join(outDir, "schema.ts");
    writeFileSync(schemaEntry, `export { ${exportNames.join(", ")} } from ${JSON.stringify(schemaIndexPath)};\n`);

    const configPath = path.join(outDir, "drizzle.config.ts");
    writeFileSync(
      configPath,
      `import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: ${JSON.stringify(schemaEntry.split(path.sep).join("/"))},
  dialect: "postgresql",
  out: ${JSON.stringify(outDir.split(path.sep).join("/"))},
  dbCredentials: { url: "postgres://unused:unused@localhost:5432/unused" },
});
`,
    );

    // drizzle-kit ships only bin.cjs at runtime in this installed version
    // (its package.json "exports" map has no "./bin.cjs" entry, so
    // require.resolve("drizzle-kit/bin.cjs") is rejected by Node — go
    // straight to the file drizzle-kit is a devDependency of THIS package,
    // so it's always resolvable relative to this file's own location).
    // Spawning the real CLI is also literally what `pnpm push` runs.
    const drizzleKitBin = path.join(__dirname, "../../node_modules/drizzle-kit/bin.cjs");
    execFileSync(process.execPath, [drizzleKitBin, "generate", "--config", configPath], {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? "postgres://unused:unused@localhost:5432/unused" },
    });

    const sqlFile = readdirSync(outDir).find((f) => f.endsWith(".sql"));
    if (!sqlFile) {
      throw new Error("drizzle-kit generate produced no .sql file — check that every exportNames entry exists in ../schema/index.ts");
    }
    return readFileSync(path.join(outDir, sqlFile), "utf8");
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}
