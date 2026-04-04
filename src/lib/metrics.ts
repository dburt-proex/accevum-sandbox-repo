import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import client from "prom-client";

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: "accevum_" });

const requestDuration = new client.Histogram({
  name: "accevum_http_request_duration_ms",
  help: "HTTP request duration in milliseconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register],
});

const inFlightRequests = new client.Gauge({
  name: "accevum_http_inflight_requests",
  help: "Current number of in-flight HTTP requests",
  registers: [register],
});

type TimedRequest = FastifyRequest & { startTime?: bigint };

export const registerMetrics = (app: FastifyInstance): void => {
  app.addHook("onRequest", async (request: TimedRequest) => {
    request.startTime = process.hrtime.bigint();
    inFlightRequests.inc();
  });

  app.addHook("onResponse", async (request: TimedRequest, reply: FastifyReply) => {
    inFlightRequests.dec();

    if (!request.startTime) {
      return;
    }

    const elapsedMs = Number(process.hrtime.bigint() - request.startTime) / 1_000_000;
    const route = request.routeOptions?.url ?? request.routerPath ?? request.url;

    requestDuration.observe({
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    }, elapsedMs);
  });
};

export const metricsHandler = async (): Promise<string> => {
  return register.metrics();
};

export const metricsContentType = register.contentType;
