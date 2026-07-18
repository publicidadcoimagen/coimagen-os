import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { toNodeHandler } from "better-auth/node";
import router from "./routes";
import { logger } from "./lib/logger";
import { auth } from "./lib/auth";
import { authMiddleware } from "./middlewares/authMiddleware";
import { getCurrentAuthUser } from "./routes/auth";

const app: Express = express();

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
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
