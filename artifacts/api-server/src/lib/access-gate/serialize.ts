import type { AuthUserAccessGate } from "@workspace/api-zod";
import type { AccessGateState } from "./evaluate";

// AccessGateState.since is a Date (or null) internally; the AuthUser/status
// API contracts both serialize it as an ISO string (or null) — same
// conversion the /internal/access-gate/status handler already does inline.
export function serializeAccessGate(state: AccessGateState): NonNullable<AuthUserAccessGate> {
  return {
    access: state.access,
    causeCode: state.causeCode,
    since: state.since ? state.since.toISOString() : null,
  };
}
