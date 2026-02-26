import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import helmet from "helmet";
import path from "path";


const app = express();

/**
 * 🔐 Security Headers (Helmet + CSP)
 * Deploy-safe configuration for Render + Vite + WebSocket
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "wss:", "https:"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);


/**
 * ✅ HARD FAIL wenn wichtige ENV fehlt
 * Sonst bekommst du später "secretOrPrivateKey must have a value"
 */
const REQUIRED_ENVS = ["DATABASE_URL", "JWT_SECRET"] as const;
for (const k of REQUIRED_ENVS) {
  if (!process.env[k] || String(process.env[k]).trim() === "") {
    throw new Error(`Missing environment variable: ${k}`);
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/**
 * 📎 Serve uploaded files (for /uploads/... URLs)
 * If your upload route returns paths like "/uploads/<file>", this ensures images/files load in the chat.
 */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));


/**
 * ✅ CORS (korrekt für credentials: "include")
 * - Kein "*", wenn Cookies/Sessions/JWT-Cookies genutzt werden
 * - Allow-Credentials muss true sein
 *
 * ✅ FIX: Erlaubt automatisch die aktuelle Render-Domain (same host),
 * plus optional zusätzliche Origins per ENV: ALLOWED_ORIGINS
 */
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;

  // Basis-Whitelist
  const allowedOrigins = new Set<string>([
    "https://whisper3.onrender.com",
    "https://velumchat.onrender.com",
    "https://velumchat-main.onrender.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);

  // Optional: weitere erlaubte Origins via ENV (kommagetrennt)
  const extra = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const o of extra) allowedOrigins.add(o);

  // Render/Proxy Headers berücksichtigen
  const forwardedHost =
    (req.headers["x-forwarded-host"] as string | undefined) || req.headers.host;

  let sameHost = false;
  if (origin && forwardedHost) {
    try {
      const o = new URL(origin);
      sameHost = o.host === forwardedHost;
    } catch {
      sameHost = false;
    }
  }

  if (origin && (sameHost || allowedOrigins.has(origin))) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

/**
 * ✅ API-GUARD: verhindert, dass /api/* jemals in SPA/Vite-Fallback landet
 * und gibt bei kaputten URLs sauber JSON zurück.
 */
app.use("/api", (req, res, next) => {
  const u = req.originalUrl || req.url || "";
  if (!u || u.includes("undefined") || u.includes("[object Object]")) {
    console.error("❌ Invalid API URL:", u);
    return res.status(400).json({ ok: false, message: "Invalid URL" });
  }
  next();
});

/**
 * ✅ Logger
 */
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json.bind(res);
  res.json = function (bodyJson: any, ...args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson, ...args);
  } as any;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      if (logLine.length > 180) logLine = logLine.slice(0, 179) + "…";
      log(logLine);
    }
  });

  next();
});

(async () => {
  // ✅ Register API routes FIRST
  const server = await registerRoutes(app);

  // ✅ Error handling middleware (immer JSON für /api)
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";

    console.error("❌ SERVER ERROR:", err);

    if (req.path?.startsWith("/api")) {
      return res.status(status).json({ ok: false, message });
    }

    return res.status(status).json({ message });
  });

  // ✅ Setup Vite AFTER all API routes are registered
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT) || 5000;
  const host = app.get("env") === "development" ? "127.0.0.1" : "0.0.0.0";

  server.listen(port, host, () => {
    log(`serving on http://${host}:${port}`);
  });
})();
