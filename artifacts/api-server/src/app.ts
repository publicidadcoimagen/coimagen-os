import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import router from "./routes";
import { logger } from "./lib/logger";
import { auth } from "./lib/auth";
import { authMiddleware } from "./middlewares/authMiddleware";
import { getCurrentAuthUser } from "./routes/auth";

const app: Express = express();

// Render sits in front of this app as a reverse proxy — without trusting the
// first hop, req.ip resolves to Render's proxy address for every request
// (not the real client), which breaks IP-based rate limiting on
// /api/public/digital-diagnosis: either everyone shares one bucket, or
// express-rate-limit refuses to start (it validates X-Forwarded-For usage
// against this setting to prevent a spoofing bypass).
app.set("trust proxy", 1);

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

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
