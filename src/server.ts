import { initTracing } from "./lib/tracing";
import Fastify from "fastify";
import { logger } from "./lib/logger";
import {
  registerMetrics,
  metricsHandler,
  metricsContentType,
} from "./lib/metrics";

const bootstrap = async (): Promise<void> => {
  // Initialize tracing before app startup so traces are captured from the beginning.
  await initTracing();

  const app = Fastify({ logger });

  registerMetrics(app);

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

  try {
    await app.listen({ port: 3000, host: "0.0.0.0" });
    app.log.info("server started");
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void bootstrap();
