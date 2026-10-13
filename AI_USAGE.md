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
