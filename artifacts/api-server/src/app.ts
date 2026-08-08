import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import router from "./routes";
import { logger } from "./lib/logger";
import { auth } from "./lib/auth";
import { authMiddleware } from "./middlewares/authMiddleware";
import { verifyTurnstile } from "./middlewares/turnstile";
import { getCurrentAuthUser } from "./routes/auth";
import { resendWebhookHandler } from "./routes/webhooks-resend";

const app: Express = express();

// Render sits in front of this app as a reverse proxy — without trusting the
// first hop, req.ip resolves to Render's proxy address for every request
// (not the real client), which breaks IP-based rate limiting on
// /api/public/digital-diagnosis: either everyone shares one bucket, or
// express-rate-limit refuses to start (it validates X-Forwarded-For usage
// against this setting to prevent a spoofing bypass).
app.set("trust proxy", 1);

// P-38: this server only ever returns JSON (plus Better Auth's own
// redirect for the password-reset callback) — it never renders HTML — so
// helmet's default CSP and the rest of its defaults are safe to use as-is,
// no per-directive tuning needed. Covers X-Content-Type-Options,
// X-Frame-Options, HSTS, etc., none of which existed before this.
app.use(helmet());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(authMiddleware);

// Our own current-user endpoint, registered ahead of Better Auth's catch-all
// so it isn't shadowed by it. Better Auth's handler must run before
// express.json() — see https://better-auth.com/docs/integrations/express.
app.get("/api/auth/user", getCurrentAuthUser);

// Better Auth's own routes are a single wildcard handler below, not
// individual Express routes, so a route-scoped limiter (like the one on
// /api/public/digital-diagnosis) can't attach directly to it — this runs
// as its own middleware in front instead. Same reasoning as that endpoint:
// without a cap, anyone could spam another person's inbox with reset
// emails as a form of harassment. 5/hour/IP matches the existing pattern.
const requestPasswordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes de restablecimiento. Intenta de nuevo más tarde." },
});
app.use("/api/auth/request-password-reset", requestPasswordResetLimiter);

// P-81: human verification on the portal login form. Same "own middleware
// in front, can't attach to the wildcard directly" reasoning as the limiter
// above. The frontend sends the Turnstile token as a header rather than in
// the JSON body, because Better Auth's handler needs the raw unparsed body
// — see the express.json() comment below.
app.use("/api/auth/sign-in/email", verifyTurnstile);

app.all("/api/auth/*splat", toNodeHandler(auth));

// Needs the exact raw request bytes to verify Resend's Svix signature (see
// webhooks-resend.ts) — must be registered ahead of express.json() below,
// same reasoning as the Better Auth handler above, or the body would
// already be parsed/re-serialized by the time it got there and every
// signature check would fail.
app.post("/api/webhooks/resend", express.raw({ type: "application/json" }), resendWebhookHandler);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
