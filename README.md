# Accevum SaaS v1

Deployable SaaS foundation for API uptime and latency monitoring.

## Monorepo Layout

```
accevum-sandbox-repo/
├── apps/
│   ├── api/
│   │   └── src/
│   └── worker/
│       └── src/
├── packages/
│   └── db/
│       └── src/
├── docker/
├── infra/
├── .github/workflows/
├── docker-compose.yml
├── package.json
└── tsconfig.base.json
```

## Stack

- API: Fastify
- Worker: BullMQ + Redis
- Database: Postgres + Drizzle ORM
- Auth: JWT + email/password
- Observability: Prometheus metrics + OpenTelemetry + structured logs

## Environment

Copy `.env.example` to `.env` and set values.

Required variables:

- `NODE_ENV`
- `HOST`
- `PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

## Local Run (Docker Compose)

```bash
docker compose up --build
```

API runs at `http://127.0.0.1:3000`.

## Local Run (without Docker)

1. Start Postgres and Redis.
2. Install dependencies:

```bash
npm install
```

3. Run migrations:

```bash
npm run build -w packages/db
npm run db:migrate
```

4. Start API and worker in separate shells:

```bash
npm run dev:api
npm run dev:worker
```

## API Surface (v1)

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `GET /v1/me`
- `POST /v1/monitors`
- `GET /v1/monitors`
- `GET /v1/monitors/:id`
- `PATCH /v1/monitors/:id`
- `DELETE /v1/monitors/:id`
- `GET /v1/monitors/:id/checks`
- `POST /v1/api-keys`
- `GET /v1/api-keys`
- `DELETE /v1/api-keys/:id`
