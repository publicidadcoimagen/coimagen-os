---
name: Generated hook call pattern
description: useListX hooks have (params, options) signature — pass {} as first arg when only setting query options
---

Generated hooks from Orval have the signature `useListX(params: Params, options?: QueryOptions)`.

**Rule:** When there are no query/path params but you need to pass `{ query: { queryKey: ... } }`, always pass `{}` as the first argument:

```tsx
// WRONG — causes TS2353
useListProspects({ query: { queryKey: getListProspectsQueryKey() } });

// CORRECT
useListProspects({}, { query: { queryKey: getListProspectsQueryKey() } });
```

**Why:** The first argument is typed as the params object (e.g. `ListProspectsParams`), not query options. Passing `query` there fails type checking.

**How to apply:** Whenever you see a TS2353 error about `'query' does not exist in type 'ListXParams'`, apply this pattern.
