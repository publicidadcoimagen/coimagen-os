import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetCurrentAuthUserResponse,
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import { APIError } from "better-auth/api";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";

const router: IRouter = Router();

export async function getCurrentAuthUser(req: Request, res: Response) {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
}

router.post(
  "/mobile-auth/token-exchange",
  async (req: Request, res: Response) => {
    const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required parameters" });
      return;
    }

    try {
      const { headers } = await auth.api.signInEmail({
        body: { email: parsed.data.email, password: parsed.data.password },
        returnHeaders: true,
      });

      const token = headers.get("set-auth-token");
      if (!token) {
        res.status(500).json({ error: "Token exchange failed" });
        return;
      }

      res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token }));
    } catch (err) {
      if (err instanceof APIError) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
      req.log.error({ err }, "Mobile token exchange error");
      res.status(500).json({ error: "Token exchange failed" });
    }
  },
);

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  await auth.api
    .signOut({ headers: fromNodeHeaders(req.headers) })
    .catch(() => {});
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;
