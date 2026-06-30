import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { UpdateSystemUserBody, UpdateSystemUserParams, DeleteSystemUserParams, CreateSystemUserBody } from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

function serializeUser(u: typeof usersTable.$inferSelect) {
  return {
    ...u,
    createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: u.updatedAt ? u.updatedAt.toISOString() : null,
    lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
  };
}

router.get("/admin/users", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(users.map(serializeUser));
});

router.post("/admin/users", requireRole("ceo"), async (req, res): Promise<void> => {
  const parsed = CreateSystemUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [user] = await db.insert(usersTable).values({
    firstName: parsed.data.firstName ?? null,
    lastName: parsed.data.lastName ?? null,
    email: parsed.data.email ?? null,
    role: parsed.data.role ?? "viewer",
    status: parsed.data.status ?? "active",
  }).returning();
  res.status(201).json(serializeUser(user));
});

router.patch("/admin/users/:id", requireRole("ceo"), async (req, res): Promise<void> => {
  const params = UpdateSystemUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateSystemUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  const updateData: Partial<typeof usersTable.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };
  if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;

  const [user] = await db.update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, params.data.id))
    .returning();
  res.json(serializeUser(user));
});

router.delete("/admin/users/:id", requireRole("ceo"), async (req, res): Promise<void> => {
  const params = DeleteSystemUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(usersTable).where(eq(usersTable.id, params.data.id));
  res.status(204).send();
});

export default router;
