import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import {
  insertMonitorCheck,
  listActiveMonitors,
  type Monitor,
  updateMonitorCurrent,
} from "@accevum/db";
import { logger } from "./logger";

type MonitorJobData = {
  monitorId: string;
  url: string;
};

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const queueName = "monitor-checks";

const queue = new Queue<MonitorJobData>(queueName, { connection });

const runCheck = async (monitor: Monitor): Promise<void> => {
  const start = Date.now();

  try {
    const response = await fetch(monitor.url);
    const latency = Date.now() - start;

    await insertMonitorCheck({
      monitorId: monitor.id,
      statusCode: response.status,
      latencyMs: latency,
      ok: response.status >= 200 && response.status < 400,
    });

    await updateMonitorCurrent({
      monitorId: monitor.id,
      statusCode: response.status,
      latencyMs: latency,
    });
  } catch {
    await insertMonitorCheck({
      monitorId: monitor.id,
      statusCode: null,
      latencyMs: null,
      ok: false,
    });

    await updateMonitorCurrent({
      monitorId: monitor.id,
      statusCode: 0,
      latencyMs: -1,
    });
  }
};

const worker = new Worker<MonitorJobData>(
  queueName,
  async (job) => {
    await runCheck({
      id: job.data.monitorId,
      url: job.data.url,
    } as Monitor);
  },
  { connection }
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "monitor check completed");
});

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "monitor check failed");
});

const scheduleChecks = async (): Promise<void> => {
  const monitors = await listActiveMonitors();

  await Promise.all(
    monitors.map(async (monitor) => {
      await queue.add(
        "check",
        { monitorId: monitor.id, url: monitor.url },
        {
          jobId: `${monitor.id}-${Date.now()}`,
          removeOnComplete: 1000,
          removeOnFail: 1000,
        }
      );
    })
  );

  logger.info({ count: monitors.length }, "scheduled monitor checks");
};

const bootstrap = async (): Promise<void> => {
  logger.info({ redisUrl }, "worker starting");
  await scheduleChecks();

  setInterval(() => {
    void scheduleChecks();
  }, 10000);
};

void bootstrap();
