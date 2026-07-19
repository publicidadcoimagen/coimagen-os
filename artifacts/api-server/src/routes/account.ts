import { Router, type IRouter } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { ChangeOwnPasswordBody, ChangeOwnPasswordResponse } from "@workspace/api-zod";
import { auth } from "../lib/auth";

const router: IRouter = Router();

router.post("/account/change-password", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = ChangeOwnPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    await auth.api.changePassword({
      headers: fromNodeHeaders(req.headers),
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      },
    });
  } catch (err) {
    if (err instanceof APIError) {
      res.status(400).json({ error: err.body?.message ?? err.message });
      return;
    }
    throw err;
  }

  // Only cleared here, as a side effect of a password change verified by
  // Better Auth itself (current password checked) — never client-settable
  // directly, since forcePasswordReset is a server-controlled additionalField.
  await db
    .update(usersTable)
    .set({ forcePasswordReset: false })
    .where(eq(usersTable.id, req.user.id));

  res.json(ChangeOwnPasswordResponse.parse({ success: true }));
});

export default router;
