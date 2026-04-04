import { and, desc, eq } from "drizzle-orm";
import { db } from "./client";
import {
  apiKeys,
  type ApiKey,
  type Monitor,
  monitorChecks,
  monitors,
  type NewApiKey,
  type NewMonitor,
  type NewUser,
  users,
  type User,
} from "./schema";

export const createUser = async (data: NewUser): Promise<User> => {
  const [row] = await db.insert(users).values(data).returning();
  return row;
};

export const findUserByEmail = async (email: string): Promise<User | undefined> => {
  const [row] = await db.select().from(users).where(eq(users.email, email));
  return row;
};

export const findUserById = async (id: string): Promise<User | undefined> => {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row;
};

export const createApiKey = async (data: NewApiKey): Promise<ApiKey> => {
  const [row] = await db.insert(apiKeys).values(data).returning();
  return row;
};

export const listApiKeysByUser = async (userId: string): Promise<ApiKey[]> => {
  return db.select().from(apiKeys).where(eq(apiKeys.userId, userId));
};

export const deleteApiKey = async (id: string, userId: string): Promise<boolean> => {
  const rows = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
    .returning({ id: apiKeys.id });

  return rows.length > 0;
};

export const createMonitor = async (data: NewMonitor): Promise<Monitor> => {
  const [row] = await db.insert(monitors).values(data).returning();
  return row;
};

export const listMonitorsByUser = async (userId: string): Promise<Monitor[]> => {
  return db.select().from(monitors).where(eq(monitors.userId, userId));
};

export const getMonitorById = async (
  id: string,
  userId: string
): Promise<Monitor | undefined> => {
  const [row] = await db
    .select()
    .from(monitors)
    .where(and(eq(monitors.id, id), eq(monitors.userId, userId)));

  return row;
};

export const updateMonitor = async (
  id: string,
  userId: string,
  data: Partial<NewMonitor>
): Promise<Monitor | undefined> => {
  const [row] = await db
    .update(monitors)
    .set(data)
    .where(and(eq(monitors.id, id), eq(monitors.userId, userId)))
    .returning();

  return row;
};

export const deleteMonitor = async (id: string, userId: string): Promise<boolean> => {
  const rows = await db
    .delete(monitors)
    .where(and(eq(monitors.id, id), eq(monitors.userId, userId)))
    .returning({ id: monitors.id });

  return rows.length > 0;
};

export const insertMonitorCheck = async (data: {
  monitorId: string;
  statusCode: number | null;
  latencyMs: number | null;
  ok: boolean;
}): Promise<void> => {
  await db.insert(monitorChecks).values(data);
};

export const updateMonitorCurrent = async (data: {
  monitorId: string;
  statusCode: number | null;
  latencyMs: number | null;
}): Promise<void> => {
  await db
    .update(monitors)
    .set({
      lastStatus: data.statusCode,
      lastLatency: data.latencyMs,
      lastChecked: new Date(),
    })
    .where(eq(monitors.id, data.monitorId));
};

export const listMonitorChecks = async (
  monitorId: string,
  userId: string,
  limit = 100
): Promise<Array<{ statusCode: number | null; latencyMs: number | null; ok: boolean; checkedAt: Date }>> => {
  const monitor = await getMonitorById(monitorId, userId);
  if (!monitor) {
    return [];
  }

  return db
    .select({
      statusCode: monitorChecks.statusCode,
      latencyMs: monitorChecks.latencyMs,
      ok: monitorChecks.ok,
      checkedAt: monitorChecks.checkedAt,
    })
    .from(monitorChecks)
    .where(eq(monitorChecks.monitorId, monitorId))
    .orderBy(desc(monitorChecks.checkedAt))
    .limit(limit);
};

export const listActiveMonitors = async (): Promise<Monitor[]> => {
  return db.select().from(monitors).where(eq(monitors.active, true));
};
