# AI Usage Log

This project was built with Claude Code (model: Claude Opus 5.5) as a coding assistant. This log records the
actual prompts, the decisions the AI proposed, what was corrected or rejected by the developer, and how each
claim was verified. It is updated every iteration.

## Iteration 1 — scaffolding, infrastructure, authentication, CI (2026-10-13)

### Prompt 1 (verbatim, sent in plan mode)

```text
You are helping me implement The Boat App, a time-boxed fullstack technical challenge.

Goal: Build a small, maintainable boat management application. Prioritize correctness, simplicity, security, and reproducibility over architectural complexity.

Mandatory features:
- OIDC login and redirect to boat overview
- Authenticated paginated boat list
- Create, update, delete and view boat details
- Responsive React UI with routing, form validation, loading and error states
- REST CRUD API with proper HTTP errors and backend authentication
- Everything must start with docker compose up
- GitHub Actions for formatting, testing and Docker image builds
- README.md and AI_USAGE.md

Technical decisions:
- Java 21, Spring Boot, Maven, Spring Security OAuth2 Resource Server
- React, TypeScript, Vite, React Router
- PostgreSQL, Spring Data JPA, Flyway
- Keycloak with OIDC Authorization Code + PKCE
- One modular monolithic backend, organized by feature
- Backend JUnit tests, frontend Vitest tests
- Spotless for Java formatting, Prettier and ESLint for frontend
- Docker Compose with reproducible Keycloak realm import and demo user

Your task for this FIRST iteration ONLY:
1. Propose a concise repository structure and implementation plan.
2. Create CLAUDE.md with architecture rules, coding conventions and acceptance criteria.
3. Initialize the backend and frontend projects.
4. Set up PostgreSQL, Keycloak, realm import, and Docker Compose.
5. Create multi-stage Dockerfiles and healthchecks where appropriate.
6. Create a minimal Spring Boot health endpoint and a minimal React page.
7. Provide initial GitHub Actions jobs for format checks, tests, application builds and Docker image builds.
8. Add a short README for starting the application.
9. Start AI_USAGE.md with an honest log of AI-assisted decisions and actual prompts.

Important:
- Do not implement boat CRUD or the full UI in this iteration.
- Do not introduce microservices, CQRS, message queues, or unnecessary abstraction layers.
- Do not claim something works unless you execute and verify it.
- Check that external URLs, Keycloak issuer validation, browser redirect URLs and Docker networking are coherent.
- Keep demo credentials for local development only. Never commit secrets.
- Make small, meaningful commits, but ask before pushing to remote.
- At the end, report files changed, commands executed, verification results, and remaining issues.
- If Docker or other tools are unavailable, explicitly report what was not verified.

Begin with a short plan, then implement.
```

### Prompt 2 (verbatim, developer's review of the AI's plan)

```text
The proposed architecture and implementation plan are approved, with the following adjustments:

1. Prefer the latest stable Spring Boot 3.5.x patch instead of Spring Boot 4.0.x to minimize compatibility and integration risks under our time constraints.

2. Use JDK 21 as the reference environment. The Maven Wrapper does not provision Java, so use a Java 21 container for backend verification if the local JDK 26 causes issues.

3. Postpone PostgreSQL Testcontainers integration tests until the boat persistence layer is implemented. For this iteration, basic application context and security tests are sufficient.

4. Do not create an empty Flyway migration. The first migration should introduce the actual boats table in the next iteration.

5. Secure all requests by default, explicitly permitting only required public endpoints such as health checks.

6. Configure the Keycloak audience mapper for `boat-api` and verify both issuer and audience claims on a real issued access token.

7. Pin concrete dependency and container image versions rather than floating versions.

8. Prioritize a working Docker Compose environment and verified browser-to-Keycloak-to-backend authentication over additional scaffolding or test infrastructure.

9. Keep the GitHub Actions pipeline as planned: backend format/test/build, frontend format/lint/test/build, and Docker image builds.

10. Ensure AI_USAGE.md documents the actual prompts, design decisions, verification steps, and rejected or corrected AI suggestions.

Please proceed with iteration 1, working in small verifiable steps. Do not implement the boat CRUD yet. Stop and report any blocker that requires significant architectural change rather than repeatedly applying speculative fixes.
```

### AI suggestions that the developer corrected or rejected

| AI proposal | Developer decision | Reason |
|---|---|---|
| Spring Boot 4.0.x (latest offered by start.spring.io) | **Spring Boot 3.5.16** | Lower integration risk under time pressure. Trade-off: 3.5 open-source support ended mid-2026, so plan an upgrade path. |
| Testcontainers PostgreSQL tests from day one | **Postponed** until the persistence layer exists | No persistence yet; slice tests are enough. |
| Empty `V1__init.sql` baseline migration | **Rejected** | The first migration should create the real `boats` table. |
| Protect `/api/**` and permit actuator health | **Deny by default** (`anyRequest().authenticated()`), only `/actuator/health/**` public | Safer default for any endpoint added later. |
| Check the issuer on discovery metadata | **Check `iss` and `aud` on a real issued token** | Discovery metadata alone does not prove what ends up in tokens. |

### Design decisions made with AI assistance (accepted)

- **Issuer coherence across Docker networking.** Keycloak runs with `KC_HOSTNAME=http://localhost:8081` and
  `KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true`. The backend uses `NimbusJwtDecoder.withJwkSetUri(<internal keycloak:8080 URL>)`
  plus an explicit issuer validator (public `localhost:8081` URL) and an audience validator (`boat-api`).
  `issuer-uri` discovery was avoided because the backend container cannot reach `localhost:8081`.
- **Same-origin API.** nginx serves the SPA and proxies `/api` to the backend, so the backend needs no CORS config.
  The Vite dev server uses the same `/api` proxy.
- **Public SPA client** with PKCE S256, no client secret, direct-access grants disabled; redirect URIs limited to
  `localhost:3000` and `localhost:5173`.
- **`react-oidc-context` / `oidc-client-ts`** instead of a hand-rolled PKCE flow.
- **ESLint instead of oxlint.** The current `create-vite` React template ships oxlint; it was replaced to match
  the challenge's stated tooling.
- **Keycloak healthcheck via bash `/dev/tcp`**, because the Keycloak image has no curl or wget.

### Problems found during implementation

- **google-java-format 1.37.0 fails on JDK 21** (an opaque `InvocationTargetException` from Spotless). Versions
  1.28.0–1.36.0 were tested in a JDK 21 container and work, so it is pinned to 1.36.1.
- **Python's cookie jar drops cookies for `localhost`**, so the first scripted login attempt hit Keycloak's
  `cookie_not_found`. This was a problem in the test script, not the app; the script was switched to curl.
- **False positive in the "tampered signature" check.** Changing the *last* base64url character of the signature
  only changes padding bits and decodes to identical bytes, so the backend correctly accepted it. A change in the
  middle of the signature was correctly rejected with 401.
- **Keycloak CORS preflight echoes any origin.** On the actual token POST, `Access-Control-Allow-Origin` is only
  returned for configured web origins (`localhost:3000` yes, `evil.test` no). This is Keycloak's default behavior,
  noted here and left unchanged.

### Verification performed (all executed)

| Check | Result |
|---|---|
| `./mvnw spotless:check verify` in `maven:3.9.16-eclipse-temurin-21` | BUILD SUCCESS, 6 tests: anonymous 401, unknown path 401, `/api/me` with JWT 200, validator accepts correct iss+aud and rejects wrong iss or missing aud |
| `npm run format:check && lint && test && build` | All pass, 3 Vitest tests |
| `docker compose up --build -d` | postgres, keycloak, backend and frontend all `healthy` |
| `GET /actuator/health` | `{"status":"UP"}`; `/actuator/env`, `/api/me` and an unknown path without a token → 401 |
| Discovery issuer, from the host and from inside the backend container | `http://localhost:8081/realms/boatapp` in both cases |
| Scripted Auth Code + PKCE login (curl; same client, redirect URI and public Keycloak URL as the SPA) | Redirect to `http://localhost:3000/`; code exchange without verifier rejected ("PKCE code verifier not specified") |
| Claims of the real access token | `iss=http://localhost:8081/realms/boatapp`, `aud=boat-api`, `azp=boat-frontend`, `preferred_username=demo` |
| `/api/me` with that token, via nginx `:3000` and directly on `:8080` | 200 `{"username":"demo",…}` |
| Same backend image started with `OIDC_AUDIENCE=boat-other` | 401 `The aud claim is not valid` |
| CI workflow | `actionlint` passes; **the workflow has not run on GitHub** (no remote pushed) |

**Not verified:** the interactive login *in a real browser* (clicking "Log in" in the SPA). No browser automation
was available in the session. The scripted flow covers the same HTTP exchanges, but not the SPA's JavaScript
callback handling. To check it by hand: open http://localhost:3000, log in as `demo`/`demo`, and expect
"Signed in as demo".

## Iteration 2A — Boat persistence layer (2026-10-13)

### Prompt 1 (verbatim)

```text
Implement iteration 2A: Boat persistence layer only.

Read CLAUDE.md and inspect the existing backend before making changes.

Goal:
Introduce the Boat entity and PostgreSQL persistence using Spring Data JPA and Flyway.

Scope:

1. Create a Boat entity containing:
   - id: UUID, generated by the backend
   - name: required, max 150 characters
   - description: optional, max 2000 characters
   - createdAt: automatically initialized by the backend, immutable after creation

2. Create the first Flyway migration:
   `V1__create_boats.sql`

3. Implement a Spring Data JPA BoatRepository with standard CRUD operations.

4. Ensure Hibernate validates the schema but does not create or modify it. Flyway must own schema migrations.

5. Add focused persistence tests verifying:
   - Saving and retrieving a boat
   - UUID and createdAt generation
   - Required name constraint
   - Updating a boat without modifying createdAt

6. Verify the migration against the existing PostgreSQL container and confirm that the application starts successfully.

Constraints:
- Do not implement controllers, services, DTOs or API endpoints.
- Do not implement pagination or search yet.
- Do not add new architectural layers or dependencies unless necessary.
- Preserve existing authentication and Docker Compose behavior.
- Run formatting and relevant tests.
- Update AI_USAGE.md with the actual work and prompts.

At the end, report the schema, implemented classes, tests performed, commands executed and any unresolved issues.

Do not start iteration 2B automatically.
```

### Prompt 2 (verbatim, review of the AI's plan)

```text
The iteration 2A plan is approved.

Please proceed with the following adjustments:

1. Keep the persistence implementation minimal. Do not introduce abstractions or optimizations that are not justified by the current requirements.

2. For `createdAt`, a simple `@PrePersist` with `Instant.now()` is sufficient. Account for PostgreSQL timestamp precision in tests. Microsecond truncation is also acceptable if it keeps the implementation and assertions simpler.

3. Prefer straightforward execution of persistence tests. Avoid spending excessive time debugging nested Docker/Testcontainers configurations. If the environment causes issues, report them clearly.

4. Isolate tests that deliberately trigger PostgreSQL constraint violations, since a failed SQL statement can invalidate the current transaction.

5. Do not repeat the entire OIDC authentication flow unless security configuration changes. Existing security tests and basic authentication regression checks are sufficient.

6. Keep the implementation limited to Boat entity, Flyway migration, repository and focused persistence tests.

7. Update AI_USAGE.md with the actual decisions and verification results.

Implement iteration 2A, run the relevant checks and stop for review before iteration 2B.
```

### Prompt 3 (verbatim)

```text
Plan approved. Proceed with iteration 2A.

Two final adjustments:

Do not recreate the PKCE login script. Existing security tests and basic smoke checks are sufficient.

Ensure the PostgreSQL constraint violation test triggers the exception during flush and does not continue using the failed transaction.

Keep the implementation minimal, execute the tests, make the planned commits and report the actual results.

Do not start iteration 2B.
```

### Changes the developer made to the AI's plan

| AI proposal | Developer decision |
|---|---|
| Recreate the scripted PKCE login to re-check `/api/me` → 200 | **Rejected**: security config is unchanged; existing tests plus anonymous-401 smoke checks are enough |
| `@PrePersist` with microsecond truncation | Accepted. The developer noted plain `Instant.now()` would also do; truncation was kept because it makes the assertions exact |
| A DB constraint test via native `INSERT` | **Changed**: the violation must fire during the entity flush, and the failed transaction must not be reused |

### Decisions

- **Schema (`V1__create_boats.sql`)**: `id UUID PK`, `name VARCHAR(150) NOT NULL` + `CHECK (btrim(name) <> '')`,
  `description VARCHAR(2000)`, `created_at TIMESTAMPTZ NOT NULL`. No DB defaults, because the backend generates
  `id` (`GenerationType.UUID`) and `created_at` (`@PrePersist`). No extra indexes until pagination needs them.
- **Immutability of `createdAt`**: `updatable = false` on the column and no setter. `id` has no setter either.
- **Validation in two layers**: Bean Validation (`@NotBlank`, `@Size`) on the entity, plus DB constraints.
- **Testcontainers added now** (test scope; versions from the Spring Boot BOM: `spring-boot-testcontainers`,
  `testcontainers-postgresql`, `testcontainers-junit-jupiter`). A real PostgreSQL is needed so Flyway SQL and
  Hibernate's `validate` run as in production.
- **Constraint-test isolation**: `BoatTableConstraintsTest` is a separate `@DataJpaTest` with
  `jakarta.persistence.validation.mode=none`, so the entity reaches the database. Each test ends at the failing
  `saveAndFlush`. The test transaction is rolled back and never reused.
- Not added: `equals`/`hashCode`, `@Version` optimistic locking, services, DTOs. These will be reconsidered with the API in 2B.

### Verification performed (all executed)

| Check | Result |
|---|---|
| `./mvnw spotless:apply verify` in `maven:3.9.16-eclipse-temurin-21`, Docker socket mounted, `TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal` | BUILD SUCCESS, **13 tests** (5 repository, 2 DB constraint, 6 existing security). Testcontainers worked on the first try; no workaround needed |
| DB constraint tests | PostgreSQL raised `value too long for type character varying(150)` and `violates check constraint "boats_name_not_blank"`, both surfaced as `DataIntegrityViolationException` on flush |
| `spotless:check` | passes |
| `docker compose up --build -d --wait` against the **existing** Postgres volume (it held the empty iteration-1 Flyway history table) | Flyway: `Migrating schema "public" to version "1 - create boats"` / `Successfully applied 1 migration`; app started; all services healthy |
| `\d boats` and `flyway_schema_history` in the compose Postgres | Columns, types, PK and CHECK as above; one row `1 / create boats / success=t` |
| `docker compose restart backend` | `Schema "public" is up to date. No migration necessary.`; healthy |
| Negative check: backend image against an empty database with Flyway disabled | Startup fails with `Schema-validation: missing table [boats]`, which proves Hibernate only validates |
| Smoke: `/actuator/health` → 200 UP; `/api/me` (via nginx) and an unknown path without a token → 401 | as expected |

### Corrections

- The iteration 1 final report said the stack was "currently stopped". That was wrong: postgres and keycloak
  containers (created 12:50 from the repo directory) were still running when 2A started. They had the correct
  mounts, and 2A used them as "the existing PostgreSQL container".
- A first run of the validate-only check printed nothing, because macOS has no `timeout` command. It was re-run without it.

## Iteration 2B — Boat REST CRUD API (2026-10-13)

### Prompt (verbatim)

```text
Implement iteration 2B: Boat REST CRUD API.

Read CLAUDE.md and inspect the existing Boat entity, repository and migration before implementing anything.

Goal:
Expose the existing Boat persistence layer through a simple, secure REST API.

Scope:

1. Implement:
   - BoatController
   - BoatService (concrete class, no interface)
   - BoatRequest and BoatResponse DTOs
   - Minimal exception handling using Spring ProblemDetail

2. Expose these authenticated endpoints:
   - GET /api/boats/{id}
   - POST /api/boats
   - PUT /api/boats/{id}
   - DELETE /api/boats/{id}

3. HTTP semantics:
   - GET: 200 or 404
   - POST: 201 Created, with Location header
   - PUT: 200 or 404
   - DELETE: 204 or 404
   - Invalid input: 400 with useful field validation errors
   - Unauthenticated requests: 401

4. Validation:
   - name: required, trimmed, maximum 150 characters
   - description: optional, maximum 2000 characters
   - id and createdAt are server-managed and cannot be changed through requests

5. Use @Transactional for write operations and @Transactional(readOnly = true) for reads where appropriate.

6. Preserve the existing security configuration. All new endpoints must require authentication.

7. Implement focused controller/service tests covering:
   - Successful create, read, update and delete
   - Validation errors
   - Nonexistent boat
   - Unauthenticated access

8. Keep updates simple: last write wins. Do not add optimistic locking or a version field.

Constraints:
- Do not implement pagination, search, or the collection GET endpoint yet.
- Do not modify the frontend.
- Do not add unnecessary abstractions or dependencies.
- Verify the API against the real PostgreSQL database through Docker Compose.
- Run formatting, tests and builds.
- Update AI_USAGE.md with the actual prompt, decisions and corrections.
- Commit meaningful changes locally on the current feature branch.

At the end, report implemented endpoints, test results, commands executed, remaining issues and Git status.

Stop before iteration 2C.
```

### Decisions

- **Trimming in the DTO**: the `BoatRequest` compact constructor strips `name` before Bean Validation runs. So
  `"   "` fails `@NotBlank`, and the 150-character limit applies to the value that is stored.
- **Server-managed fields**: `BoatRequest` has no `id` or `createdAt`. Spring Boot's Jackson setup ignores unknown
  properties, so values sent for them are dropped. A controller test and the compose run both confirm this.
- **404**: `BoatNotFoundException extends ErrorResponseException`, which Spring MVC renders as a `ProblemDetail`
  without a custom handler method.
- **400 field errors**: Boot's default `ProblemDetail` handler only says "Invalid request content.", so
  `ApiExceptionHandler` (`com.boatapp.config`, extends `ResponseEntityExceptionHandler`) overrides only
  `handleMethodArgumentNotValid` to add `errors: [{field, message}]`. Malformed JSON and a non-UUID id get the
  framework's 400 `ProblemDetail`.
- **Relative `Location` header** (`/api/boats/{id}`). nginx forwards `Host` without the port, so an absolute URL
  built from the request would point at `http://localhost/...`. A relative reference is valid (RFC 9110) and
  needs no forwarded-header configuration.
- **Transactions**: `BoatService` is `@Transactional(readOnly = true)` at class level, and the write methods
  override it with `@Transactional`. Update relies on dirty checking. Last write wins, with no version column.
- **Tests**: `BoatControllerTest` is a `@WebMvcTest` slice with the real `SecurityConfig` and a mocked
  `BoatService`, covering HTTP semantics. `BoatServiceTest` is a `@DataJpaTest` on Testcontainers PostgreSQL with
  no mocks, covering create/read/update/delete and not-found.

### Corrections / deviations

- **A throwaway PKCE login was used again.** In 2A the developer said not to recreate the login script, and
  security config is still unchanged. But 2B requires verifying CRUD against compose, which needs a real token,
  and direct grants are disabled. A minimal curl script under `/private/tmp` produced a token for demo/demo and was
  deleted afterwards. Nothing was committed.

### Verification performed (all executed)

| Check | Result |
|---|---|
| `./mvnw spotless:apply verify` (JDK 21 container, Testcontainers) | BUILD SUCCESS, **27 tests** (10 controller, 4 service, 5 repository, 2 DB constraint, 6 security) |
| `docker compose up --build -d --wait backend` | backend rebuilt and healthy |
| POST through nginx with `"  Black Pearl  "` plus client-sent `id`/`createdAt` | 201, `Location: /api/boats/<new id>`, name trimmed, client `id`/`createdAt` ignored |
| GET / PUT (with a client-sent `createdAt`) | 200; PUT changed name and description, `createdAt` unchanged; DB row matches |
| POST with a blank name and a 2001-character description | 400 `Validation failed`, `errors` for `name` and `description` |
| GET for an unknown UUID / GET `/api/boats/nope` | 404 `Boat not found` / 400 |
| DELETE, then DELETE again, then GET | 204 / 404 / 404; row gone in PostgreSQL |
| POST without a token | 401 |
| `GET /api/boats` (collection, 2C scope) | 405, expected for now |

### Validation error security regression test

**Prompt (verbatim):**

```text
Add a focused security regression test for `ApiExceptionHandler.handleMethodArgumentNotValid`.

**Goal:** Ensure validation error responses provide useful feedback without leaking user-submitted values or internal implementation details.

Requirements:

1. Add a MockMvc test that submits an invalid `BoatRequest` containing a distinctive, potentially sensitive input value.
2. Verify that the response:
   - Returns HTTP 400 with `application/problem+json`.
   - Includes the expected `title`, `detail`, and `errors` structure.
   - Identifies the invalid field and provides a safe validation message.
   - Does **not** expose the submitted input value.
   - Does **not** expose stack traces, Java class names, SQL queries, database details, or internal exception messages.
3. Use realistic assertions against the actual response body, not only checks against the exception handler implementation.
4. Preserve the existing API error contract and avoid introducing unnecessary abstractions.
5. Run the relevant tests and formatting checks.

If the test reveals an actual information disclosure, propose the smallest appropriate fix and explain it before modifying production code.

Keep this change limited to validation error security testing and report the results.
```

**AI assistance:** Claude Code implemented a regression test verifying that validation error responses do not disclose user-submitted values or internal implementation details.

**Verification:** The test was executed against the actual HTTP response using MockMvc. To verify its effectiveness, a temporary information disclosure was intentionally introduced into `ApiExceptionHandler` (the temporary change appended the rejected value, `getRejectedValue()`, to each error message). The test failed as expected. The original implementation was restored, and all 28 backend tests passed.

**Human oversight:** The test requirements and information disclosure risks were reviewed before implementation. No production changes were necessary.

**Limitations:** The test covers field validation errors, not every possible exception or error response.
