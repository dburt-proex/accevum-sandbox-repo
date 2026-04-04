import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import client from "prom-client";

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const requestDuration = new client.Histogram({
  name: "http_request_duration_ms",
  help: "HTTP request duration in ms",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [register],
});

type TimedRequest = FastifyRequest & { startTime?: bigint };

export const registerMetrics = (
  app: any
): void => {
  app.addHook("onRequest", async (request: TimedRequest) => {
    request.startTime = process.hrtime.bigint();
  });

  app.addHook(
    "onResponse",
    async (request: TimedRequest, reply: FastifyReply) => {
      if (!request.startTime) return;

      const duration =
        Number(process.hrtime.bigint() - request.startTime) / 1_000_000;

      const route =
        request.routeOptions?.url ?? request.routerPath ?? request.url;

      requestDuration.observe(
        {
          method: request.method,
          route,
          status_code: String(reply.statusCode),
        },
        duration
      );
    }
  );
};

export const metricsHandler = async (): Promise<string> => {
  return register.metrics();
};

export const metricsContentType = register.contentType;