"use client";

import { FormEvent, useMemo, useState } from "react";

type Monitor = {
  id: string;
  name: string;
  url: string;
  lastStatus: number | null;
  lastLatency: number | null;
  lastChecked: string | null;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:3000";

export default function HomePage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("demo@accevum.local");
  const [password, setPassword] = useState("changeme123");
  const [name, setName] = useState("google");
  const [url, setUrl] = useState("https://google.com");
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [status, setStatus] = useState("Idle");

  const authHeader = useMemo<Record<string, string> | undefined>(() => {
    if (!token) {
      return undefined;
    }

    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const register = async () => {
    const response = await fetch(`${apiBase}/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.message ?? "Register failed");
    }

    setToken(body.token);
    setStatus("Registered and signed in");
  };

  const login = async () => {
    const response = await fetch(`${apiBase}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.message ?? "Login failed");
    }

    setToken(body.token);
    setStatus("Logged in");
  };

  const createMonitor = async (event: FormEvent) => {
    event.preventDefault();

    const response = await fetch(`${apiBase}/v1/monitors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ?? {}),
      },
      body: JSON.stringify({ name, url, intervalSeconds: 30 }),
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.message ?? "Create monitor failed");
    }

    setStatus("Monitor created");
    await loadMonitors();
  };

  const loadMonitors = async () => {
    const response = await fetch(`${apiBase}/v1/monitors`, {
      headers: authHeader,
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.message ?? "List monitors failed");
    }

    setMonitors(body);
    setStatus(`Loaded ${body.length} monitor(s)`);
  };

  return (
    <main>
      <div className="card" style={{ marginBottom: 16 }}>
        <h1>Accevum Monitoring Dashboard</h1>
        <p style={{ color: "var(--muted)" }}>
          Register, create monitors, and inspect live status from your API.
        </p>
        <span className="badge">SaaS v1 Preview</span>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>Auth</h3>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
          <div style={{ height: 8 }} />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="password"
          />
          <div style={{ height: 8 }} />
          <div className="row">
            <button onClick={() => void register()}>Register</button>
            <button onClick={() => void login()}>Login</button>
          </div>
        </div>

        <form className="card" onSubmit={(e) => void createMonitor(e)}>
          <h3>Create Monitor</h3>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" />
          <div style={{ height: 8 }} />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          <div style={{ height: 8 }} />
          <button type="submit">Create</button>
        </form>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Monitors</h3>
          <button onClick={() => void loadMonitors()}>Refresh</button>
        </div>

        <p style={{ color: "var(--muted)", marginTop: 0 }}>{status}</p>

        <ul>
          {monitors.map((monitor) => (
            <li key={monitor.id}>
              <div style={{ fontWeight: 700 }}>{monitor.name}</div>
              <div>{monitor.url}</div>
              <div style={{ marginTop: 6, color: "var(--muted)" }}>
                status={monitor.lastStatus ?? "-"} latency={monitor.lastLatency ?? "-"}ms
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
