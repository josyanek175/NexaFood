# Auth API

Cookie session auth (HttpOnly). Frontend uses these endpoints via `credentials: "include"`.

Cookie: `SESSION_COOKIE_NAME` (default `nexa_session`), HttpOnly, SameSite=Lax, Secure in production.

## POST /api/v1/auth/login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "***"
}
```

Response `200` sets session cookie. Never returns `password_hash` or the raw session token.

## POST /api/v1/auth/register

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "new@example.com",
  "password": "***",
  "fullName": "Nome"
}
```

Creates an ACTIVE user without membership and starts a session.

## POST /api/v1/auth/logout

Revokes session (if any) and clears cookie. Idempotent.

## GET /api/v1/auth/me

Requires valid session cookie. Same shape as login. `401` when anonymous.

## POST /api/v1/auth/current-establishment

```json
{ "establishmentId": "uuid" }
```

Only accepts establishments from the user's **active** memberships.

Authenticated ops (`/api/v1/orders`, `/tables`, `/customers`, `/admin/menu`, `/events`) use **only** `currentEstablishmentId` from the session. Missing context → `409 ESTABLISHMENT_CONTEXT_REQUIRED`.
