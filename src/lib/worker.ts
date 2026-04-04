import { getMonitors, updateMonitor } from "./store";

const check = async (): Promise<void> => {
  const monitors = getMonitors();

  for (const monitor of monitors) {
    const start = Date.now();

    try {
      const response = await fetch(monitor.url);
      const latency = Date.now() - start;

      updateMonitor(monitor.id, {
        lastStatus: response.status,
        lastLatency: latency,
        lastChecked: Date.now(),
      });
    } catch {
      updateMonitor(monitor.id, {
        lastStatus: 0,
        lastLatency: -1,
        lastChecked: Date.now(),
      });
    }
  }
};

export const startWorker = (): void => {
  setInterval(() => {
    void check();
  }, 10000);
};
