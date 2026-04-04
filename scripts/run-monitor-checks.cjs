const { listActiveMonitors, insertMonitorCheck, updateMonitorCurrent, pool } = require("@accevum/db");

const now = () => Date.now();

const isDue = (monitor) => {
  if (!monitor.active) return false;
  if (!monitor.lastChecked) return true;
  const intervalMs = (monitor.intervalSeconds ?? 30) * 1000;
  return now() - new Date(monitor.lastChecked).getTime() >= intervalMs;
};

const runCheck = async (monitor) => {
  const startedAt = now();
  try {
    const response = await fetch(monitor.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    const latencyMs = now() - startedAt;
    const statusCode = response.status;

    await insertMonitorCheck({
      monitorId: monitor.id,
      statusCode,
      latencyMs,
      ok: statusCode >= 200 && statusCode < 400,
    });

    await updateMonitorCurrent({
      monitorId: monitor.id,
      statusCode,
      latencyMs,
    });

    console.log(
      JSON.stringify({
        monitorId: monitor.id,
        url: monitor.url,
        statusCode,
        latencyMs,
        ok: statusCode >= 200 && statusCode < 400,
      })
    );
  } catch (error) {
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

    console.error(
      JSON.stringify({
        monitorId: monitor.id,
        url: monitor.url,
        ok: false,
        error: error?.message ?? String(error),
      })
    );
  }
};

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const monitors = await listActiveMonitors();
  const dueMonitors = monitors.filter(isDue);

  console.log(
    JSON.stringify({
      totalActiveMonitors: monitors.length,
      dueMonitors: dueMonitors.length,
    })
  );

  for (const monitor of dueMonitors) {
    await runCheck(monitor);
  }
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
