# The Boat App

A small boat management application: Spring Boot 3.5 (Java 21) REST API, React + TypeScript SPA, PostgreSQL,
and Keycloak for OIDC login (Authorization Code + PKCE).

> Status: iteration 1. Infrastructure, authentication and CI are in place; boat management is not implemented yet.

## Quick start

Requirements: Docker with Compose v2.

```bash
docker compose up --build
```

| What | URL |
|---|---|
| App | http://localhost:3000 |
| Keycloak (admin console) | http://localhost:8081 (`admin` / `admin`) |
| Backend health | http://localhost:8080/actuator/health |

Log in with the demo user **`demo` / `demo`**.

These credentials are for local development only. To change the database or Keycloak admin credentials,
copy `.env.example` to `.env` and edit it. `.env` is git-ignored.

Ports 3000, 8080 and 8081 must be free. The Keycloak realm is re-imported from `keycloak/realm-boatapp.json` on every start.

## How the pieces fit together

```
Browser ──► http://localhost:3000  (nginx: SPA + /api proxy) ──► backend:8080 ──► postgres:5432
   │                                                                │
   └──────► http://localhost:8081  (Keycloak login/token)  ◄── JWKS ┘ (http://keycloak:8080)
```

Tokens are always issued with `iss=http://localhost:8081/realms/boatapp`. The backend checks that issuer and
the `boat-api` audience, and fetches signing keys over the internal Docker network.

## Local development

```bash
# infrastructure only
docker compose up -d postgres keycloak

# backend (needs JDK 21)
cd backend && ./mvnw spring-boot:run

# frontend (http://localhost:5173, proxies /api to localhost:8080)
cd frontend && npm ci && npm run dev
```

## Checks

```bash
cd backend && ./mvnw spotless:check verify
cd frontend && npm run format:check && npm run lint && npm test && npm run build
```

Without a local JDK 21, run the backend checks in a container:

```bash
docker run --rm -v "$PWD/backend":/w -w /w maven:3.9.16-eclipse-temurin-21 ./mvnw spotless:check verify
```

CI (`.github/workflows/ci.yml`) runs the same checks and builds both Docker images.
