import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { UpdateSystemUserBody, UpdateSystemUserParams, DeleteSystemUserParams } from "@workspace/api-zod";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/admin/users", requireRole("ceo", "admin"), async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(users.map((u) => ({
    ...u,
    createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: u.updatedAt ? u.updatedAt.toISOString() : null,
  })));
});

router.patch("/admin/users/:id", requireRole("ceo"), async (req, res): Promise<void> => {
  const params = UpdateSystemUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateSystemUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [user] = await db.update(usersTable)
    .set({ role: parsed.data.role, updatedAt: new Date() })
    .where(eq(usersTable.id, params.data.id))
    .returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ ...user, createdAt: user.createdAt ? user.createdAt.toISOString() : new Date().toISOString(), updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null });
});

router.delete("/admin/users/:id", requireRole("ceo"), async (req, res): Promise<void> => {
  const params = DeleteSystemUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(usersTable).where(eq(usersTable.id, params.data.id));
  res.status(204).send();
});

export default router;
