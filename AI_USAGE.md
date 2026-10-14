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
