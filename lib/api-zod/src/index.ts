export * from "./generated/api";
export * from "./generated/types";
// `ConvertProspectBody` is exported both above (the runtime zod validator
// routes actually import, from ./generated/api) and as a same-named
// `interface` in ./generated/types — orval's normal type+const pair for
// every schema, but this specific one is apparently the first such pair
// whose ambiguity a clean `tsc -b --force` composite rebuild actually
// surfaces (a latent issue in the codegen convention itself, not unique to
// this schema — ConvertTicketBody has the identical shape and predates
// this, presumably with the same latent ambiguity never yet triggered). An
// explicit named re-export after the wildcards wins over their ambiguity
// for just this one name — nothing loses access to the type, since
// `z.infer<typeof ConvertProspectBody>` is equivalent.
export { ConvertProspectBody } from "./generated/api";
