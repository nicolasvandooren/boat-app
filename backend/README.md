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
| Framework | Spring Boot 3.5.16, Java 21 (LTS) | Boot 3.5 rather than 4.0 to reduce integration risk in the time box. Boot 3.5's open-source support ended in mid-2026, so an upgrade is due. |
| Persistence | Spring Data JPA + PostgreSQL 17 | Standard, little code |
| Migrations | Flyway | Versioned, reviewable SQL; Hibernate never touches the schema |
| Security | Spring Security OAuth2 Resource Server (JWT) | Stateless bearer tokens from Keycloak |
| Errors | RFC 9457 `ProblemDetail` | Built into Spring; one consistent error shape |
| Tests | JUnit 5, MockMvc, Testcontainers PostgreSQL | Web slices for HTTP behavior, real PostgreSQL for persistence and queries |
| Formatting | Spotless + google-java-format 1.36.1 | 1.37.0 fails on JDK 21 |

## Authentication

Every endpoint except `/actuator/health/**` requires `Authorization: Bearer <access token>`.

- Tokens are issued by Keycloak (realm `boatapp`, public SPA client `boat-frontend`, Authorization Code + PKCE).
- The backend validates the signature, **`exp`/`nbf`** (Spring Security's default `JwtTimestampValidator`, 60 s
  clock skew, kept because the custom validator wraps `JwtValidators.createDefaultWithIssuer`), **issuer** and
  **audience**:

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
`http://localhost:3000/api/...`. The backend is also published directly on `http://localhost:8080` (loopback only) for debugging.

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
| `page` | `0` | Zero-based, `0..21474836`. A page past the end returns `content: []` with the real totals. The upper bound is a deliberate API limit, `Integer.MAX_VALUE / 100` (the maximum `size`), so `page * size` always fits JPA's `int` offset. It is conservative: for smaller sizes, some larger pages would technically work but are still rejected. |
| `size` | `10` | `1..100` |
| `search` | none | Optional. Missing, empty or whitespace-only means no filter. Otherwise the trimmed value is matched as a **case-insensitive substring** of `name` **or** `description`. `%` and `_` are matched literally. Must not contain NUL (`U+0000`). |

- Ordering is always `createdAt DESC, id DESC`. The `id` tie-breaker keeps pages stable when two boats share a timestamp.
- Filtering, ordering, `LIMIT`/`OFFSET` and the count all run in PostgreSQL, so boats are never loaded into memory.
- No results returns 200 with `content: []`, `totalElements: 0`, `totalPages: 0`.

## Validation rules

Order of processing for `POST`/`PUT` bodies:

1. Jackson builds `BoatRequest` through its constructor, which `strip()`s `name` (all Unicode whitespace).
2. Spring MVC runs Bean Validation (`@Valid`) on the **trimmed** value. A violation means 400, and the service is not called.
3. When the entity is flushed, Hibernate Validator checks the same `@NotBlank`/`@Size` constraints on `Boat` again.
4. PostgreSQL applies its column constraints.

| Field | Application (`BoatRequest`, `Boat`) | PostgreSQL (`V1__create_boats.sql`) |
|---|---|---|
| `name` | Required; stripped, then `@NotBlank` (so whitespace-only is rejected), `@Size(max = 150)`, no NUL characters | `NOT NULL`, `VARCHAR(150)`, `CHECK (btrim(name) <> '')` |
| `description` | Optional, `@Size(max = 2000)`, no NUL characters; stored as sent (not trimmed) | `VARCHAR(2000)`, nullable |
| `id` | Generated by Hibernate (UUID); not accepted from clients. Path ids must parse as UUIDs. | `UUID PRIMARY KEY` |
| `createdAt` | Set in `@PrePersist`; mapped `updatable = false`, no setter | `TIMESTAMPTZ NOT NULL` (no default) |

Differences between the two layers (the application is the stricter one, and all API traffic passes through it):

- PostgreSQL's `btrim` removes only spaces. The CHECK rejects `"   "` but would accept a name made only of tabs or
  newlines. Only the application rejects those.
- PostgreSQL `text`/`varchar` cannot store NUL (`U+0000`). Without the application's `@Pattern` check the driver
  would fail with `invalid byte sequence for encoding "UTF8": 0x00` and the request would end in 500. The check
  rejects it as 400 (`"message": "must not contain NUL characters"`) for `name`, `description` and `search`.
- Bean Validation's `@Size` counts UTF-16 code units, while `VARCHAR(n)` counts characters. A name of emoji, which
  take two UTF-16 units each, hits the application limit before the database limit.

## Errors

Errors are returned as `application/problem+json` (RFC 9457). Validation errors share one shape with an `errors`
array. Handled errors contain no stack traces, class names or SQL.

What is and isn't echoed back:

- `detail` and `errors[].message` never contain rejected body or parameter values.
- `instance` is the **request path** as sent, without the query string. It can therefore contain user-supplied
  path segments: `GET /api/boats/not-a-uuid` returns `"instance": "/api/boats/not-a-uuid"`. Query parameter
  values such as `page=abc` do not appear.
- The 404 `detail` repeats the requested id. It has already parsed as a UUID, so it is the client's own path value.

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

Malformed JSON gives 400 with the framework's default ProblemDetail (`"title": "Bad Request"`, no `errors`).
**401** has no body (see Authentication).

`ApiExceptionHandler` deliberately has no catch-all handler, so unexpected exceptions are not turned into 4xx
responses. They reach the servlet container, which dispatches to Spring Boot's `/error` endpoint. That dispatch
passes through the security filter chain again, and the authenticated request still gets **500**, not 401.
The body is Boot's default error JSON with no exception message or stack trace:

```json
{ "timestamp": "…", "status": 500, "error": "Internal Server Error", "path": "/api/boats/…" }
```

This is covered by `UnexpectedErrorDispatchTest` (see below).

## Local development

Running the backend outside Docker uses the defaults in `application.yml`: PostgreSQL at `localhost:5432`
(database, user and password `boatapp`), and issuer plus JWKS at `localhost:8081`. Keycloak is published on 8081
by Docker Compose. **The Compose PostgreSQL is not published to the host**, so start a separate local database:

```bash
# from the repository root: Keycloak from Compose, plus a standalone PostgreSQL on localhost:5432
docker compose up -d keycloak
docker run -d --name boatapp-dev-db -p 5432:5432 \
  -e POSTGRES_DB=boatapp -e POSTGRES_USER=boatapp -e POSTGRES_PASSWORD=boatapp postgres:17.9-alpine

# if the full Compose stack is running, free port 8080 first: docker compose stop backend
# run the backend on :8080 (needs JDK 21); Flyway migrates the empty database on startup
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
| `BoatControllerTest` | `@WebMvcTest` + real `SecurityConfig` and `ApiExceptionHandler`, mocked `BoatService`, `jwt()` test tokens | Status codes, `Location`, JSON contract, body and parameter validation (incl. the `page` limit and NUL characters), no echoed values, 404, 401 |
| `BoatServiceTest` | `@DataJpaTest` + `BoatService`, Testcontainers PostgreSQL | CRUD incl. trimming and unchanged `createdAt`, not found, pagination metadata, ordering incl. ties, search, literal `%`/`_`, maximum page returns an empty page |
| `BoatRepositoryTest` | `@DataJpaTest`, Testcontainers | Round trip, generated `id`/`createdAt`, `createdAt` unchanged on update, Bean Validation of `name` |
| `BoatTableConstraintsTest` | `@DataJpaTest` with Bean Validation off, Testcontainers | PostgreSQL rejects a spaces-only name and a 151-character name |
| `UnexpectedErrorDispatchTest` | `@SpringBootTest(RANDOM_PORT)`: real Tomcat and real filter chain; mocked `BoatService` and `JwtDecoder`; Testcontainers | An unexpected exception in an authenticated request returns 500 via `/error` (not 401) with no internals; no token returns 401 |
| `MeControllerTest` | `@WebMvcTest` + real `SecurityConfig` | `/api/me` 401/200, unknown paths require authentication |
| `TokenValidatorTest` | Plain unit test | The configured validator accepts a valid token and rejects a wrong issuer, a missing audience, an expired token and a not-yet-valid token |

Every `@DataJpaTest` class runs the Flyway migration and Hibernate's `validate` against PostgreSQL. No test calls
Keycloak or validates a real token signature; that was verified manually against Docker Compose (see `AI_USAGE.md`).

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
