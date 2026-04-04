import { randomUUID } from "crypto";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import {
  createMonitor,
  createUser,
  deleteApiKey,
  deleteMonitor,
  findUserByEmail,
  getMonitorById,
  listMonitorChecks,
  listMonitorsByUser,
  updateMonitor,
} from "@accevum/db";
import {
  getCurrentUser,
  hashPassword,
  listUserApiKeys,
  mintApiKey,
  requireUser,
  verifyPassword,
} from "./lib/auth";
import { logger } from "./lib/logger";
import { metricsContentType, metricsHandler, registerMetrics } from "./lib/metrics";
import { initTracing } from "./lib/tracing";

type RegisterBody = { email: string; password: string };
type LoginBody = RegisterBody;
type CreateMonitorBody = { name: string; url: string; intervalSeconds?: number };
type UpdateMonitorBody = Partial<CreateMonitorBody> & { active?: boolean };

type UserPayload = {
  sub: string;
  email: string;
};

const bootstrap = async (): Promise<void> => {
  await initTracing();

  const app = Fastify({ loggerInstance: logger });
  registerMetrics(app);

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || "dev-secret-change-me",
  });

  app.get("/", async () => ({
    service: "accevum-api",
    status: "running",
    docs: {
      register: "POST /v1/auth/register",
      login: "POST /v1/auth/login",
      me: "GET /v1/me",
      monitors: "GET|POST /v1/monitors",
      monitorById: "GET|PATCH|DELETE /v1/monitors/:id",
      monitorChecks: "GET /v1/monitors/:id/checks",
      apiKeys: "GET|POST /v1/api-keys",
    },
  }));

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/readiness", async () => ({ ready: true }));
  app.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", metricsContentType);
    return metricsHandler();
  });

  app.post("/v1/auth/register", async (request, reply) => {
    const body = request.body as RegisterBody;

    const existing = await findUserByEmail(body.email);
    if (existing) {
      return reply.code(409).send({ message: "Email already exists" });
    }

    const passwordHash = await hashPassword(body.password);
    const user = await createUser({ email: body.email, passwordHash });

    const token = await reply.jwtSign({ sub: user.id, email: user.email } as UserPayload);
    return { token, user: { id: user.id, email: user.email } };
  });

  app.post("/v1/auth/login", async (request, reply) => {
    const body = request.body as LoginBody;

    const user = await findUserByEmail(body.email);
    if (!user) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    const token = await reply.jwtSign({ sub: user.id, email: user.email } as UserPayload);
    return { token, user: { id: user.id, email: user.email } };
  });

  app.get("/v1/me", { preHandler: [requireUser] }, async (request, reply) => {
    const user = await getCurrentUser(request);
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    return { id: user.id, email: user.email, createdAt: user.createdAt };
  });

  app.post("/v1/monitors", { preHandler: [requireUser] }, async (request, reply) => {
    const user = await getCurrentUser(request);
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    const body = request.body as CreateMonitorBody;

    const monitor = await createMonitor({
      id: randomUUID(),
      userId: user.id,
      name: body.name,
      url: body.url,
      intervalSeconds: body.intervalSeconds ?? 30,
      active: true,
    });

    return monitor;
  });

  app.get("/v1/monitors", { preHandler: [requireUser] }, async (request, reply) => {
    const user = await getCurrentUser(request);
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    return listMonitorsByUser(user.id);
  });

  app.get("/v1/monitors/:id", { preHandler: [requireUser] }, async (request, reply) => {
    const user = await getCurrentUser(request);
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    const { id } = request.params as { id: string };
    const monitor = await getMonitorById(id, user.id);

    if (!monitor) {
      return reply.code(404).send({ message: "Monitor not found" });
    }

    return monitor;
  });

  app.patch("/v1/monitors/:id", { preHandler: [requireUser] }, async (request, reply) => {
    const user = await getCurrentUser(request);
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    const { id } = request.params as { id: string };
    const body = request.body as UpdateMonitorBody;

    const updated = await updateMonitor(id, user.id, {
      name: body.name,
      url: body.url,
      intervalSeconds: body.intervalSeconds,
      active: body.active,
    });

    if (!updated) {
      return reply.code(404).send({ message: "Monitor not found" });
    }

    return updated;
  });

  app.delete("/v1/monitors/:id", { preHandler: [requireUser] }, async (request, reply) => {
    const user = await getCurrentUser(request);
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    const { id } = request.params as { id: string };
    const deleted = await deleteMonitor(id, user.id);

    if (!deleted) {
      return reply.code(404).send({ message: "Monitor not found" });
    }

    return { deleted: true };
  });

  app.get("/v1/monitors/:id/checks", { preHandler: [requireUser] }, async (request, reply) => {
    const user = await getCurrentUser(request);
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    const { id } = request.params as { id: string };
    return listMonitorChecks(id, user.id, 200);
  });

  app.post("/v1/api-keys", { preHandler: [requireUser] }, async (request, reply) => {
    const user = await getCurrentUser(request);
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    const body = request.body as { name: string };
    const key = await mintApiKey(user.id, body.name);
    return { key };
  });

  app.get("/v1/api-keys", { preHandler: [requireUser] }, async (request, reply) => {
    const user = await getCurrentUser(request);
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    return listUserApiKeys(user.id);
  });

  app.delete("/v1/api-keys/:id", { preHandler: [requireUser] }, async (request, reply) => {
    const user = await getCurrentUser(request);
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    const { id } = request.params as { id: string };
    const deleted = await deleteApiKey(id, user.id);

    if (!deleted) {
      return reply.code(404).send({ message: "API key not found" });
    }

    return { deleted: true };
  });

  try {
    await app.listen({
      host: process.env.HOST ?? "0.0.0.0",
      port: Number(process.env.PORT ?? 3000),
    });
    app.log.info("API server started");
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void bootstrap();
