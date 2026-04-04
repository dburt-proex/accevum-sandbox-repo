import { randomUUID } from "crypto";
import { initTracing } from "./lib/tracing";
import Fastify from "fastify";
import { logger } from "./lib/logger";
import {
  registerMetrics,
  metricsHandler,
  metricsContentType,
} from "./lib/metrics";
import { createMonitor, getMonitors, getMonitor } from "./lib/store";
import { startWorker } from "./lib/worker";

const bootstrap = async (): Promise<void> => {
  // Initialize tracing before app startup so traces are captured from the beginning.
  await initTracing();

  const app = Fastify({ logger });
  startWorker();

  registerMetrics(app);

  app.get("/", async () => ({
    service: "accevum",
    status: "running",
    docs: {
      health: "/health",
      readiness: "/readiness",
      metrics: "/metrics",
      monitorCreate: "POST /v1/monitor",
      monitorList: "/v1/monitor",
      monitorStatus: "/v1/monitor/:id",
    },
  }));

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/readiness", async () => ({ ready: true }));

  app.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", metricsContentType);
    return metricsHandler();
  });

  app.get("/v1/info", async () => ({
    service: "accevum",
    version: "1.0.0",
  }));

  app.post("/v1/monitor", async (request) => {
    const body = request.body as { name: string; url: string };

    const monitor = {
      id: randomUUID(),
      name: body.name,
      url: body.url,
    };

    createMonitor(monitor);

    return monitor;
  });

  app.get("/v1/monitor", async () => {
    return getMonitors();
  });

  app.get("/v1/monitor/:id", async (request) => {
    const { id } = request.params as { id: string };
    return getMonitor(id);
  });

  try {
    await app.listen({ port: 3000, host: "127.0.0.1" });
    app.log.info("server started");
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void bootstrap();
