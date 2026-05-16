import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
// Disable ETag so API responses are never served as 304 Not Modified
app.set("etag", false);

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Production deploy: serve the Vite frontend from the same Express service.
// This lets one Render/Railway/Fly web service host both /api and the React app.
if (process.env.NODE_ENV === "production") {
  const clientDist = path.resolve(process.cwd(), "artifacts/roi-platform/dist/public");

  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));

    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  } else {
    logger.warn({ clientDist }, "Frontend dist folder not found. Did the frontend build run?");
  }
}

export default app;
