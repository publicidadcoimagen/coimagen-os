// Which optional module keys (P-79 enabledModules) unlock nav entries in a
// Client Room. No React imports, so nav-modules.test.ts runs under plain tsx.
//
// - A cliente-role session (a real client login, or staff under "Ver como
//   cliente") uses its own session's enabledModules — the server fills them
//   from that client's row.
// - Staff browsing the room normally ("Abrir Client Room") have an empty
//   session list (staff role), so the modules come from the client the room
//   belongs to. Before 2026-10-08 this was a hardcoded slug === "beckybeck"
//   check, so no other client's catalog ever appeared for staff.
export function clientRoomModuleKeys(
  isCliente: boolean,
  sessionModules: string[] | undefined,
  roomClientModules: string[] | undefined,
): string[] {
  return (isCliente ? sessionModules : roomClientModules) ?? [];
}

// The list a "Módulos del Portal" switch saves: add without duplicating,
// remove every occurrence.
export function nextEnabledModules<T extends string>(current: T[], key: T, checked: boolean): T[] {
  return checked ? [...new Set([...current, key])] : current.filter((m) => m !== key);
}
