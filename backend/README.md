# Boat App — Backend

REST API for managing boats. Spring Boot 3.5 on Java 21, PostgreSQL, secured as an OAuth2 resource server
behind Keycloak.

## Architecture

One deployable Spring Boot application, organized **by feature**:

```
com.boatapp
├── BoatAppApplication
├── boat/      BoatController → BoatService → BoatRepository → Boat (JPA entity)
│              BoatRequest, BoatResponse, BoatPageResponse (DTOs), BoatNotFoundException
├── me/        MeController (GET /api/me, returns the caller's identity)
└── config/    SecurityConfig (JWT validation), ApiExceptionHandler (ProblemDetail rendering)
```

- **Controller**: HTTP mapping, request validation (`@Valid`, `@Min`/`@Max`), status codes.
- **Service**: a concrete class with no interface. It owns transactions: reads are `@Transactional(readOnly = true)`
  at class level, and writes are `@Transactional`. It maps entities to DTOs, so entities never leave the service.
- **Repository**: Spring Data JPA, with one custom JPQL query for search.
- **Schema**: owned by Flyway (`src/main/resources/db/migration`). Hibernate only validates it
  (`ddl-auto: validate`) and never changes it.

| Concern | Choice | Why |
|---|---|---|
| Framework | Spring Boot 3.5.16, Java 21 | Stable LTS line; Boot 4 was judged too risky for the time box |
| Persistence | Spring Data JPA + PostgreSQL 17 | Standard, little code |
| Migrations | Flyway | Versioned, reviewable SQL; Hibernate never touches the schema |
| Security | Spring Security OAuth2 Resource Server (JWT) | Stateless bearer tokens from Keycloak |
| Errors | RFC 9457 `ProblemDetail` | Built into Spring; one consistent error shape |
| Tests | JUnit 5, MockMvc, Testcontainers PostgreSQL | Web slices for HTTP behavior, real PostgreSQL for persistence and queries |
| Formatting | Spotless + google-java-format 1.36.1 | 1.37.0 fails on JDK 21 |

## Authentication

Every endpoint except `/actuator/health/**` requires `Authorization: Bearer <access token>`.

- Tokens are issued by Keycloak (realm `boatapp`, public SPA client `boat-frontend`, Authorization Code + PKCE).
- The backend validates the signature, expiry, **issuer** and **audience**:

  | Setting (env var) | Docker Compose value | Purpose |
  |---|---|---|
  | `OIDC_ISSUER_URI` | `http://localhost:8081/realms/boatapp` | Must equal the token's `iss` (the public URL the browser uses) |
  | `OIDC_JWK_SET_URI` | `http://keycloak:8080/realms/boatapp/protocol/openid-connect/certs` | Signing keys, fetched over the internal Docker network |
  | `OIDC_AUDIENCE` | `boat-api` | Must be in the token's `aud` (added by a Keycloak audience mapper) |

  Issuer discovery (`issuer-uri`) is deliberately not used, because the backend container cannot reach `localhost:8081`.
- A missing, expired or invalid token returns **401** with a `WWW-Authenticate: Bearer …` header and an empty body.
- Sessions are stateless and CSRF protection is disabled. The API uses no cookies.

## Endpoints

All paths are under `/api`. In Docker Compose the browser reaches them through the frontend's nginx at
`http://localhost:3000/api/...`. The backend is also exposed directly on `http://localhost:8080` for debugging.

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| `GET` | `/api/boats?page&size&search` | – | 200 `BoatPageResponse` | 400, 401 |
| `GET` | `/api/boats/{id}` | – | 200 `BoatResponse` | 400 (bad id), 401, 404 |
| `POST` | `/api/boats` | `BoatRequest` | 201 `BoatResponse` + `Location: /api/boats/{id}` | 400, 401 |
| `PUT` | `/api/boats/{id}` | `BoatRequest` | 200 `BoatResponse` | 400, 401, 404 |
| `DELETE` | `/api/boats/{id}` | – | 204, empty body | 400 (bad id), 401, 404 |
| `GET` | `/api/me` | – | 200 `{"subject": "...", "username": "demo"}` | 401 |
| `GET` | `/actuator/health` | – | 200 `{"status":"UP",...}` (public) | – |

### `BoatRequest` (POST, PUT)

```json
{ "name": "Black Pearl", "description": "Fast three-master" }
```

PUT replaces both fields: an omitted or `null` `description` clears it. Unknown properties are ignored, so a
client cannot set `id` or `createdAt`.

### `BoatResponse`

```json
{
  "id": "c1d4647b-067f-4be6-85b9-e844b7845f93",
  "name": "Black Pearl",
  "description": "Fast three-master",
  "createdAt": "2026-10-13T13:43:07.541001Z"
}
```

### `BoatPageResponse`

```json
{
  "content": [ { "id": "…", "name": "…", "description": null, "createdAt": "…" } ],
  "page": 0,
  "size": 10,
  "totalElements": 26,
  "totalPages": 3
}
```

## Pagination and search

| Parameter | Default | Rules |
|---|---|---|
| `page` | `0` | Zero-based, `>= 0`. A page past the end returns `content: []` with the real totals. |
| `size` | `10` | `1..100` |
| `search` | none | Optional. Missing, empty or whitespace-only means no filter. Otherwise the trimmed value is matched as a **case-insensitive substring** of `name` **or** `description`. `%` and `_` are matched literally. |

- Ordering is always `createdAt DESC, id DESC`. The `id` tie-breaker keeps pages stable when two boats share a timestamp.
- Filtering, ordering, `LIMIT`/`OFFSET` and the count all run in PostgreSQL, so boats are never loaded into memory.
- No results returns 200 with `content: []`, `totalElements: 0`, `totalPages: 0`.

## Validation rules

| Field | Rule |
|---|---|
| `name` | Required. Trimmed **before** validation, so `"   "` is blank. 1–150 characters after trimming. |
| `description` | Optional, at most 2000 characters, stored as sent (not trimmed). |
| `id` | Generated by the server (UUID). Path ids must be valid UUIDs. |
| `createdAt` | Set by the server on creation. Never changed. |

The database enforces these rules too: `NOT NULL`, `VARCHAR(150)`/`VARCHAR(2000)`, and a CHECK that the name is not blank.

## Errors

Errors are returned as `application/problem+json` (RFC 9457). Validation errors share one shape with an `errors`
array. **Submitted values are never echoed**, and there are no stack traces, class names or SQL.

**400: invalid body** (`POST`/`PUT`):

```json
{
  "type": "about:blank",
  "title": "Validation failed",
  "status": 400,
  "detail": "One or more fields are invalid.",
  "instance": "/api/boats",
  "errors": [
    { "field": "name", "message": "must not be blank" },
    { "field": "description", "message": "size must be between 0 and 2000" }
  ]
}
```

**400: invalid parameter** (out of range, or not parseable such as `page=abc`, `size=99999999999`, or a non-UUID id):

```json
{
  "type": "about:blank",
  "title": "Validation failed",
  "status": 400,
  "detail": "One or more fields are invalid.",
  "instance": "/api/boats",
  "errors": [ { "field": "size", "message": "must be less than or equal to 100" } ]
}
```

An unparseable value gives `{ "field": "page", "message": "has an invalid format" }` (or `"field": "id"` for a bad
path id). `instance` is the request path the client sent.

**404: unknown boat:**

```json
{
  "type": "about:blank",
  "title": "Boat not found",
  "status": 404,
  "detail": "No boat with id 0008a6ce-7a3f-49af-83d1-1198fddcd656",
  "instance": "/api/boats/0008a6ce-7a3f-49af-83d1-1198fddcd656"
}
```

Malformed JSON gives 400 with the framework's default ProblemDetail. **401** has no body (see Authentication).
Unexpected server errors keep Spring Boot's default 500 handling and are not hidden by a catch-all handler.

## Local development

```bash
# from the repository root: database and Keycloak only
docker compose up -d postgres keycloak

# run the backend on :8080 (needs JDK 21); defaults point at localhost:5432 / localhost:8081
cd backend && ./mvnw spring-boot:run

# format, then check formatting and run all tests (Testcontainers needs Docker running)
./mvnw spotless:apply
./mvnw spotless:check verify
```

Without a local JDK 21, from `backend/`:

```bash
docker run --rm -v "$PWD":/w -w /w \
  -v /var/run/docker.sock:/var/run/docker.sock -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal \
  maven:3.9.16-eclipse-temurin-21 ./mvnw spotless:check verify
```

| Test class | Kind | Covers |
|---|---|---|
| `BoatControllerTest` | `@WebMvcTest` + real `SecurityConfig`, mocked service | Status codes, JSON contract, validation and leak checks, 401 |
| `BoatServiceTest` | `@DataJpaTest`, Testcontainers PostgreSQL | CRUD, pagination, ordering, search |
| `BoatRepositoryTest`, `BoatTableConstraintsTest` | `@DataJpaTest`, Testcontainers | Mapping, generated fields, DB constraints |
| `MeControllerTest`, `TokenValidatorTest` | Web slice / unit | Authentication, issuer and audience validation |

## Known trade-offs

- **Last write wins.** There is no version column or optimistic locking, so concurrent edits overwrite each other silently.
- **Search uses `LIKE '%…%'` with `lower()`** and no index. Each search scans the table, which is fine at challenge scale.
  A `pg_trgm` GIN index would be the next step if the data grows.
- **Offset pagination.** Deep pages get slower, and rows inserted between requests can shift pages. Keyset
  pagination would avoid this but complicates the contract.
- **Relative `Location` header** (`/api/boats/{id}`). This is valid per RFC 9110 and correct behind the nginx proxy
  without forwarded-header configuration.
- **`description` is stored as sent.** `""` stays `""` rather than becoming `null`.
- **The 404 detail includes the requested id.** The id came from the request path and is not sensitive.
- **No OpenAPI/Swagger yet.** This file is the API contract. Per `CLAUDE.md`, any contract change must update it in
  the same iteration.
