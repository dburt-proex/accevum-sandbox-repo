import Fastify from "fastify";
import { logger } from "./lib/logger";
import { registerMetrics, metricsHandler } from "./lib/metrics";

const app = Fastify({ logger });

registerMetrics(app);

app.get("/health", async () => ({ status: "ok" }));
app.get("/readiness", async () => ({ ready: true }));
app.get("/metrics", metricsHandler);

app.get("/v1/info", async () => ({
  service: "accevum",
  version: "1.0.0"
}));

const start = async () => {
  try {
    await app.listen( { port: 3000, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
