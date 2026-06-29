import { type Request, type Response, type NextFunction } from "express";
import { db, auditLogsTable } from "@workspace/db";

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function parseModule(url: string): string {
  const seg = url.replace(/^\/api\//, "").split("/")[0] ?? "unknown";
  return seg;
}

function parseAction(method: string, url: string): string {
  const parts = url.replace(/^\/api\//, "").split("/").filter(Boolean);
  const hasId = parts.length >= 2 && !isNaN(Number(parts[1]));
  if (method === "POST") return "create";
  if (method === "DELETE") return "delete";
  if (method === "PATCH" || method === "PUT") return hasId ? "update" : "upsert";
  return method.toLowerCase();
}

function parseEntityId(url: string): number | null {
  const parts = url.replace(/^\/api\//, "").split("/").filter(Boolean);
  if (parts.length >= 2) {
    const id = Number(parts[1]);
    if (!isNaN(id)) return id;
  }
  return null;
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  res.on("finish", () => {
    const status = res.statusCode;
    if (status < 200 || status >= 300) return;

    const userId = req.isAuthenticated() ? (req.user as { id: string }).id : undefined;
    const module = parseModule(req.url);
    const action = parseAction(req.method, req.url);
    const entityId = parseEntityId(req.url);

    db.insert(auditLogsTable).values({
      userId: userId ?? null,
      module,
      action,
      result: entityId ? `${module}:${entityId}` : module,
      status: "success",
      metadata: JSON.stringify({ method: req.method, url: req.url }),
    }).catch(() => {});
  });

  next();
}
