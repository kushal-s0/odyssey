import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { ZodError } from "zod";
import multer from "multer";
import { router } from "./routes.js";
import { config } from "./config.js";
import { ProviderError } from "./providers/gemini.js";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "img-src": ["'self'", "data:", "blob:"],
          "font-src": ["'self'"],
          "connect-src": ["'self'"],
          "media-src": ["'self'", "blob:"],
          "frame-src": ["'self'", "blob:"],
          "object-src": ["'none'"],
          "upgrade-insecure-requests":
            config.NODE_ENV === "production" ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const origin = req.headers.origin;
      if (
        origin &&
        origin !== config.APP_URL &&
        origin !== `${req.protocol}://${req.get("host")}`
      ) {
        res.status(403).json({ error: "Request origin is not allowed." });
        return;
      }
    }
    next();
  });
  app.use("/api", router);
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API route not found." }),
  );
  const clientPath = [
    resolve(process.cwd(), "client/dist"),
    resolve(process.cwd(), "../client/dist"),
    fileURLToPath(new URL("../../../../client/dist", import.meta.url)),
  ].find((p) => existsSync(resolve(p, "index.html")));
  if (clientPath) {
    app.use(express.static(clientPath));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve(clientPath, "index.html")),
    );
  }
  app.use(
    (
      error: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (res.headersSent) return;
      const status =
        error instanceof ZodError
          ? 400
          : error instanceof multer.MulterError
            ? 400
            : error?.code === 11000
              ? 409
              : typeof error.status === "number"
                ? error.status
                : error instanceof ProviderError
                  ? error.retryable
                    ? 503
                    : 422
                  : 500;
      const message =
        error instanceof ZodError
          ? error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
          : error instanceof multer.MulterError
            ? `Upload rejected: ${error.message}`
            : status < 500 || error instanceof ProviderError
              ? error.message
              : "The request could not be completed. Please retry or check service configuration.";
      if (status >= 500)
        console.error(
          "Request failed:",
          error instanceof Error ? error.message : "Unknown error",
        );
      res.status(status).json({
        error: message,
        ...(error instanceof ZodError
          ? {
              fields: Object.fromEntries(
                error.issues.map((issue) => [
                  issue.path.join("."),
                  issue.message,
                ]),
              ),
            }
          : {}),
        ...(error instanceof ProviderError
          ? {
              retryable: error.retryable,
              code: error.retryable
                ? "PROVIDER_TEMPORARILY_UNAVAILABLE"
                : "SOURCE_PROCESSING_FAILED",
            }
          : {}),
      });
    },
  );
  return app;
}
