import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import MemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { configurePassport, passport } from "./auth/passport";
import { registerAuthRoutes } from "./auth/routes";
import { getPool } from "./db/pg";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Liveness probe used by Render — always 200, no auth, no DB. Keep this
// registered before any route that might redirect or require a session.
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

(async () => {
  // ── Session + auth ─────────────────────────────────────────────────────────
  const isProduction = process.env.NODE_ENV === "production";
  // Render terminates TLS at the edge; Express needs to know it's behind a
  // proxy so secure cookies work correctly.
  if (isProduction) {
    app.set("trust proxy", 1);
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    console.warn(
      "[auth] SESSION_SECRET is not set — falling back to a random value. " +
        "Sessions will be invalidated on every restart. Set SESSION_SECRET " +
        "in env to persist sessions across deploys.",
    );
  }

  // Postgres session store when DATABASE_URL is available, in-memory
  // fallback otherwise (e.g. local Dynamo-only dev).
  let sessionStore: session.Store | undefined;
  if (process.env.DATABASE_URL) {
    const PgStore = connectPgSimple(session);
    sessionStore = new PgStore({
      pool: getPool(),
      tableName: "session",
      createTableIfMissing: true,
    });
  } else {
    const MemoStore = MemoryStore(session);
    sessionStore = new MemoStore({ checkPeriod: 1000 * 60 * 60 });
  }

  app.use(
    session({
      name: "weaudit.sid",
      secret: sessionSecret || `dev-${Math.random()}`,
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    }),
  );

  configurePassport();
  app.use(passport.initialize());
  app.use(passport.session());

  // Mount auth routes before /api so /auth/* isn't behind requireAuth.
  registerAuthRoutes(app);

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
