import { db } from "./db";

export type Monitor = {
  id: string;
  name: string;
  url: string;
  lastStatus?: number;
  lastLatency?: number;
  lastChecked?: number;
};

export const createMonitor = (monitor: Monitor): void => {
  const stmt = db.prepare(`
    INSERT INTO monitors (id, name, url)
    VALUES (?, ?, ?)
  `);

  stmt.run(monitor.id, monitor.name, monitor.url);
};

export const getMonitors = (): Monitor[] => {
  return db.prepare("SELECT * FROM monitors").all() as Monitor[];
};

export const getMonitor = (id: string): Monitor | undefined => {
  return db
    .prepare("SELECT * FROM monitors WHERE id = ?")
    .get(id) as Monitor | undefined;
};

export const updateMonitor = (id: string, data: Partial<Monitor>): void => {
  const stmt = db.prepare(`
    UPDATE monitors
    SET lastStatus = ?, lastLatency = ?, lastChecked = ?
    WHERE id = ?
  `);

  stmt.run(data.lastStatus, data.lastLatency, data.lastChecked, id);
};
