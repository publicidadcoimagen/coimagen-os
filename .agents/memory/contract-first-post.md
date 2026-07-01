---
name: Contract-first POST pattern
description: How to add a new POST endpoint in this contract-first repo
---

**Rule:** Never write a POST handler without first defining the operation in openapi.yaml and running codegen.

**Steps:**
1. Add `post:` block under the path in `openapi.yaml` (operationId, tags, requestBody referencing a Create schema, 201 response referencing the entity schema).
2. Add the `XxxCreate` schema to `components/schemas` with `required` and `properties`.
3. Run `pnpm --filter @workspace/api-spec run codegen` — generates `CreateXxxBody` Zod schema and the React Query mutation hook.
4. In the route file: import `CreateXxxBody` from `@workspace/api-zod`, call `.safeParse(req.body)`, use `parsed.data` to build the insert.

**Why:** The codegen step also rebuilds lib declarations (`typecheck:libs`). Skipping it causes stale types and missing imports.

**How to apply:** Every new mutation (POST/PUT/PATCH/DELETE) follows this flow. Do not hand-roll Zod schemas in route files.
