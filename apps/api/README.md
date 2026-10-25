# @nexafood/api

API Fastify + Drizzle + PostgreSQL do NexaFood.

O frontend consome esta API com cookie de sessão (`credentials: "include"`).

## Setup

1. Suba um PostgreSQL local (exemplo):

```bash
docker run --name nexafood-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nexafood -p 5432:5432 -d postgres:16
```

2. Copie o exemplo de env:

```bash
cp apps/api/.env.example apps/api/.env
```

3. Instale dependências na raiz do monorepo e rode as migrations:

```bash
npm install
npm run db:migrate -w @nexafood/api
npm run db:seed -w @nexafood/api
```

`DEV_SEED_PASSWORD` é obrigatória no seed.

4. Suba a API:

```bash
npm run dev:api
```

## Endpoints

- `GET /health`, `GET /health/db`
- Auth: ver `src/auth/AUTH.md`
- `GET /api/v1/public/establishments/:slug/menu`
- `GET /api/v1/establishments/:establishmentId/menu` (auth)
- `POST /api/v1/public/orders`
- `GET /api/v1/public/orders/:code/tracking`
- `GET /api/v1/establishments/:id/orders|tables|customers`
- `PATCH /api/v1/orders/:orderId/status`
- `GET /api/v1/establishments/:id/events` (SSE)
