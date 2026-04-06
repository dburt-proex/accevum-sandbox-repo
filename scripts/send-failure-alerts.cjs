const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const parseRecipients = (userEmail) => {
  const override = process.env.ALERT_TO_EMAIL;
  const raw = override && override.trim() ? override : userEmail;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
};

const sendEmail = async ({ to, subject, text, html }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;

  if (!apiKey) throw new Error("RESEND_API_KEY is required");
  if (!from) throw new Error("ALERT_FROM_EMAIL is required");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text, html }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error ${response.status}: ${body}`);
  }

  return response.json();
};

const buildEmail = (monitor, latestCheck) => {
  const statusLabel =
    latestCheck.status_code === null ? "request failed" : `HTTP ${latestCheck.status_code}`;
  const latencyLabel =
    latestCheck.latency_ms === null || latestCheck.latency_ms < 0
      ? "n/a"
      : `${latestCheck.latency_ms} ms`;

  const subject = `[Accevum] Monitor down: ${monitor.name}`;
  const text = [
    `Monitor: ${monitor.name}`,
    `URL: ${monitor.url}`,
    `Status: ${statusLabel}`,
    `Latency: ${latencyLabel}`,
    `Checked at: ${latestCheck.checked_at}`,
    "",
    "This alert fired because the most recent check failed after the monitor was previously healthy or had no earlier check."
  ].join("\n");

  const html = `
    <h2>Monitor down</h2>
    <p><strong>Monitor:</strong> ${monitor.name}</p>
    <p><strong>URL:</strong> ${monitor.url}</p>
    <p><strong>Status:</strong> ${statusLabel}</p>
    <p><strong>Latency:</strong> ${latencyLabel}</p>
    <p><strong>Checked at:</strong> ${latestCheck.checked_at}</p>
    <p>This alert fired because the most recent check failed after the monitor was previously healthy or had no earlier check.</p>
  `;

  return { subject, text, html };
};

const main = async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const result = await pool.query(`
    with ranked_checks as (
      select
        mc.monitor_id,
        mc.status_code,
        mc.latency_ms,
        mc.ok,
        mc.checked_at,
        row_number() over (partition by mc.monitor_id order by mc.checked_at desc) as rn
      from monitor_checks mc
    )
    select
      m.id as monitor_id,
      m.name,
      m.url,
      u.email as user_email,
      latest.status_code as latest_status_code,
      latest.latency_ms as latest_latency_ms,
      latest.ok as latest_ok,
      latest.checked_at as latest_checked_at,
      previous.status_code as previous_status_code,
      previous.ok as previous_ok,
      previous.checked_at as previous_checked_at
    from monitors m
    join users u on u.id = m.user_id
    join ranked_checks latest
      on latest.monitor_id = m.id
     and latest.rn = 1
    left join ranked_checks previous
      on previous.monitor_id = m.id
     and previous.rn = 2
    where m.active = true
      and latest.ok = false
      and latest.checked_at >= now() - interval '20 minutes'
      and (previous.ok is distinct from false)
    order by latest.checked_at desc
  `);

  console.log(JSON.stringify({ candidateAlerts: result.rows.length }));

  for (const row of result.rows) {
    const recipients = parseRecipients(row.user_email);
    if (recipients.length === 0) {
      console.warn(JSON.stringify({ monitorId: row.monitor_id, skipped: true, reason: "no_recipients" }));
      continue;
    }

    const monitor = {
      id: row.monitor_id,
      name: row.name,
      url: row.url,
      userEmail: row.user_email,
    };

    const latestCheck = {
      status_code: row.latest_status_code,
      latency_ms: row.latest_latency_ms,
      checked_at: row.latest_checked_at,
      ok: row.latest_ok,
    };

    const { subject, text, html } = buildEmail(monitor, latestCheck);
    const response = await sendEmail({ to: recipients, subject, text, html });

    console.log(JSON.stringify({
      monitorId: monitor.id,
      recipients,
      emailId: response.id ?? null,
      sent: true,
    }));
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
