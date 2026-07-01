---
name: Express 5 params typing
description: req.params returns string | string[] in Express 5, must cast to string before parseInt
---

In Express 5, `req.params` has type `Record<string, string | string[]>`, so `req.params.clientId` is `string | string[]` — not `string`.

**Rule:** always cast before `parseInt`: `parseInt(req.params.id as string)`.

**Why:** Express 5 changed the params type from `ParamsDictionary` (string-only) to allow arrays. Without the cast, TypeScript will reject the `parseInt` call (TS2345).

**How to apply:** any route file using `parseInt(req.params.xxx)` needs the cast. Files already fixed in V1.7.6: client-access.ts, client-brand.ts, client-notes.ts, client-onboarding.ts, client-timeline.ts.
