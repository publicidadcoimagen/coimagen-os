---
name: Hook argument pattern
description: When to pass {} as first arg vs. only options to generated list hooks
---

**Rule:** Generated list hooks that have **no query/path parameters** in the OpenAPI spec take only 1 argument: `useListX({ query: { queryKey: ... } })`. List hooks that DO have query params take 2 args: `useListX({}, { query: { queryKey: ... } })`.

**Why:** Orval generates different signatures depending on whether the OpenAPI operation has parameters. If there are no params, it generates `(options?) => ...`. If there are params, it generates `(params, options?) => ...`.

**How to apply:** After adding new endpoints, check the generated signature in `lib/api-client-react/src/generated/api.ts`. If the list hook line has only `options?` as the first param (no `params` argument), use 1-arg form. Existing hooks like `useListProspects`, `useListInvoices`, `useListClients` have query params (status filter, date filter, etc.) so they take 2 args.
