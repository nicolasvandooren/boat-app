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

## Iteration 2C — Paginated listing, search, backend API docs (2026-10-13)

### Prompt 1 (verbatim)

```text
Implement iteration 2C: paginated boat listing, optional search, and backend API documentation.

Read `CLAUDE.md` and inspect the existing BoatController, BoatService, BoatRepository, DTOs, tests, and migrations before modifying anything.

**Goal:** Complete the backend REST API required by the frontend while preserving all existing CRUD and authentication behavior.

### Scope

1. Implement the authenticated endpoint:

   `GET /api/boats?page=0&size=10&search=`

2. Pagination requirements:
   - Zero-based page index, default 0.
   - Default page size 10, maximum 100.
   - Reject negative page numbers, zero/negative sizes, and sizes above 100 with HTTP 400.
   - Apply deterministic sorting: `createdAt DESC`, then `id DESC`.
   - Return HTTP 200 with an empty content array if no results exist.

3. Optional search:
   - Search boat name or description, case-insensitively.
   - A missing, empty, or whitespace-only search parameter means no filtering.
   - Apply filtering at the database level before pagination.
   - Do not load all boats into memory.
   - Avoid introducing unnecessary query abstractions or dependencies.

4. Response contract:

   {
     "content": [BoatResponse],
     "page": 0,
     "size": 10,
     "totalElements": 0,
     "totalPages": 0
   }

   Create a small, explicit pagination response DTO. Do not expose Spring Data's Page serialization directly.

5. Extend existing classes:
   - BoatController
   - BoatService
   - BoatRepository

   Add only the DTOs or repository queries genuinely needed.

6. Error handling:
   - Use the existing ProblemDetail conventions.
   - Return consistent and useful HTTP 400 responses for invalid pagination parameters.
   - Do not expose internal exception messages, database information, or submitted sensitive values.

7. Tests:
   - Default pagination behavior.
   - Multiple pages and correct pagination metadata.
   - Deterministic ordering.
   - Empty result.
   - Case-insensitive search on name and description.
   - Search combined with pagination.
   - Invalid page and size parameters.
   - Anonymous access returns 401.
   - Regression tests for existing CRUD operations.

8. Verification:
   - Run backend formatting and tests with JDK 21.
   - Verify the endpoint against PostgreSQL through Docker Compose.
   - Ensure the complete existing test suite still passes.
   - Report actual commands and results, including anything not verified.

### Documentation

Create `backend/README.md` documenting:
- Backend architecture and technology choices.
- Authentication using OAuth2 Bearer JWT, including issuer and audience validation.
- All REST endpoints, request bodies, responses, and status codes.
- Pagination and search parameters.
- Validation rules.
- ProblemDetail error responses with representative examples.
- Local development, formatting, and test commands.
- Known trade-offs, including last-write-wins updates.

Update the root README to link to the backend documentation.

Add a convention to `CLAUDE.md`: any API contract change must update the backend documentation in the same iteration.

Update `AI_USAGE.md` with the actual prompts, decisions, corrections, and verification results.

### Constraints

- Do not modify the frontend.
- Do not change the existing authentication architecture.
- Do not implement Swagger/OpenAPI in this iteration.
- Do not add optimistic locking, new architectural layers, or unnecessary database indexes.
- Preserve existing CRUD functionality.
- Keep the implementation small and maintainable.
- Make meaningful local commits on a feature branch.
- Do not push or merge automatically.

At the end, provide a concise engineering report with files changed, test results, verified API behavior, architectural decisions, and Git status.

Stop before starting frontend development.
```

### Prompt 2 (verbatim, after interrupting the AI)

```text
I want get a plan
```

### Prompt 3 (verbatim, review of the AI's plan)

```text
The iteration 2C plan is approved, with the following adjustments:

1. Review the existing uncommitted changes before continuing. Keep them only if they match the approved design. Do not discard work without checking the diff.

2. Add a regression test for the changed type-mismatch error contract, including GET /api/boats/not-a-uuid. Verify HTTP 400, the expected ProblemDetail structure, field "id", and absence of the submitted invalid value.

3. Verify that Spring MVC method parameter validation is correctly handled and that invalid page/size values return HTTP 400, never an unexpected 500.

4. Keep the exception handling narrowly scoped. Do not introduce broad handlers that could hide unexpected server errors.

5. Preserve the existing pagination, search, documentation and verification plan. Prioritize correctness and completing the backend over optional refinements.

6. Add a convention to CLAUDE.md: planning phases must not modify project files unless explicitly authorized.

7. Document the actual decisions and corrections in AI_USAGE.md, including the previously disclosed edits made during planning.

Proceed with implementation, run the tests, make meaningful local commits, and stop before frontend development. Do not push automatically.
```

### Corrections (process)

- **The AI modified project files before inspecting the code and before any plan was approved.** The prompt
  said to read `CLAUDE.md` and inspect the existing code first. Instead, the AI started editing
  `BoatController`, `BoatService` and `BoatRepository`, and created `BoatPageResponse`. The developer rejected a
  full rewrite of `ApiExceptionHandler` and asked for a plan. The plan disclosed the uncommitted edits. After
  approval the diff was reviewed against the design and kept, because it matched. The handler was then changed
  with targeted edits instead of a file rewrite. As a result, `CLAUDE.md` now states that planning phases must not
  modify project files unless explicitly authorized.
- **Self-inflicted compile error:** a scripted replacement of `java.util.List` with `List` in `BoatServiceTest` also
  rewrote the import line to `import List;`. Spotless caught it and the import was fixed.

### Decisions

- **Parameter validation**: `@Min(0) page`, `@Min(1) @Max(100) size` on `@RequestParam`. Spring Framework 6.2's
  built-in MVC method validation raises `HandlerMethodValidationException` (400). `@Validated` is deliberately
  not used on the controller: it would route violations through `ConstraintViolationException`, which has no MVC
  handler and would surface as 500.
- **Narrow exception handling**: `ApiExceptionHandler` overrides exactly three `ResponseEntityExceptionHandler`
  hooks: body validation (existing), parameter validation (new) and type mismatch (new). All three produce the
  existing `Validation failed` + `errors[{field, message}]` shape. There is no catch-all `Exception` handler, so
  unexpected errors keep Spring Boot's default 500 handling.
- **Error contract change (documented)**: Spring's default type-mismatch detail echoes the submitted value
  (`Failed to convert 'id' with value: 'not-a-uuid'`). It now returns `errors: [{field: "id", message: "has an
  invalid format"}]`. This also changes the existing `GET /api/boats/{id}` bad-UUID body; the status stays 400.
  A regression test pins the new contract. `instance` still contains the request path the client sent; this is
  standard ProblemDetail behavior and is documented.
- **Search**: one JPQL query, `lower(name) like lower(:pattern) or lower(description) like lower(:pattern)`, with
  `escape '\'`. The service strips the input, escapes `\`, `%` and `_` so they match literally, and wraps it in
  `%…%`. Blank search calls `findAll(pageable)`. Spring Data derives the count query. Everything runs in
  PostgreSQL. No new index, per the constraint: a leading-wildcard LIKE can't use a b-tree index anyway, and
  `pg_trgm` is documented as the next step.
- **Ordering**: `Sort.by(desc("createdAt"), desc("id"))`, so ties on `createdAt` are broken by id.
- **DTO**: `BoatPageResponse(content, page, size, totalElements, totalPages)` built from `Page<Boat>`. Spring Data's
  `Page` JSON is not exposed.
- **Docs**: `backend/README.md` is the API contract until OpenAPI exists. `CLAUDE.md` now requires updating it with
  every contract change. The root README status line was stale ("boat management is not implemented yet") and was
  corrected.

### Verification performed (all executed)

| Check | Result |
|---|---|
| `./mvnw spotless:apply verify` (JDK 21 container, Testcontainers) | BUILD SUCCESS, **46 tests** (21 controller, 12 service, 5 repository, 2 DB constraint, 6 security) |
| New service tests (real PostgreSQL, seeded with explicit `id`/`created_at`) | newest-first default page; 25 boats → pages of 10/10/5, and page 3 empty with correct totals; `createdAt` ties ordered by `id DESC`; empty table → `[]`, 0, 0; case-insensitive name and description search; blank search = no filter; search applied before pagination (15 of 20 match → 2 pages); `%` and `_` matched literally |
| New controller tests | defaults `(0, 10, null)` and exactly 5 JSON keys; parameters passed through; `page=-1`, `size=0`, `size=-5`, `size=101` → 400 `Validation failed` with the right `field`, service never called; `page=S3CR3T-abc`, `size=99999999999` → 400 `has an invalid format` without the value; `GET /api/boats/not-a-uuid` → 400, field `id`, no echoed value; anonymous → 401 |
| `docker compose up --build -d --wait` + throwaway PKCE token (in `/private/tmp`, deleted afterwards) | all services healthy |
| `GET /api/boats` on the empty DB | 200, `content: []`, 0, 0 |
| Seeded 26 boats via POST, then listed through nginx | defaults: 10 newest, 26 total, 3 pages; `page=2`: last 6; `size=100`: all 26 |
| `search=pEaRl` / `submarine` (description) / `100%` / `boat 1` with `size=5&page=1` / whitespace / no match | 1 / 1 / 1 (literal) / 11 total, second page of 5 / 26 / 0 |
| `page=-1`, `size=0`, `size=101`, `page=S3CR3T-abc`, `size=99999999999`, `/api/boats/not-a-uuid` | all 400 with the validation shape and no echoed values; no 500 |
| Anonymous `GET /api/boats` | 401 |
| CRUD regression: GET/PUT/POST/invalid POST | 200/200/201/400 |
| Cleanup | 27 × DELETE → 204, deleted id → 404, `boats` count back to 0; no errors or 500s in backend logs |

**Not verified:** the frontend (out of scope, unchanged). CI on GitHub (nothing pushed).

### Unexpected server error regression check

**Prompt (verbatim):**

```text
Perform one focused backend regression check for unexpected server errors.

Goal: Verify that an unexpected exception in an authenticated API request produces HTTP 500, rather than being incorrectly transformed into HTTP 401 by Spring Security during error dispatch.

Requirements:
1. Add a focused integration-style test using the existing Spring MVC and Security test infrastructure.
2. Simulate an unexpected server-side exception from a protected endpoint.
3. Verify the actual HTTP response status is 500.
4. Do not expose exception messages, stack traces, SQL information or internal implementation details in the response body.
5. Do not introduce a broad catch-all exception handler solely to pass the test.
6. If the test reveals a problem, explain the root cause and propose the smallest security configuration change before implementing it.
7. If a MockMvc test cannot reproduce the real servlet error dispatch behavior, report that limitation and propose a minimal runtime verification instead.

Keep the change focused. Do not modify unrelated code or introduce new architectural abstractions.

Document meaningful findings in AI_USAGE.md. Run the relevant tests and formatting checks, commit locally, and do not push automatically.
```

**MockMvc limitation:** MockMvc has no servlet container. An unhandled exception propagates out of `perform()` as a
`ServletException`, and the container's error dispatch to `/error` never happens. That dispatch is where Spring
Security could turn an error into 401. So MockMvc cannot answer this question.

**Approach:** the new `UnexpectedErrorDispatchTest` uses `@SpringBootTest(webEnvironment = RANDOM_PORT)`, which
runs a real embedded Tomcat with the real `SecurityConfig` filter chain. It uses the existing
`PostgresTestContainer` for the datasource and `TestRestTemplate` for real HTTP calls. Two things are mocked:
`BoatService.get` throws `IllegalStateException("S3CR3T-internal-detail select * from boats")`, and `JwtDecoder`
accepts a fixed token so no Keycloak is needed (issuer and audience validation stay covered by `TokenValidatorTest`).

**Findings:**

- **No problem found; no production change.** The authenticated request returns **500**. The body is Spring Boot's
  `/error` JSON (`"status":500`, `"error":"Internal Server Error"`), which proves the container error dispatch
  happened. The body does not contain the exception message, marker, class names, `select`, or a stack trace. The
  message appears only in the server log. The same endpoint without a token returns 401.
- **The test is sensitive to the risk it targets.** A temporary, uncommitted `.requestMatchers("/error").denyAll()`
  in `SecurityConfig` made the test fail with `expected 500 but was 403`. This shows the `/error` dispatch really
  passes through the security filter chain, and that the authenticated context survives it in the real
  configuration. Afterwards `SecurityConfig` was restored and `git diff` confirmed no production change.
- No catch-all exception handler was added.

**Verification:** `./mvnw spotless:check verify` (JDK 21 container, Testcontainers): BUILD SUCCESS, **48 tests**.
`backend/README.md` was updated: the 500 body had been marked "not verified", and the test table now includes the new class.

**Limitations:** the token is decoded by a mock, so the test does not cover real signature validation during error
dispatch. Only one exception type was exercised, from one endpoint.

## Backend risk review and final corrections (2026-10-14)

### Prompt 1 (verbatim, review request)

```text
Perform a final, time-boxed backend risk review before frontend development.

Read CLAUDE.md, the existing backend code, configuration, tests, Docker Compose and backend/README.md.

The backend currently has 48 passing tests. The goal is to identify important untested risks, not to expand the architecture.

Focus on:

1. JWT validation
   - Verify that the configured JwtDecoder validates token expiration (`exp`) and not-before (`nbf`) in addition to issuer, audience and signature.
   - Check whether custom JWT validators accidentally replace Spring Security's default timestamp validation.

2. Pagination edge cases
   - Inspect behavior for extremely large page numbers and resulting offsets.
   - Identify any realistic risk of unexpected 500 responses.
   - Do not introduce arbitrary limits without justification.

3. Configuration and security
   - Check that no real secrets or tokens are committed.
   - Verify that sensitive Actuator endpoints remain protected.
   - Review authentication-related logging and CORS configuration.
   - Distinguish deliberate local-development settings from production-safe settings.

4. Docker and integration
   - Review healthchecks, startup dependencies and configuration consistency.
   - Identify issues that could prevent a fresh clone from starting successfully.

5. API contract
   - Identify any significant inconsistency between actual endpoint behavior, tests and backend/README.md.

Rules:
- Review and report first; do not modify production code automatically.
- Classify findings as blocking, important but non-blocking, or optional.
- Cite exact files and relevant code locations for each finding.
- Do not add speculative features or refactor working code.
- Avoid repeating tests already demonstrated unless a concrete gap exists.
- Recommend at most three high-value corrections.
- Keep the review short and focused.

At the end, provide a clear GO / NO-GO recommendation for starting frontend development.

Do not commit or push automatically.
```

### Prompt 2 (verbatim, approval of the review)

```text
Backend risk review approved. Please implement the final targeted corrections before we freeze the backend.

1. F1 — Pagination:
   - Add the conservative maximum page constraint of 21,474,836, derived from Integer.MAX_VALUE / maximum page size (100).
   - Document that this is a deliberate API limit, not the exact limit for every page/size combination.
   - Add a focused HTTP 400 regression test.
   - Verify the behavior with an authenticated request through Docker Compose.

2. F2 — PostgreSQL NUL characters:
   - First reproduce the behavior separately for name, description and search against real PostgreSQL.
   - If the error is confirmed, implement the smallest maintainable validation fix.
   - Verify the resulting HTTP response is 400, not 500, and contains no JDBC or SQL implementation details.
   - Avoid broad exception handlers or unnecessary validation frameworks.

3. O1 — JWT validity:
   - Add focused regression tests proving that expired and not-yet-valid JWTs are rejected by the configured validators.

4. Update backend/README.md and AI_USAGE.md with actual decisions, corrections, testing results and limitations.

5. Run formatting and the full backend test suite using JDK 21.

Constraints:
- Keep all changes limited to these findings.
- Do not refactor existing architecture.
- Do not change Docker Compose or frontend code.
- Do not introduce additional features.
- Do not spend more than approximately 30 minutes investigating unexpected issues; report blockers instead.
- Make meaningful local commits.
- Do not push or merge automatically.

At the end, report the actual test results and any unresolved risks. Stop before frontend development.
```

### Review findings (read-only phase, with library behavior checked via `javap` on the resolved jars)

| Id | Class | Finding |
|---|---|---|
| F1 | important | Spring Data JPA 3.5.13's `PageableUtils.getOffsetAsInteger` throws `InvalidDataAccessApiUsageException` when `page * size > Integer.MAX_VALUE`; there was no upper bound on `page`, so this produced 500 |
| F2 | important (suspected, then confirmed) | PostgreSQL rejects `U+0000` in text; NUL in `name`, `description` or `search` reached the driver and produced 500 |
| O1 | optional | `exp`/`nbf` *are* validated: `JwtValidators.createDefaultWithIssuer` → `createDefaultWithValidators` adds `JwtTimestampValidator` (60 s skew), so the custom validator does not replace it. But no test pinned this |
| — | no issue | no committed secrets or tokens; only Actuator `health` exposed; no backend CORS; Compose healthchecks and dependency order consistent; local-dev-only settings (Keycloak `start-dev`/HTTP, `admin/admin`, `demo/demo`, DB defaults, published `:8080`) are deliberate and documented |

Recommendation given: **GO** for frontend development, with F1, F2 and O1 to be fixed before the backend freeze.

### Reproduction before the fix

- **Real PostgreSQL, using a temporary probe test that was not committed:** `name`, `description` (on flush) and
  `search` all failed with `PSQLException: invalid byte sequence for encoding "UTF8": 0x00`. The exception surfaced
  as `org.hibernate.exception.DataException` for the two fields and `DataIntegrityViolationException` for search.
- **HTTP through Compose with a real token:**
  - `GET ?page=21474836&size=100` → 200 with an empty page;
  - `GET ?page=21474837&size=100` → **500**;
  - `?search=a%00b`, POST with a NUL in `name`, and POST with a NUL in `description` → **500**. Spring Boot's
    `/error` body contained no SQL details, but the status was wrong.

### Corrections implemented

- **F1**: `BoatController.MAX_PAGE = Integer.MAX_VALUE / 100` (21 474 836) as `@Max` on `page`. This is a deliberate,
  conservative API limit that is correct for every allowed `size`, not the exact limit for each page/size
  combination. The existing parameter-validation handler renders it as 400.
- **F2**: `@Pattern(regexp = "[^\\x00]*", message = "must not contain NUL characters")` on `BoatRequest.name`,
  `BoatRequest.description` and the `search` request parameter, sharing one constant. No new handler and no
  catch-all handler.
- **O1**: `TokenValidatorTest` now covers an expired token (`exp` 120 s in the past) and a not-yet-valid token
  (`nbf` 120 s in the future). Both lie beyond the 60 s skew and both are rejected.
- `backend/README.md`: the page bound with its rationale and conservativeness, the NUL rule in the validation table
  and the layer differences, the `exp`/`nbf` validation, and the test table.

### Correction during implementation

- The first version of the search NUL controller test got 200. The cause was the test, not the fix: MockMvc's
  `get("/api/boats?search=a%00b")` URL template re-encodes `%` to `%25`, so the parameter was the literal text
  `a%00b`. The test now sends the real character via `.param("search", "a\u0000b")`. The Compose run confirms 400
  for a real `%00` from curl.

### Verification (all executed)

| Check | Result |
|---|---|
| `./mvnw spotless:apply spotless:check verify` (JDK 21 container, Testcontainers) | BUILD SUCCESS, **56 tests** (was 48): +1 page-limit row, +1 max-page accepted, +2 NUL body, +1 NUL search (controller); +1 max page on real PostgreSQL (service); +2 JWT validity |
| Compose after rebuild, real token through nginx | `page=21474836&size=100` → 200 empty page; `page=21474837&size=100` and `page=2147483647` → 400 `must be less than or equal to 21474836`; `search=a%00b`, NUL in name, NUL in description → 400 `must not contain NUL characters` with the right `field`; normal search, POST and DELETE still 200/201/204 |
| Response bodies | validation ProblemDetail only; no `PSQLException`, `0x00`, `UTF8` or SQL text |
| Backend log after restart | 0 `ERROR`/`PSQLException` lines; DB left with 0 boats; throwaway token script deleted |

### Limitations

- NUL is only rejected where clients can write text: the `BoatRequest` fields and `search`. Other control
  characters are accepted and stored as sent.
- The JWT validity tests exercise the configured validator directly, not a signed token end to end through the
  filter chain. Signature validation remains covered by the earlier manual Compose verification.
- CI has not run these commits (not pushed).

## Pre-frontend browser verification (2026-10-14)

Before any frontend change, the existing OIDC flow was tested in real Google Chrome through Claude Code's
browser integration (Claude in Chrome). The first attempts went through an Arc browser connection, where every
tab-creation call timed out. The AI reported the exact tool errors instead of working around them. The
developer then switched to Google Chrome.

The developer's verification prompt asked for: click "Log in"; reach the Keycloak page; log in as `demo/demo`;
return to React; check the displayed user; `GET /api/me` through nginx; refresh; logout. Each check was reported as
PASS/FAIL/NOT VERIFIED, with no tokens, codes or session values printed.

Result: all 8 checks passed (PKCE S256, code and state removed after the callback, `/api/me` 200 with
`subject`/`username`, session restored on refresh, Keycloak logout confirmed by the login form reappearing).
The extension's network log once showed a 503 for an unauthenticated `/api/me`, while the nginx access log showed
401 for the same request. The AI attributed the 503 to the extension's capture, not the app. One gap against UC1
was found: an anonymous visitor saw a manual "Log in" button instead of being redirected to Keycloak.

## Iteration 3A.1 — Frontend foundation and automatic login (2026-10-14)

### Prompt 1 (verbatim, sent in plan mode; iteration 3A overall)

```text
# Iteration 3A — Frontend Architecture & Boat Browsing

You are working on The Boat App, a time-boxed fullstack technical challenge.

**Your task is to design and implement the first functional frontend iteration: authentication integration, fleet overview, pagination, search and boat details.**

First, inspect the existing project and propose an implementation plan. **Do not modify files during planning. Wait for approval before writing code.**

## 1. Current project context

The backend is complete and provides:

- Java 21 / Spring Boot 3.5
- PostgreSQL with Flyway migrations
- Keycloak authentication using OAuth2/OIDC
- JWT validation with issuer, signature, audience and timestamp validation
- REST CRUD API with pagination and search
- Consistent ProblemDetail error responses
- 56 passing backend tests

The frontend already has:

- React, TypeScript and Vite
- React Router
- `react-oidc-context` / `oidc-client-ts`
- An existing API client
- ESLint, Prettier and Vitest
- Docker Compose integration through Nginx

Read `CLAUDE.md`, the frontend source code, configuration files, `backend/README.md` and the relevant Docker configuration before proposing changes.

Preserve working code whenever possible.

## 2. Authentication — already verified

The existing OIDC flow has been tested successfully in real Google Chrome using Claude Code's browser integration.

All 8 checks passed:

- Redirect to Keycloak after clicking Log in
- Authorization Code + PKCE (S256)
- Successful login with the local demo account
- Callback to React and successful token exchange
- Correct cleanup of authorization parameters from the URL
- Authenticated GET `/api/me` through Nginx
- Session restoration after page refresh
- Successful Keycloak logout and session cleanup

No console errors or application network failures were observed.

**Do not replace or unnecessarily refactor this working authentication implementation.**

One behavior must change to satisfy UC1:

- Opening a protected application route without authentication must automatically redirect to Keycloak.
- After login, the user must reach `/boats`.
- Authenticated visitors should reach the requested protected route where practical.
- Add a public `/signed-out` route to avoid automatic re-login after logout.
- Handle callback processing, authentication errors and loading states without redirect loops.
- Preserve the existing sessionStorage configuration.
- Clear user-specific TanStack Query cache when the authenticated session ends or changes.

Verify these changes again in Chrome after implementation.

## 3. Architecture

Use a small, feature-oriented React architecture.

Preferred libraries:

- React Router for navigation
- `react-oidc-context` for authentication
- `@tanstack/react-query` for server state, queries and caching
- CSS Modules and global CSS design tokens for styling
- Vitest and React Testing Library for tests

Suggested structure (adapt to existing files):

frontend/src/
- app/
  - App.tsx
  - router.tsx
  - queryClient.ts
- auth/
  - oidcConfig.ts
  - ProtectedRoute.tsx
- api/
  - client.ts
- features/boats/
  - api.ts
  - types.ts
  - BoatsPage.tsx
  - BoatDetailPage.tsx
  - components/
    - BoatCard.tsx
    - BoatSearch.tsx
    - BoatPagination.tsx
- components/
  - Layout.tsx
  - LoadingState.tsx
  - ErrorState.tsx
- styles/
  - tokens.css
  - global.css

Architecture rules:

- Organize business logic by feature.
- Keep HTTP concerns separate from presentation.
- Use TanStack Query for server data, caching, retries and invalidation.
- Do not duplicate server state in component state.
- Avoid Redux, Zustand or unnecessary global state managers.
- Avoid premature abstractions or generic service/repository layers.
- Use strict TypeScript without `any`.
- Reuse the existing API client where appropriate.

## 4. Visual design — Nautical Premium

Create a modern maritime SaaS interface with:

- Deep navy blue as primary color
- White and off-white backgrounds
- Restrained turquoise accents
- Clear typography and visual hierarchy
- Subtle borders, rounded corners and restrained shadows
- Consistent spacing and interaction feedback
- Responsive layout for desktop, tablet and mobile

Use responsive boat cards rather than a dense table.

Do not add fake images, stock photos or fields that do not exist in the backend.

Keep the visual design professional and lightweight, without excessive animations or decorative effects.

## 5. Routes and features

Implement:

- `/` → redirect to `/boats`
- `/boats` → authenticated fleet overview
- `/boats/:id` → authenticated boat detail
- `/signed-out` → public post-logout page

### Fleet overview

Use:

GET /api/boats?page=0&size=10&search=

Requirements:

- Display name, description and creation date for each boat.
- Responsive cards with accessible links to details.
- Server-side pagination using the backend response metadata.
- Case-insensitive search by name or description (handled by backend).
- Store page and search state in URL query parameters.
- Reset page to 0 when the search changes.
- Optionally debounce search input.
- Loading, empty-fleet, empty-search and error states.
- Accessible pagination controls with previous/next navigation.
- Retry option after request failures.

The backend response is:

{
  "content": [],
  "page": 0,
  "size": 10,
  "totalElements": 0,
  "totalPages": 0
}

Use TanStack Query with query keys that include pagination and search parameters.

### Boat details

Use:

GET /api/boats/{id}

Display:

- Boat name
- Description
- Creation date
- Back navigation
- Loading and error states
- Dedicated 404 state

Preserve list search and pagination context when navigating back, where practical.

Do not implement boat creation, editing or deletion in this iteration. Those features belong to 3B.

## 6. API integration

Extend the existing API client.

Requirements:

- Attach the current OIDC access token.
- Support AbortSignal for cancellable requests.
- Define TypeScript types matching the backend DTOs.
- Handle HTTP errors consistently.
- Preserve relevant ProblemDetail information without exposing internal technical details.
- Treat 401 responses appropriately without creating automatic redirect loops.
- Do not log tokens or authorization codes.

Keep API functions small and straightforward.

## 7. ESLint — Airbnb style

I prefer the Airbnb JavaScript/React style guide.

Before changing dependencies:

- Inspect existing versions of React, TypeScript, ESLint and Vite.
- Check compatibility with the official Airbnb configuration.
- Prefer Airbnb-compatible React and TypeScript rules.
- Include `eslint-plugin-jsx-a11y` and React Hooks lint rules.
- Preserve a modern ESLint flat configuration if practical.
- Do not downgrade major dependencies solely for Airbnb.
- If official Airbnb packages are incompatible, propose a modern equivalent and justify it before implementation.
- Keep Prettier responsible for formatting.
- Do not disable lint rules broadly just to make generated code pass.

Ensure GitHub Actions continues to check formatting, lint, tests and production builds.

## 8. Accessibility

Target WCAG 2.2 AA where practical.

Requirements:

- Semantic HTML landmarks and headings
- Keyboard-accessible navigation
- Visible focus indicators
- Accessible labels for controls
- Accessible search and pagination
- Accessible loading and error feedback
- Appropriate announcements for asynchronously updated content
- Sufficient color contrast
- No unnecessary ARIA

Add automated accessibility checks using a Vitest-compatible axe integration.

Test important components, but do not claim full WCAG compliance based only on automated checks.

## 9. Testing

Add focused behavioral tests for:

- Protected routing and automatic login
- Public signed-out route
- Boat list loading and success
- Empty list and empty search results
- Search and pagination interactions
- API error and retry behavior
- Boat detail rendering
- Boat not found
- Basic accessibility violations

Use Vitest and React Testing Library.

Mock external dependencies at appropriate boundaries.

Avoid brittle tests based on implementation details or CSS classes.

## 10. Verification

After implementation:

1. Run Prettier checks.
2. Run ESLint.
3. Run TypeScript checks.
4. Run Vitest.
5. Run the production build.
6. Run Docker Compose.
7. Verify authentication and boat browsing in the connected Google Chrome browser.
8. Check desktop and mobile layouts.
9. Inspect browser console and network errors.

Do not claim any verification that was not actually executed.

## 11. Documentation and delivery

Update:

- `CLAUDE.md` with frontend architecture, linting and accessibility conventions.
- Frontend documentation with development and test commands.
- `AI_USAGE.md` with meaningful decisions, prompts and verification results.

Preserve the existing detailed AI log. It will be condensed into an evaluator-focused summary before final submission.

Use meaningful commits on a dedicated frontend feature branch.

Do not push or merge automatically.

## Constraints

- Do not modify backend code.
- Do not modify Keycloak configuration without a demonstrated issue and explicit approval.
- Do not introduce a heavy UI framework.
- Do not implement create, update or delete yet.
- Do not introduce unnecessary abstractions.
- Do not alter project files during planning.

## Expected output

First, provide a concise plan covering:

1. Proposed file structure and components.
2. Dependency choices and Airbnb compatibility.
3. Authentication routing and logout strategy.
4. API data-fetching and caching strategy.
5. Visual design and accessibility approach.
6. Tests and browser verification plan.
7. Risks and trade-offs.
8. Estimated implementation complexity.

**Stop after presenting the plan. Wait for approval before implementing iteration 3A.**
```

### Plan reviews by the developer (three rounds, summarized; each one rejected the plan and asked for changes)

1. **Checkpoints and simplification.** Deliver 3A as 3A.1 (foundation and auth), 3A.2 (fleet overview) and
   3A.3 (details and accessibility), verifying each before the next. Use fewer files and abstractions,
   zero-based `page` in the URL, and keep the OIDC config intact. React and TanStack lint plugins are optional.
   Never force peer dependencies, and verify that the a11y lint rules really fire.
2. **Preserve the working OIDC flow.** Keep callback changes minimal. Prefer always returning to `/boats` over
   risky deep-link restore. Include the user's `sub` in boat query keys (in 3A.2). Move AbortSignal,
   ProblemDetail parsing and boat API work to 3A.2.
3. **Reconcile contradictions.** The AI's second plan revision still contained parts of the first one (data
   router, `returnTo`). The developer listed the final decisions: keep `BrowserRouter`, keep `onSigninCallback`
   unchanged, no `returnTo`/`safeReturnTo`, change only the post-logout URI, and keep cache management minimal.

### AI proposals the developer corrected or rejected

- **Migrating to `createBrowserRouter` for deep-link restore after login.** The AI argued that the router's
  location would go stale after `history.replaceState`. Rejected as too risky for a flow that already works.
  Instead, login always lands on `/` → `/boats`, and the existing callback is untouched.
- **A 1-based `page` in the URL** was replaced with a zero-based one that matches the API (applies in 3A.2).
- **A large file split** (`app/`, `router.tsx`, `listParams.ts`, one file per UI state) was trimmed to the files
  that are needed now.
- **Patching the plan instead of rewriting it** produced contradictory instructions. The final plan was rewritten
  as a single authoritative scope.

### Decisions

- **ESLint:** the project uses ESLint 10.11. Checked on npm: `eslint-config-airbnb` 19.0.4 supports ESLint 7/8 only,
  `eslint-config-airbnb-extended` 3.3.0 supports ESLint ^9, and `eslint-plugin-jsx-a11y` 6.10.2 and
  `eslint-plugin-react` 7.37.5 declare peers up to ESLint 9. The adopted setup is typescript-eslint
  `strictTypeChecked` (type-aware), react-hooks, `eslint-plugin-jsx-a11y-x` 0.2.0 (peer ESLint 9/10), and
  13 essential non-formatting Airbnb rules. One narrow option was added: `restrict-template-expressions`
  allows numbers. React and TanStack lint plugins were deferred, as the developer allowed.
- **Gate before relying on jsx-a11y-x:** ESLint ran on a temporary file containing `<img>` without `alt` and
  `<div onClick>`. It reported `alt-text`, `click-events-have-key-events` and `no-static-element-interactions`,
  and the file was then deleted.
- **`RequireAuth` instead of the library's `useAutoSignin`.** The library hook calls the module-internal `useAuth`,
  so tests can't mock it at the `useAuth` boundary. The custom guard is about 15 lines. It redirects only when
  there are no callback params, no loading, no active navigator and no error, and only once per mount (a ref
  guard). The guard is re-armed after a successful authentication, so a later session loss (for example a failed
  silent renewal) redirects once more.
- **Cache:** `queryClient.clear()` runs before `signoutRedirect()`, and an effect in `App.tsx` clears the cache when
  `user.profile.sub` changes. Private routes render only once `isAuthenticated` is true.
- **The header username comes from the ID token's `preferred_username` claim** instead of an `/api/me` call.
  `HomePage` and its tests were removed, and their states moved into `RequireAuth`.
- **Testing:** Vitest runs without globals, so Testing Library's automatic cleanup was not registered.
  `setupTests.ts` now calls `afterEach(cleanup)`. Without it, the new multi-test files failed with duplicate elements.

### Verification performed

| Check | Result |
|---|---|
| `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` | all pass; **11 tests** in 2 files (RequireAuth 5, App routing and cache 6) |
| Mutation check | with the ref guard removed, the StrictMode test fails with "called 2 times"; restored afterwards |
| `docker compose up --build -d frontend` | all 4 services healthy; `/signed-out` served (200) |
| Chrome: anonymous `/boats` | **PASS**: exactly one redirect to Keycloak (`boat-frontend`, PKCE S256, `redirect_uri=/`) |
| Chrome: login `demo/demo` | **PASS**: back on `/boats` with no query string, token exchange 200, "Signed in as demo", no console messages |
| Chrome: `/` → `/boats` | **PASS** after reload (see the finding below) |
| Chrome: refresh | **PASS**: session restored on `/boats` |
| Chrome: logout | **PASS (scripted click)**: Keycloak logout with `post_logout_redirect_uri=/signed-out` 200 → `/signed-out`, user removed from sessionStorage, no automatic re-login |
| Chrome: Sign in again | **PASS (scripted click and form submit)**: Keycloak showed the login form (the SSO session had really ended); after login, back on `/boats` with no query string |
| Layout | desktop screenshot; phone width approximated with a 390 px same-origin iframe (Chrome would not resize the window below 1200 px): header wraps, no horizontal overflow |

### Problems found

- **Browser tool input stopped working mid-session.** After the first login, the extension's mouse clicks and key
  presses never reached the page: capture-phase listeners recorded no `pointerdown`, `mousedown`, `click` or
  `keydown` events, on both localhost:3000 and Keycloak. Synthetic events were recorded. The React handlers were
  attached and the buttons were the topmost elements. The remaining steps were completed with scripted
  `button.click()` and `form.requestSubmit()`, which run the same handlers but are not trusted user input.
  Logout and re-login with real input are therefore **not verified** in this session.
- **Stale `index.html` after a redeploy (not fixed).** Navigating to `/` served a heuristically cached old
  `index.html` that loaded the previous bundle (old HomePage). nginx sends `index.html` with `Last-Modified`/`ETag`
  but no `Cache-Control`. Missing `/assets/*` files also fall back to `index.html` with 200. A fix would be
  `Cache-Control: no-cache` for `index.html`, long-lived caching for hashed assets, and `try_files $uri =404` under
  `/assets/`. This was reported for a decision, not applied, because it is outside the 3A.1 scope.

### Limitations

- No axe checks yet (planned for 3A.3). Contrast was chosen from token values, not measured in the browser.
- CI has not run these commits (not pushed).

## Iteration 3A.2 — Fleet overview and nginx caching (2026-10-14)

### Prompt 1 (verbatim, approval of 3A.1 and scope of 3A.2, sent in plan mode)

```text
Checkpoint 3A.1 is approved. Proceed with iteration 3A.2 — Fleet Overview.

Keep the existing architecture and authentication unchanged.

### Step 1 — Fix the verified Nginx caching issue

Inspect the actual nginx.conf before editing.

Make the smallest safe change so that:
- SPA routes continue to serve index.html.
- HTML is revalidated rather than served from a stale browser cache.
- Existing Vite hashed assets can be cached long-term.
- Missing /assets/* files return 404 instead of index.html with status 200.

Verify the behavior using HTTP requests for /, /index.html, /boats, an existing asset and a missing asset.

Do not modify backend or Keycloak configuration.

### Step 2 — Implement the fleet overview

Replace the /boats placeholder with a functional fleet overview using:

GET /api/boats?page=0&size=10&search=

Requirements:
- TanStack Query for server state.
- User-specific query keys including the authenticated subject.
- Typed API responses matching the backend DTOs.
- Authorization header with the current access token.
- AbortSignal support.
- Minimal ProblemDetail-aware error handling.
- Responsive Nautical Premium boat cards.
- Boat name, description and creation date.
- Search by name or description.
- Debounced search, with page reset on search changes.
- Zero-based page and search parameters in the URL.
- Server-side pagination using totalPages and totalElements.
- Loading, empty fleet, empty search results, 401 and generic error states.
- Accessible labels, keyboard navigation, focus styles and retry action.

Prefer simple components and reuse the foundation from 3A.1. Do not introduce another state-management library or a UI framework.

Do not implement the boat detail page yet; that belongs to 3A.3. Boat cards can link to /boats/:id in preparation for that iteration.

### Step 3 — Test and verify

Add focused tests for:
- Successful list loading.
- Empty fleet and empty search results.
- Search updating the URL and resetting pagination.
- Pagination.
- API errors and retry.
- Authentication-aware data fetching.

Run formatting, lint, type checking, tests and production build.

Verify in Google Chrome:
- Authenticated fleet loading.
- Search.
- Pagination.
- Loading and error behavior where practical.
- Desktop and mobile layout.
- No unexpected console or network errors.

You may create a small number of clearly identified development boats through the existing authenticated API if needed for browser verification. Do not expose tokens in logs or reports.

If Chrome extension click automation fails, report the limitation instead of claiming a successful real-user interaction.

### Delivery

- Use the existing feature branch.
- Make meaningful local commits.
- Update documentation and AI_USAGE.md.
- Do not push or merge.
- Stop after 3A.2 and report actual results.

Prioritize completing the working fleet overview over optional styling refinements.
```

### Prompt 2 (verbatim, review of the AI's plan)

```text
The 3A.2 plan is approved with three final adjustments.

1. Do not render clickable boat links to `/boats/:id` while that route is unimplemented. Make the cards navigable in 3A.3 when the detail page is ready. No intentionally broken user journeys.

2. Ensure the debounced search input is not reset during normal typing. Synchronize its local state only when the URL search parameter actually changes externally. Avoid misleading stale results when changing the search term; `keepPreviousData` is primarily useful for pagination.

3. Keep browser verification pragmatic:
   - Development seed data must be clearly identified and avoid duplicate creation.
   - Test the 500/Retry scenario through automated tests rather than stopping the backend.
   - Prefer actual browser interactions; distinguish scripted interactions from real clicks in the report.

Everything else is approved.

Proceed directly with 3A.2 implementation, including the verified Nginx caching fix.

Do not start another planning cycle. Run all quality checks, verify the fleet in Chrome, make meaningful local commits, and stop for review before 3A.3. Do not push.
```

### Prompt 3 (verbatim, final approval)

```text
Approved. Proceed with implementation of 3A.2 now.

The Final adjustments section is authoritative. Ignore the obsolete instructions elsewhere in the plan about clickable boat cards, displaying previous search results for a different search term, or stopping the backend for retry testing.

Pay particular attention to behavioral tests for the debounced search:
- Normal typing must not unexpectedly reset the input.
- Pressing Enter must apply the search immediately.
- Clearing search must update the URL correctly.
- Changing search must reset pagination.
- Browser back/forward must keep the input and URL synchronized.
- No stale results from a different search should appear.

Ensure non-clickable cards do not visually suggest that they are interactive.

Keep the development data seeding idempotent, including after a partially completed previous run.

No further planning cycle is necessary. Implement, verify, commit locally, and report the results. Stop before 3A.3. Do not push.
```

### AI proposals the developer corrected

- **Card links to the unimplemented `/boats/:id`.** The AI's plan made each card a link that would show "Page not
  found" until 3A.3. Rejected: no intentionally broken journeys. Cards are plain articles with no hover, pointer
  or focus styling.
- **`keepPreviousData` for every query change.** The plan kept the previous results during a new search too,
  which shows stale results for a different term. Now only pagination keeps the previous data; a new search shows
  the loading state.
- **Stopping the backend to test Retry in the browser** was replaced by automated tests.
- **Again, the plan was patched instead of rewritten.** The developer had to state that the "Final adjustments"
  section overrides the rest.

### Decisions

- **nginx:**
  - `location /assets/` uses `try_files $uri =404` with `Cache-Control: public, max-age=31536000, immutable`.
  - `location /` adds `Cache-Control: no-cache`; the SPA fallback is unchanged.
  - The first version used `add_header … always`, which also put the one-year header on the **404** for a missing
    asset. A browser could then cache that failure for a year. Without `always`, the header is sent only on
    successful responses.
- **API client:** `apiGet(path, token, signal?)`. `ApiError` keeps the ProblemDetail `title` and `detail` when
  the error body is JSON. Empty 401 bodies and HTML error pages don't cause parse errors.
- **Query:** the key is `['boats', sub, 'list', { page, search }]`, enabled only with both a token and a subject.
  `placeholderData` returns the previous data only when the previous key has the same `search`.
- **Search input** (`BoatSearch`): local input state plus the last value sent. A URL change resets the input only
  when it differs from that value, so the URL echoing what was just typed never touches it. This uses the
  "adjust state during render" pattern; the debounce timer calls an effect event (`useEffectEvent`, React 19.2+).
  A 300 ms debounce, Enter applies immediately, and a new search drops `page` with `replace: true`.
  Pagination links push history.
- **401** shows "Your session has expired." with a user-initiated **Sign in again**. No retry and no redirect.
  The detail of a 400 is shown; network errors and 5xx get a generic message with **Retry**.
- **Lint fixes made in the code, without disabling rules:**
  - `FormEvent` is deprecated in @types/react 19.3, so `SubmitEvent` is used instead.
  - Effect events may only be called from effects, so the handlers use a plain function and only the timer goes
    through `useEffectEvent`.

### Problem found in the browser and fixed

On page load, the fleet stayed on **"Loading boats…"** indefinitely. Evidence collected in Chrome:
- The only `/api` request ended after 1 ms with status 0 and never reached nginx (the extension showed it as 503).
- The TanStack cache was **empty** while the page still showed the loading state.

Cause, in the 3A.1 identity-change effect:
1. oidc-client-ts restores the user from sessionStorage asynchronously, so `sub` goes from `undefined` to the user
   id.
2. The fleet query (a child effect) starts first.
3. Then `App`'s effect called `queryClient.clear()`, which removed the in-flight query, aborted the request and
   left the mounted observer stranded.

The unit tests missed this because the mocked user was present from the first render.

The fix: when the subject changes, `App.tsx` now calls `removeQueries` with a predicate that keeps keys whose
index 1 is the current subject. Logout still calls `clear()` before redirecting. A regression test renders with
`isLoading: true` and then signs in; it failed before the fix and passes after it. This corrects the 3A.1
decision "clear the whole cache on identity change".

### Verification performed

| Check | Result |
|---|---|
| `curl -sI` after rebuild | `/`, `/index.html`, `/boats` → 200 `no-cache`; existing `/assets/index-*.js` → 200 `max-age=31536000, immutable`; `/assets/missing.js` → **404** without the cache header; `If-None-Match` on `/` → 304; `/api/me` without token → 401 |
| Effect in the browser | after the rebuild, Chrome loaded the new bundle straight away (in 3A.1 it had served a cached old `index.html`) |
| `format:check`, `lint`, `typecheck`, `test`, `build` | all pass; **31 tests** in 4 files (BoatsPage 15, App 7, RequireAuth 5, client 4) |
| Mutation checks | resetting the input on every URL change fails "keeps a trailing space…" and "applies the search immediately on Enter"; always keeping the previous data fails "never shows results of a previous search"; the cache regression test fails with `clear()` |
| Dev data | 23 boats named `[dev] …` created through `POST /api/boats` from page JS with the session token (never printed). The script reads the existing `[dev]` names first and creates only the missing ones; a second run created 0. They remain in the local database for 3A.3. |
| Chrome, **real** input (trusted events confirmed by a capture-phase probe) | Next page ×2 (`?page=1`, `?page=2`, "Page 3 of 3", Next no longer a link); typing "harbour" from page 3 → one debounced request, `?search=harbour`, page dropped, 5 case-insensitive matches; select + type "zzz" + Enter → empty search state; **Clear search** → URL without `search`, input empty, 23 boats; typing "[dev]" then Next page; browser back → input "[dev]"; back again → `?page=1` and empty input; forward → "[dev]" restored; Tab order search → Clear → Next page with a visible 3 px teal focus ring |
| Chrome, empty fleet | before seeding, `/boats` showed "0 boats" and "Your fleet is empty." |
| Layout | desktop: 3-column grid, non-interactive cards; 390 px (same-origin iframe): single column, header and search stacked, no horizontal overflow, the long description clamped to 3 lines, "No description" for a null description |
| Console and network | no console messages; after the fix, every `/api/boats` request returned 200 |

In this session all Chrome interactions were real clicks and keystrokes. No scripted clicks were needed. Data
seeding and state inspection used page JS.

### Limitations

- The 500/Retry, 400 ProblemDetail and 401 states were verified by automated tests only, not in the browser.
- Mobile layout was checked in a 390 px iframe, not with device emulation.
- There are two ways to clear the field: the browser's built-in clear icon in `type="search"` and the Clear
  button. This is redundant but harmless.
- No axe checks yet (3A.3). CI has not run these commits (not pushed).

## Iteration 3A.3 — Boat details and accessibility (2026-10-14)

### Prompt 1 (verbatim, approval of 3A.2)

```text
Checkpoint 3A.2 is approved. Proceed with the previously prepared iteration 3A.3 — Boat Details & Accessibility.

One additional requirement based on the 3A.2 session-restoration regression:

Preserve the corrected authentication-aware TanStack Query cache handling. Do not reintroduce a global cache clear on session restoration. Ensure boat detail queries use the same user-specific query-key convention as fleet queries.

Before modifying cache management, inspect its current implementation and existing regression test.

Keep the iteration focused: detail page, navigable boat cards, back navigation preserving list context, errors, tests and accessibility verification.

Run all quality checks and verify the full list-to-detail-to-list journey in Google Chrome.

Stop and report before starting 3B. Do not push or merge automatically.
```

### Prompt 2 (verbatim, detailed 3A.3 specification, sent while the AI was already implementing)

```text
# Iteration 3A.3 — Boat Details & Accessibility

You are continuing The Boat App frontend implementation on the existing feature branch `vandoo/feat/frontend-boat-browsing`.

Iteration 3A.1 established authentication, React routing, TanStack Query, design tokens and the layout.

Iteration 3A.2 implements the fleet overview, search, pagination, API client improvements and Nginx caching fixes.

**Start only after 3A.2 has been completed and verified. Inspect the actual code and reuse what exists. Do not assume every part of the 3A.2 plan was implemented exactly as originally proposed.**

Your goal is to complete the read-only user journey:

**Fleet overview → Boat detail → Back to fleet.**

Keep this iteration small. Do not start another broad architecture redesign.

## 1. Functional scope

Implement the authenticated route:

`/boats/:id`

Use the existing backend endpoint:

`GET /api/boats/{id}`

Expected fields:
- `id`: UUID string
- `name`: string
- `description`: string or null
- `createdAt`: ISO date-time string

Display:
- Boat name as the page h1
- Description or an appropriate fallback
- Human-readable creation date using Intl.DateTimeFormat
- A clear "Back to fleet" navigation link

Use the existing Nautical Premium design system and shared layout.

Do not introduce placeholder business fields, fake images, new UI libraries or unnecessary abstractions.

## 2. Integrate with the fleet overview

Update boat cards to become accessible links to their detail pages.

Requirements:
- Use React Router Link.
- The boat name must provide a meaningful accessible link name.
- Make the interaction visually obvious.
- Support keyboard navigation and visible focus.
- Avoid nested interactive elements.
- Preserve search and pagination context when navigating to the detail page and back.

Prefer React Router location state for the list URL context, with a safe fallback to `/boats` for direct visits or refreshed detail pages.

If preserving the list context is simpler with query parameters, explain why and use the smallest practical solution.

Do not add global state just for back navigation.

## 3. TanStack Query integration

Reuse the existing API client, auth integration and query conventions established in 3A.2.

Add a typed fetchBoat(id) function and useBoat(id) query.

Requirements:
- Query key includes the authenticated user's `sub` and boat ID.
- Attach the current OIDC access token.
- Pass TanStack Query's AbortSignal to the API client.
- Fetch only when authentication and boat ID are available.
- Reuse existing retry policies.
- Do not duplicate server state in React component state.
- Do not refactor the fleet query or authentication implementation unnecessarily.

## 4. Loading, empty and error behavior

Handle these states clearly:

- Initial loading: accessible loading indication.
- Success: boat details.
- 404: "Boat not found" with a link back to the fleet.
- Invalid UUID: show an appropriate not-found or invalid-link state without a misleading generic server error.
- 401: show the existing session-expired experience without an automatic redirect loop.
- Network/5xx: show a generic error with a Retry action.

Use existing shared status/error components where practical.

Do not expose raw exception messages, tokens or internal technical details to users.

## 5. Accessibility

Target WCAG 2.2 AA where practical.

Verify:
- One meaningful h1 on the detail page.
- Semantic navigation and content structure.
- Keyboard-operable boat links and Back navigation.
- Visible focus states.
- Accessible loading and error feedback.
- Readable contrast and responsive layout.
- No unnecessary ARIA.

Add lightweight automated axe checks for:
- Fleet overview with data
- Fleet overview empty state
- Boat detail with data
- Boat detail error/404 state

Prefer a small reusable test helper based on axe-core if it is already installed or straightforward to add.

Do not claim full WCAG compliance from automated checks alone.

## 6. Focused tests

Add behavioral tests for:

1. Successful detail loading and rendering.
2. Missing description.
3. Loading state.
4. Backend 404 response.
5. Invalid boat ID.
6. 401 and network/server errors, including Retry where appropriate.
7. No API request without confirmed authentication.
8. User-specific query cache key.
9. Fleet card navigation to detail.
10. Back to fleet preserving search and pagination, with fallback for a direct visit.
11. Automated accessibility checks for representative states.

Keep tests colocated with the features they verify.

Prefer React Testing Library user interactions over implementation-specific assertions.

## 7. Verification

Run all existing quality gates:
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

Rebuild the frontend container and verify the complete browsing journey in Google Chrome:

1. Log in and open the fleet overview.
2. Apply a search and navigate to a non-default page when appropriate.
3. Open a boat detail from a card.
4. Verify the displayed fields against API data.
5. Return to the fleet and verify the previous search/page.
6. Open an invalid or nonexistent boat URL and verify the error state.
7. Refresh a valid detail page.
8. Verify the mobile layout at approximately 390 px.
9. Check console and network errors.

Prefer real browser clicks. Report scripted interactions separately if the browser extension cannot perform genuine user input.

Never print credentials, tokens or authorization codes.

## 8. Boundaries and delivery

- Stay on the existing feature branch.
- Do not change the backend or Keycloak configuration.
- Do not refactor working authentication.
- Do not implement creation, editing or deletion.
- Do not introduce a new state management library.
- Do not add extensive infrastructure solely for this iteration.
- Avoid modifying Nginx unless a verified regression from 3A.2 requires it.

Update frontend documentation, CLAUDE.md where relevant, and AI_USAGE.md with the actual implementation and verification.

Create meaningful local commits.

Do not push or merge automatically.

**First inspect the actual 3A.2 implementation and identify any blockers briefly. Then implement 3A.3 directly without another extensive Plan Mode cycle. Stop and report the results before starting 3B.**
```

### Inspection before changes

- No blockers. `useDropOtherUsersCache` in `App.tsx` removes only queries whose key index 1 isn't the current
  subject, and the "session restored after the first render" regression test is in place. Both were left
  unchanged. The detail key `['boats', sub, 'detail', id]` follows the same convention, so it is covered without
  touching cache management.
- `axe-core` 4.14.0 was already present as a transitive dependency and was pinned as a direct dev dependency.

### Decisions

- **List context as location state.** Cards pass `{ listSearch: location.search }`. "Back to fleet" accepts only
  a plain query string (it must match `^(\?[^#]*)?$`) and otherwise falls back to `/boats`. Query parameters on the
  detail URL were not needed. React Router keeps the state in the history entry, so it also survives a refresh
  (verified in Chrome).
- **`useBoat`/`fetchBoat`.** They reuse `apiGet`, the AbortSignal and the global retry policy (no retries for 4xx).
  The query runs only with a token and a subject. Ids that aren't UUIDs never reach the API and show "Boat not
  found". A backend 400 or 404 shows the same state; the backend's `detail` text is not displayed.
- **`LoadError`** was extracted from `BoatsPage` once the detail page needed it as a second use. It handles the
  session-expired state (no redirect) and generic errors with Retry.
- **Card pattern.** The boat name is the only link, stretched with `::after`. The card shows hover
  (border and shadow) and `:focus-within` with a 3 px teal ring; the link's own outline is suppressed in favour of
  the card ring. There are no nested interactive elements.
- **Accessibility additions:**
  - a page-specific `document.title` (`useDocumentTitle`)
  - focus moves to `<main>`, with a scroll to the top, when the pathname changes; search and pagination keep focus
  - the back link is a plain link: a `nav` landmark labelled "Breadcrumb" for a single link was dropped as
    unnecessary ARIA
  - the not-found state doesn't repeat the page's own "Back to fleet" link
- **axe helper** (`src/test/axe.ts`): runs axe-core on a container with the WCAG 2.0–2.2 A/AA tags, with
  `color-contrast` disabled because jsdom has no layout. Before relying on it, it was run on a throwaway fixture
  (an `<img>` without alt, an empty button, an unlabelled input) and reported violations; the fixture was deleted.

### Verification performed

| Check | Result |
|---|---|
| `format:check`, `lint`, `typecheck`, `test`, `build` | all pass; **44 tests** in 5 files (BoatDetailPage 12, BoatsPage 16, App 7, RequireAuth 5, client 4) |
| Mutation checks | a "Back to fleet" that ignores the location state, and removing the focus move, each fail the list → detail → back test |
| Chrome, **real** input (trusted events confirmed with a capture-phase probe) | typed "[dev]" + Enter, Next page → `?search=[dev]&page=1`; clicked the **description area** of the Halcyon card (not the title) → detail; Back to fleet → `search=[dev]`, `page=1`, "Page 2 of 3", input "[dev]"; Tab to the first card → 3 px teal ring around the card; Enter opens it |
| Fields against the API | in page JS with the session token (not printed): `h1` = `name`, description = `description`, `<time datetime>` = `createdAt`; shown as "October 14, 2026 at 11:41 AM" for `09:41:16Z` (local time, CEST) |
| Focus and titles | after each client-side navigation `document.activeElement` was `MAIN`; titles "Fleet overview – The Boat App", "[dev] Halcyon – The Boat App", "Boat not found – The Boat App" |
| Refresh of a detail page | **scripted** `location.reload()`: session restored, boat shown, "Back to fleet" still carries `search=[dev]&page=1` |
| Not found | `/boats/00000000-0000-0000-0000-000000000000` → API 404 → "Boat not found"; `/boats/not-a-uuid` → "Boat not found" with **0** API requests; both "Back to fleet" → `/boats` (opened by URL, not clicks) |
| Contrast in Chrome | computed WCAG ratios for every visible text element: fleet 51 elements, lowest 5.47:1; detail 11 elements, lowest 5.14:1; no failures |
| Layout | 390 px same-origin iframe: detail without horizontal overflow, the long description wraps; the fleet was already checked in 3A.2 |
| Console and network | no console messages. The only non-200 API response was the expected 404. Duplicate detail requests came from the cross-check fetch, the reload and the iframe. One `pending` entry was a request cut off by navigation. |

### Problem found in the browser and fixed

- "←Back to fleet" was missing the space after the arrow: `inline-flex` drops trailing whitespace inside the
  `aria-hidden` arrow span. A flex `gap` now provides it (separate commit). The accessible name stays
  "Back to fleet".

### Limitations

- The 401, network/5xx and Retry states on the detail page were verified by automated tests only.
- Login itself was not repeated in this session. The existing session was restored, and full login was verified
  in 3A.1.
- No screen reader pass. Automated axe checks plus manual keyboard and contrast checks don't establish WCAG
  conformance.
- After "Back to fleet", focus goes to `<main>`, not to the card that was opened.
- CI has not run these commits (not pushed).

## CI — split into path-filtered backend and frontend workflows (2026-10-14)

### Prompt 1 (verbatim, review request)

```text
Review and optimize our existing GitHub Actions CI to avoid running unrelated checks.

We have a monorepo with `backend/`, `frontend/`, Docker Compose and shared configuration files.

**Goal:** Backend checks should run only when backend-related files change, and frontend checks only when frontend-related files change.

Requirements:

1. Inspect the existing `.github/workflows/` files before proposing changes. Preserve the current quality gates (formatting, lint, tests, builds, Docker checks).
2. Use a reliable path-based change detection strategy compatible with pull requests and pushes.
3. Run backend checks when `backend/**` or relevant shared/backend build configuration changes.
4. Run frontend checks when `frontend/**` or relevant shared/frontend build configuration changes.
5. If both areas change, run both sets of checks.
6. If only documentation changes, avoid unnecessary builds and tests.
7. Handle workflow configuration changes and relevant shared files conservatively, so important checks aren't accidentally skipped.
8. Preserve reliable branch protection: required checks must not remain permanently Pending when a job is skipped.
9. Keep least-privilege GitHub Actions permissions and existing caching where appropriate.
10. Do not weaken or remove any existing test or build commands.

Prefer a simple solution using one lightweight change-detection job and conditional backend/frontend jobs. Avoid unnecessary third-party Actions and complexity.

Include a small verification matrix covering:
- Backend-only changes
- Frontend-only changes
- Changes to both
- Documentation-only changes
- CI workflow changes
- Docker Compose or shared configuration changes

First explain the proposed approach and identify any branch-protection implications. Do not modify files until the plan is approved.
```

### Prompt 2 (verbatim, approval of the first approach)

```text
I approve the proposed path-based CI optimization with two requirements.

1. Make `CI result` the intended single required branch-protection check.

The final gate must always run and must:
- Fail if change detection fails or is cancelled.
- Fail if a required backend, frontend or Docker check fails or is cancelled.
- Fail if a component was marked as changed but its corresponding check was unexpectedly skipped.
- Accept skipped checks only for components that do not require validation.
- Pass for documentation-only changes when all relevant jobs were legitimately skipped.

Do not update GitHub branch protection automatically. I will configure the required check after verifying the workflow on GitHub.

2. Verify Git diff correctness.

- For pull requests, compare against the merge-base of the base branch.
- For pushes, compare the event's before and after commits.
- Handle missing history, new branches and unusual Git states conservatively by running all checks.
- Detect both old and new paths for renamed files.

I approve running all checks for shared configuration, Docker Compose, Keycloak and workflow changes.

Preserve all existing build/test commands and caching.

Implement the change, run local classification tests and validate the workflow syntax if a compatible validator is available.

Update CLAUDE.md and AI_USAGE.md, commit locally, and stop.

Do not push or merge automatically.
```

### Prompt 3 (verbatim, change of direction)

```text
Stop the current Bash-based CI change detection implementation.

I want a simpler, declarative GitHub Actions solution, similar to the approach used in my previous projects.

Instead of a custom Git diff classifier and a complex CI result gate, use native GitHub Actions `paths` filters.

Target architecture:
- `.github/workflows/backend.yml`
- `.github/workflows/frontend.yml`

Requirements:

1. Split the existing CI into two independent workflows.
2. Use native `push.paths` and `pull_request.paths` filtering to trigger only relevant workflows.
3. Include each workflow's own YAML file and relevant shared configuration files in its paths.
4. Preserve the existing backend and frontend quality gates, caching and Docker image builds.
5. Keep `workflow_dispatch` for manual full execution.
6. Keep permissions minimal.
7. Use explicit paths instead of Bash scripts, custom change classifiers or third-party change detection actions.
8. Avoid reusable workflows for now; there is not enough duplication to justify them.
9. Consider documentation exclusions carefully. In particular, frontend/README.md must still trigger frontend checks if it is covered by Prettier.
10. Document the GitHub branch-protection limitation: path-filtered workflows can leave required checks Pending if skipped.

Before implementation, explain the precise implications for our existing main branch protection. Do not modify branch protection automatically.

Remove any uncommitted code from the previous Bash-based approach only after inspecting the diff. Preserve unrelated changes.

Then implement, validate the workflows, update documentation and commit locally. Do not push or merge automatically.
```

### Prompt 4 (verbatim, approval and history cleanup)

```text
The declarative CI implementation is approved.

Before pushing, please make two final adjustments:

1. Clean up the local Git history safely. Since none of these commits have been pushed, remove the experimental Bash-based commit and its revert from the branch history, keeping only the final declarative workflow implementation and documentation. Preserve any existing unrelated commits. Do not force-push or change main. Keep the AI_USAGE.md explanation of why the initial approach was abandoned.

2. Verify that both workflows still have their original quality gates and Docker image builds, and that actionlint passes.

Do not add custom Bash change-detection scripts or placeholder workflows.

Keep the current path filters. We may add a separate lightweight Docker Compose configuration check during final hardening.

Do not modify GitHub branch protection.

Stop and report the cleaned commit history and verification results. Do not push automatically.
```

### What happened

1. **First approach, implemented and then abandoned.** One `Detect changes` job ran a Bash classifier: merge-base
   diff for PRs, before..after for pushes, `--no-renames`, and "run everything" when anything was uncertain. The
   backend, frontend and Docker jobs ran conditionally, and an always-running `CI result` gate made skipped jobs
   safe for branch protection. It had 38 local script tests (macOS bash 3.2 and Linux bash 5.2), two mutation
   checks, and clean `actionlint`/`shellcheck` runs. It was committed locally and never pushed.
2. **The developer rejected it as too complex** for the project: three scripts, a gate job and a test harness to
   save CI minutes. They asked for the declarative approach used in their earlier projects instead. The AI had
   proposed the scripted design in response to Prompt 1's requirement 8 (no permanently Pending required checks),
   which native path filters can't meet. Prompt 3 accepts that trade-off explicitly and documents it.
3. **No uncommitted work existed:** the working tree was clean, and the Bash commit was the only one on the
   branch. It was first undone with `git revert`. Before pushing, the developer asked for a clean history. None of
   the commits had been pushed, so the experimental commit and its revert were squashed away (`git reset --soft
   main` plus one new commit, with a local backup branch kept). The branch now holds only the declarative
   implementation. This log is the record of the abandoned approach.

### Decisions

- **Two workflows**, `backend.yml` and `frontend.yml`, each triggered on `push` to `main` and `pull_request`
  with identical `paths` lists, plus `workflow_dispatch`. YAML anchors were avoided: GitHub's support for them
  is recent, and explicit lists were requested.
  - **backend:** `backend/**`, `!backend/**.md` (Spotless formats Java only), and `.github/workflows/backend.yml`.
  - **frontend:** `frontend/**` (no Markdown exclusion: `prettier --check .` checks `frontend/README.md`),
    `.editorconfig` (Prettier reads it), and `.github/workflows/frontend.yml`.
  - `docker-compose.yml`, `keycloak/`, `.env.example` and root docs trigger neither workflow: no CI command reads
    them, so running unrelated checks would validate nothing.
- **Unchanged:** all build and test commands, `contents: read` permissions, Maven, npm and Docker layer caching
  (the cache scopes are still `backend`/`frontend`, so existing caches stay valid), and the job and check names.
  The Docker jobs are named "Docker images (backend)" and "Docker images (frontend)", exactly like the former
  matrix legs.
- **Concurrency** is now per workflow (`${{ github.workflow }}-${{ github.ref }}`), so a backend run doesn't cancel
  a frontend run.
- **Branch protection (not changed by the AI; `gh` is not installed, so the current settings are unknown):** a
  path-skipped workflow reports no checks. A required check from it would stay "Expected — Waiting for status to
  be reported", and a docs-only PR would block on every required check. The options were explained to the
  developer: don't require these checks; require them and bypass for unrelated PRs; or add placeholder workflows
  with the same job names (not implemented).

### Verification performed (local)

| Check | Result |
|---|---|
| `actionlint` 1.7.7 (local image) | 0 errors in `backend.yml` and `frontend.yml` |
| Commands and caching against the old `ci.yml` | every `run`, `uses`, setup and cache line is still present; the only difference is matrix values written out (same cache scopes) |
| `push` paths equal `pull_request` paths | yes, for both workflows (checked by script) |
| Path matrix: a **local emulation** of GitHub's documented filter rules (`*` does not cross `/`, `**` does, `!` excludes, last match wins), reading the patterns from the YAML | backend only → Backend; frontend only, `frontend/README.md`, `nginx.conf`/Dockerfile → Frontend; both → both; root docs or `backend/README.md` only → neither; `backend.yml` → Backend; `frontend.yml` → Frontend; `.editorconfig` → Frontend; Compose, Keycloak, `.env.example` → neither |

### Not yet verified

- Real GitHub behavior. The emulation is not GitHub's matcher. After pushing, check a docs-only PR (no workflow
  runs), a frontend-only PR (only Frontend), and a PR changing `backend/README.md` (no Backend).
- CI has not run these commits (not pushed).

## Iteration 3B.1 — Create and edit boats (2026-10-14)

### Prompt 1 (verbatim, sent in plan mode)

```text
Prepare iteration 3B.1 — Create and Edit Boats.

First inspect the completed frontend and backend API contracts. Reuse the established authentication, TanStack Query, API client, routing, CSS Modules, design tokens and test conventions.

Scope:
- POST /api/boats
- PUT /api/boats/{id}
- /boats/new and /boats/:id/edit
- Shared, accessible BoatForm component
- Name required, max 150 characters
- Description optional, max 2000 characters
- Client validation consistent with backend constraints
- Server-side validation errors displayed near relevant fields
- Loading, submitting, success, 400, 401, 404 and network error handling
- TanStack Query mutations with correct cache invalidation
- Create button on fleet overview and Edit action on boat detail
- Keyboard accessibility and responsive design
- Focused Vitest/RTL tests and real Chrome verification

Keep the implementation lightweight:
- No new form library unless the existing code demonstrates a concrete need.
- No optimistic updates.
- No backend or Keycloak changes.
- Do not implement deletion yet; that belongs to 3B.2.

First present a concise implementation plan with any actual risks or questions. Do not modify files until the plan is approved.

Keep documentation and AI_USAGE.md updated, use meaningful local commits and do not push automatically.
```

### Prompt 2 (verbatim, review of the AI's plan)

```text
Iteration 3B.1 is approved with four small adjustments.

1. Preserve description values consistently with the backend:
   - An exactly empty description may be sent as null.
   - Otherwise, preserve the user's description as entered, including whitespace and line breaks.
   - Do not silently normalize whitespace-only descriptions to null.

2. Prevent ambiguous edits during submission:
   - Disable the form fields and submit button while a mutation is pending.
   - Prevent duplicate submission.
   - Preserve entered values if submission fails.

3. Handle server-side field errors robustly:
   - Map recognized ProblemDetail field errors to their corresponding form fields.
   - Display unknown or malformed field errors at form level.
   - Always show an understandable fallback message for 400 responses without usable field errors.
   - Maintain accessible error associations and focus behavior.

4. Preserve navigation context safely:
   - Create and Edit should navigate to the saved boat's detail page on success.
   - Cancel and Back links should work even when the form was opened directly by URL.
   - Avoid introducing unnecessary global navigation state.

Everything else is approved.

Proceed with 3B.1 implementation. Use the existing architecture, keep tests colocated, run all quality checks and verify create/edit flows in Google Chrome.

Do not implement deletion yet.

Stop and report before 3B.2. Do not push automatically.
```

### Prompt 3 (verbatim, after the AI patched the plan instead of reconciling it)

```text
The 3B.1 implementation plan is approved.

The "Approved adjustments" section is authoritative. Ignore conflicting older instructions later in the document, especially:

- Whitespace-only descriptions must be preserved exactly as entered, not converted to null.
- Form fields must be disabled while a mutation is pending, not left editable.

Ensure validation is consistent with the value actually submitted to the backend, particularly name trimming and length limits.

Proceed directly with implementation. Do not start another planning cycle.

Keep the existing architecture, run all quality checks, verify create/edit and validation flows in Chrome, commit locally, and stop before 3B.2.

Do not push or merge automatically.
```

### AI proposals the developer corrected

- **Normalizing a whitespace-only description to `null`.** Rejected: the backend stores descriptions as sent,
  so only `''` becomes `null`.
- **Leaving fields editable while saving.** Rejected: fields and submit are disabled to avoid ambiguous edits.
- **Again, the plan was patched instead of rewritten**, which left contradictions. The AI then reconciled the plan
  file before implementation.

### Decisions

- **Branch:** `vandoo/feat/boat-create-edit` already existed (created by the developer) and pointed exactly at
  `origin/main` after the CI split was merged (PR #6). It was verified and reused.
- **API layer:**
  - `apiSend('POST' | 'PUT')` shares one `request` function with `apiGet`. Lint (`no-misused-spread`) caught that
    spreading `HeadersInit` would lose array or `Headers` values, so headers are now built with `new Headers()`.
  - `ApiError.fieldErrors` keeps only well-formed `{ field, message }` entries.
  - `useCreateBoat`/`useUpdateBoat` set the server response under the user-scoped detail key and invalidate the
    user's list queries.
- **`boatInput.ts`** is the single source of truth for both the body and its validation:
  - The name is trimmed and `''` becomes `null`.
  - Validation runs on the body that will actually be sent: the trimmed name length and the raw description
    length, counted in UTF-16 code units like `@Size`.
  - It mirrors the backend's NUL rule.
  - There is no `maxLength` attribute, because it would silently cut off pasted text.
- **`BoatForm`:**
  - `noValidate`; hints and counters; `aria-invalid` and `aria-describedby` to the inline error.
  - Focus moves to the first invalid field. Server errors move focus through an effect event (`useEffectEvent`)
    that fires only for a new error; an earlier draft used a lint suppression, which was replaced.
  - Controls are disabled per element (an earlier draft wrapped them in a legend-less `<fieldset>`).
  - Server errors:
    - fields it doesn't know about are listed in the form-level alert
    - a 400 without usable field errors gets the fallback message plus the ProblemDetail `detail`
    - 401 shows "Sign in again" with no automatic redirect
    - 404 explains the boat is gone
    - network errors and 5xx get a generic retry message
- **Pages:**
  - `/boats/new`; `/boats/:id/edit`, which mounts the form only once the boat has loaded (no syncing props into
    state); not-found states with a "Back to fleet" link.
  - Saving navigates to the detail page with `replace` and a notice. `Layout` now focuses an element marked
    `data-focus-on-navigate` when there is one, so the confirmation is read out first.
- **`navigation.ts`** replaces the private helper in the detail page and the `BoatLinkState` type, so all pages
  validate location state the same way. There is no global state.
- Shared `.button-link` / `.button-link.secondary` classes for links styled as buttons, plus a disabled button
  style.

### Problems found and fixed

- **Test client didn't match the app's.** Page tests first used `new QueryClient()` with `staleTime: 0`, so the
  detail page refetched after a save and the tests' handlers served stale data. That showed up as old values and
  "Invalid time value". The app uses 30 s (`createQueryClient`), and a throwaway debug test confirmed the cause.
  `src/test/boatRoutes.tsx` now builds on `createQueryClient()` with retries off.
- **Search summary grammar.** Chrome showed "1 boat match "3B.1"". Fixed to "1 boat matches", with a test, in a
  separate commit.

### Verification performed

| Check | Result |
|---|---|
| `format:check`, `lint`, `typecheck`, `test`, `build` | all pass; **81 tests** in 12 files (BoatForm 13, NewBoatPage 7, EditBoatPage 6, boatInput 7, client 6, …) |
| Mutation checks | removing the pending guard fails 2 tests; turning a whitespace-only description into `null` fails 3; removing list invalidation fails 2 |
| Chrome, empty submit (**real** click; capture-phase probe confirmed trusted events) | "Enter a name." inline, `aria-invalid="true"`, `aria-describedby` = hint, counter, error; focus on Name; no request |
| Chrome, too long (**real** typing, 153 characters + Enter) | "Name must be 150 characters or fewer.", counter "153 / 150", focus on Name, no request |
| Chrome, keyboard-only create (select, type, Tab, type, Tab, Enter) | POST 201 → `/boats/<id>`, focused "Boat added.", `h1` and title set; the API stores the name trimmed and the description as typed; no extra GET by the app |
| Fleet after create | "24 boats", the new boat first (list invalidated) |
| Search "3B.1" → card → Edit → **Cancel** | back on the detail page with no notice; "Back to fleet" still carries `?search=3B.1` |
| Edit (real typing incl. Enter in the textarea for a line break, real click on Save) | PUT 200 → "Changes saved." (focused); the API description is exactly `"Renamed in the 3B.1 edit check.\nSecond line.  "`, and the page shows the same |
| Back to fleet | `?search=3B.1` restored, renamed boat with its new description, the list refetched after the PUT |
| 390 px (same-origin iframe, **scripted** empty submit) | no horizontal overflow, readable error state |
| Contrast on the form with an error | 15 text elements, lowest 6.57:1 (the error text), no failures |
| Console and network | no console messages; POST 201, PUT 200, all GETs 200 |

### Data

- Created `[dev] 3B.1 Sea Otter`, since renamed to `[dev] 3B.1 Sea Otter II`. It stays in the local database
  with the other `[dev]` boats; deletion is 3B.2.

### Limitations

- Server-side 400 field mapping, 401, 404 on save and network errors are verified by automated tests only. The
  client mirrors the server rules, so the UI can't produce these 400s.
- A 401 while editing loses unsaved input (sign-in is a full-page redirect); the message warns about it.
- The notice is stored in history state, so it reappears if the detail page is reloaded right after saving.
- There's no "unsaved changes" prompt when leaving the form. CI has not run these commits (not pushed).

## Iteration 3B.2 — Delete boats (2026-10-14)

### Prompt (verbatim)

```text
Proceed with iteration 3B.2 — Delete Boats.

Checkpoint 3B.1 is approved: create and edit work end to end, 81 tests pass, and the current architecture should be preserved.

### Goal

Complete the final mandatory CRUD operation using `DELETE /api/boats/{id}`.

### Requirements

- Add a clearly identifiable "Delete boat" action on the boat detail page.
- Require explicit confirmation before deletion, including the boat name.
- Keep the confirmation keyboard-accessible and understandable for screen readers. Prefer the simplest reliable approach; a native confirmation dialog is acceptable for this challenge.
- Cancel must perform no API request.
- Use the existing authenticated API client and TanStack Query mutation conventions.
- Prevent duplicate deletion requests.
- Show a clear pending state.
- On success, remove or invalidate the deleted boat's detail query and invalidate the current user's fleet lists.
- Navigate back to `/boats`, preserving the previous search context where practical, with a success notice.
- Handle 401 without automatic redirect, 404 when the boat was already deleted, and network/5xx errors with a safe retry path.
- Do not accidentally remove data from another user's query cache.

### Tests

Add focused tests for:
- Cancel confirmation → no DELETE request.
- Confirm → correct authenticated DELETE request.
- Success → navigation and cache updates.
- 401, 404 and server/network errors.
- Duplicate-submit prevention.
- Keyboard accessibility where practical.

Run format, lint, typecheck, tests and production build.

### Browser verification

Using Google Chrome:
1. Create a clearly identified `[dev]` boat.
2. Open its detail page.
3. Cancel deletion and verify the boat still exists.
4. Confirm deletion and verify the boat disappears from the fleet.
5. Verify the deleted boat URL shows "Boat not found".
6. Check console/network errors and responsive behavior.

Only delete clearly identified development data created for this test. Do not delete other existing boats.

### Boundaries

- No backend or Keycloak changes.
- No new UI framework or unnecessary abstraction.
- Preserve the existing create/edit functionality.
- Keep documentation and AI_USAGE.md updated.
- Make meaningful local commits.
- Stop and report after 3B.2.
- Do not push or merge automatically.

Implement directly after inspecting the existing code. No extensive planning cycle is necessary.
```

### Decisions

- **Branch:** 3B.1 was not merged yet, so `vandoo/feat/boat-delete` is stacked on `vandoo/feat/boat-create-edit`.
- **Inline confirmation instead of `window.confirm()`.** The prompt allowed a native dialog, but `confirm()`
  blocks the page, and with it the Chrome automation used for verification. jsdom can't test it, and it doesn't
  implement `<dialog>.showModal()` either. The inline panel:
  - is a `role="group"` labelled "Delete “<name>”?" and described by "This permanently removes the boat. It
    cannot be undone."
  - gets focus when it opens; Cancel and Escape close it without a request and return focus to "Delete boat"
  - catches Escape with a native listener on the panel, not a JSX key handler. jsx-a11y flags key handlers on
    non-interactive elements, and the AI's first draft suppressed that rule; the listener replaced the
    suppression.
- **`useDeleteBoat(id)`:**
  - `apiDelete` accepts the empty 204.
  - On success it removes only `['boats', sub, 'detail', id]` (`exact: true`) and invalidates
    `['boats', sub, 'list']`.
  - A 404 also invalidates the lists, since the boat was deleted elsewhere.
  - The caller navigates with `replace` to `/boats<listSearch>` with `{ notice: 'deleted', deletedName }`. The
    fleet shows a focused status message, "“<name>” was deleted.".
- **Pending and errors:**
  - Both buttons are disabled with "Deleting…", and `isPending` also guards the handlers.
  - 401 offers "Sign in again" without redirecting; 404 says "already deleted" and links to the fleet.
  - Network errors and 5xx keep the confirmation open with a generic message for retrying.

### Correction during implementation

- A test asserted that the user's cached list was *invalidated* after deleting. It failed because the app
  navigates to the fleet, which immediately refetches that list and resets the flag. The test now asserts the
  observable effect instead: the list is fetched again after the DELETE and holds the server's new, empty result.
  The 404 test still checks the invalidation, because there the user stays on the page.

### Verification performed

| Check | Result |
|---|---|
| `format:check`, `lint`, `typecheck`, `test`, `build` | all pass; **92 tests** in 13 files (DeleteBoat 9, client 8, …) |
| Mutation checks | without the pending guard, the single-request test fails; with cache removal widened to `['boats']`, the "other user's cache" test fails; with Cancel deleting, both cancel tests (click and Escape) fail |
| Data before the test | 25 boats, including one boat not named `[dev]` ("Test"). It was left untouched and still exists. |
| 1–2. Create `[dev] 3B.2 Delete me` (**real** typing + Enter) and open it | 201, "Boat added.", red "Delete boat" in a separate section |
| 3. Delete boat → Cancel (**real** clicks) | the panel got focus, with label "Delete “[dev] 3B.2 Delete me”?" and the description; after Cancel, focus was on "Delete boat"; no DELETE was sent; the boat still returned 200 |
| 4. Keyboard only: Enter opens → Escape closes → Enter → Tab → Enter on "Delete permanently" (**real** keys) | Escape closed with no request; the confirm sent **one** DELETE, which nginx logged as **204** (the extension's network log showed 503, the same capture glitch seen in 3A, contradicted by the nginx log and the result); landed on `/boats` with the focused "“[dev] 3B.2 Delete me” was deleted."; the boat is gone from the list and the API |
| 5. Deleted boat URL | "Boat not found", title "Boat not found – The Boat App", no delete button |
| 6. 390 px (probe iframe on `[dev] 3B.1 Sea Otter II`, **scripted** open and Cancel, nothing deleted) | no horizontal overflow, the panel wraps cleanly; contrast at least 5.14:1 with no failures |
| Console and network | no console messages; the only non-200 is the expected 404 for the deleted boat |

### Limitations

- 401, 404 and network/5xx during deletion are verified by automated tests only.
- The panel is inline, not modal. Focus is moved into it but not trapped, which is acceptable because it doesn't
  cover any content.
- If the deleted boat was the only item on the last fleet page, the user returns to a page past the end. The
  fleet then shows its existing "This page does not exist" state with a link to the first page.
- CI has not run these commits (not pushed).
