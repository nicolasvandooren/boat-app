# AI Usage — Engineering Methodology, Quality Gates and Human Verification

## 1. Tools, roles and accountability

I used **Claude Code (Claude Opus 5.5)** as the main coding agent for implementation, test creation, documentation, browser-assisted investigations and read-only reviews. I also used **ChatGPT** as a separate sounding board to challenge architecture proposals, examine trade-offs, refine instructions to the coding agent and critique release readiness. ChatGPT did not serve as an independent human reviewer, nor was its advice treated as a substitute for testing.

**I retained responsibility for the architecture, scope, acceptance criteria, risk decisions, approvals and final delivery.** Much of the code was AI-generated, and many automated and browser checks were run by Claude. I do not claim to have typed every implementation or reviewed every generated line. My role was to establish constraints, review proposed approaches, demand evidence, challenge unexpected behavior and personally exercise critical paths in the deployed application.

This distinction matters: **producing code quickly is not the same as demonstrating that it is correct**. I used quality gates and a staged delivery process to make generated changes inspectable, testable and reversible.

## 2. Development methodology: scope → plan → approval → verification → integration

For substantive features I worked in **Plan Mode**: define a bounded objective, ask the agent to inspect existing code and propose a plan, review and sometimes reject the plan, authorize implementation, request executable verification, then examine the result before integration. The project was divided into small slices: infrastructure/authentication, persistence, CRUD API, paginated search, frontend browsing, and create/edit/delete. Each slice had a stopping point; Claude was not free to continue to the next iteration automatically.

I used `CLAUDE.md` as a shared engineering contract covering architecture, code conventions, verification and implementation boundaries. In one iteration, Claude began modifying files during what should have been a planning phase. I stopped it, reviewed the uncommitted diff rather than discarding work blindly, and added an explicit rule prohibiting edits in planning phases without authorization. Other plans needed multiple rounds of correction when proposed abstractions were excessive or revisions contradicted earlier decisions.

**Plan Mode was the default for decisions with architectural or behavioral impact, not a universal ritual.** For small, localized changes such as mobile pagination layout, I used direct, narrowly scoped instructions with browser verification. The level of process followed the risk of the change.

### Quality gates from the first iteration

I requested GitHub Actions **during project scaffolding, before boat CRUD existed**. This was intentional: formatting, static checks, tests and repeatable builds should constrain implementation from the beginning, rather than being added only after functionality appears complete. The intended gates covered Java/Spotless and Maven verification, frontend Prettier, ESLint, TypeScript, Vitest and production build, plus Docker image builds.

**The workflows evolved.** Early CI configuration and local checks preceded the first successful runs on GitHub. I later rejected a custom Bash-based diff classifier and a combined result gate in favor of two declarative workflows (`backend.yml` and `frontend.yml`) using native GitHub Actions path filters. This choice balanced **maintainability, feedback speed, and CI cost**: rebuilding and retesting both applications and their Docker images for every small, unrelated change would consume unnecessary runner minutes and compute resources. Path-based triggers run relevant checks for affected components without removing the quality gates that apply to them. No quantified cost saving was measured. The trade-off is that shared infrastructure changes can require separate integration verification, and a path-filtered required check can remain pending if no matching workflow runs. A documentation-only commit with no triggered checks must therefore be distinguished from an untested application change, not automatically labeled a CI failure.

### Pull requests as integration checkpoints

I worked in feature branches and pull requests even though this was largely an individual exercise. **Each PR was an integration boundary**: a contained diff, a place to inspect consequences, a visible test/CI result, and an explicit decision to merge. This makes the history easier to understand and would support a normal peer-review workflow. **No independent human peer reviewer is claimed** for this challenge; agent reviews and my own decisions are not equivalent to another engineer's approval.

## 3. Examples of human judgment changing the output

| AI proposal or situation | My intervention | Engineering reason |
|---|---|---|
| Spring Boot 4.0.x proposed at scaffolding | Selected Spring Boot 3.5.x | Reduce short-term integration risk; the older line has a future upgrade cost |
| Testcontainers and an empty Flyway migration proposed before persistence existed | Postponed Testcontainers until persistence; rejected the empty migration | Tests and schema migrations should exercise real behavior |
| Backend authorization and JWT verification | Required deny-by-default security and verification of actual `iss`/`aud` claims | Frontend route protection and discovery metadata are not backend security guarantees |
| Frontend plan proposed router migration, deep-link handling and additional layers | Preserved the working OIDC callback and `BrowserRouter`; simplified the file structure | Avoid risky refactoring of already verified authentication behavior |
| CI optimization introduced a Bash change classifier | Stopped it and requested native path-filtered GitHub Actions workflows | Prefer a simpler, reviewable declarative solution |
| Agent modified files while supposedly planning | Interrupted, reviewed the diff and tightened `CLAUDE.md` | Plan approval must precede implementation |
| Release hardening identified multiple possible improvements | Approved the three targeted P2 fixes; deferred P3 items | Prioritize reproduced defects and material risks near delivery |
| Mobile audit initially reported no overflow | Reproduced horizontal scrolling myself with long unbroken search text | An agent's passing audit is not conclusive; its verification technique had missed overflowing text inside correctly sized boxes |

The mobile issue illustrates a methodological correction, not just a CSS change. The initial audit checked element bounding rectangles, which could appear within the viewport even as the text inside overflowed. After my reproduction, Claude extended the check to overflowing content; disabling the new CSS rule brought the problem back. I chose the smallest scoped fix rather than a global `overflow-x: hidden` that could mask other defects.

## 4. Validation strategy: evidence at multiple layers

### Automated and integration verification

At final release acceptance, the reported results were **95 passing frontend tests** and **56 passing backend tests**, with successful frontend format/lint/typecheck/build and backend Spotless/Maven verification. Backend tests included real PostgreSQL via Testcontainers, MVC/controller and service behavior, as well as security-related cases. GitHub Actions and Docker builds were checked independently of development-time test output.

I did not use test counts as the only measure of confidence. For selected high-risk regressions we verified that tests **failed against an intentionally broken or pre-fix behavior**:

- The validation-error test rejected exposure of submitted values. A temporary information disclosure was introduced to confirm the test failed, then reverted.
- During release hardening, the tests protecting unsaved form input failed with the old refetch/error ordering and passed once cached data remained mounted during background failures.
- For mobile text overflow, disabling the targeted style reproduced horizontal scrolling, demonstrating that the browser check was sensitive to the defect.

These are focused *test sensitivity checks*, not a claim that a comprehensive mutation-testing campaign was run.

The agent also exercised the real **Nginx → Spring Boot → PostgreSQL** path, Flyway migrations, Auth Code + PKCE with Keycloak, HTTP response/error contracts and browser create/edit/delete flows. The final read-only release acceptance reported no blockers. It explicitly marked **navigation between two populated pages in the UI** and **resizing the actual browser window** as **NOT VERIFIED in that acceptance session**. Pagination behavior was covered by separate automated tests, and the **mobile pagination layout was subsequently adjusted and verified separately** in Chromium mobile emulation. These are different scopes of verification; the mobile layout check must not be described as proof of a multi-page navigation test.

### My own manual checks

I separately tested the running project rather than relying only on Claude's summaries:

| Area | What I checked myself | Observation |
|---|---|---|
| Fresh installation | Cloned the repository into a new directory; executed `docker-compose up` | Stack started and the application was usable without extra manual setup |
| User journey | Logged in through Keycloak and exercised boat CRUD and navigation in the browser | Core flow worked in the running application |
| API protection | Called boat list/detail and write endpoints without a Bearer token, and the list with an invalid token | Expected `401` responses |
| Server-side validation | Submitted an overlong boat name through the API | Expected `400` validation response |
| Authenticated API | Queried the API with a valid Keycloak access token | Authorized requests succeeded |
| OIDC configuration | Inspected Keycloak's `boat-frontend` client in the administration console | Public client, Standard Flow, PKCE S256 required; implicit and direct grants disabled; explicit localhost web origins |
| Access-token claims | Inspected a real decoded access token | Expected issuer, `aud=boat-api`, `azp=boat-frontend`, and five-minute lifetime |
| Browser session | Inspected browser storage while signed in and after logout | OIDC entry existed in `sessionStorage` while authenticated and was removed at logout; no API token found in `localStorage` or application cookies during inspection |
| Logout/navigation | Checked signing out, back navigation and returning to protected routes | Consistent redirect and sign-out behavior |
| UX | Used the application in Chrome mobile emulation and entered an unusually long unbroken search term | Exposed horizontal overflow missed by the initial AI audit; it was subsequently fixed and rechecked |

**Interpretation matters.** Inspecting JWT claims does not prove a cryptographic signature is valid; the backend's configured JWT decoder and separate negative/runtime checks address signature validation. The browser's protected routes are also not the authorization boundary: Spring Security's API responses are. Keycloak can use its own SSO cookies even when the SPA does not store an API token in application cookies.

### Security boundaries and local-only deployment

This was a **local development demonstration**, not a production security certification. Docker ports are bound to `127.0.0.1`; Keycloak uses a development configuration and documented local demo/admin credentials; browser-to-Keycloak communication uses local HTTP. Authenticated users share the fleet and can perform CRUD on every boat: no per-user ownership or role-based authorization was requested or implemented. The JWT audience and issuer were verified, but no comprehensive penetration test was performed. The remaining limitations are documented rather than silently represented as production-ready defaults.

### UX and accessibility boundaries

Browser-assisted checks covered mobile emulation at 375, 430 and 768 pixels, long strings, CRUD and keyboard interactions. CSS corrections were local and retested after rebuilding the frontend. A 16px search-input font addresses the known iOS Safari zoom threshold, **but the behavior was not reproduced on a physical iPhone**. Automated accessibility checks and keyboard observations do not establish full WCAG AA compliance; real screen-reader and physical-device testing were not completed.

## 5. Responsibilities I did not delegate, and limits of AI review

I retained the final say over architecture, scope, security requirements, acceptance criteria, approvals, trade-offs and release acceptance. I also personally carried out the independent acceptance and API/OIDC checks listed above. I delegated most implementation, substantial test writing and execution, and many browser investigations to Claude Code.

This workflow had real limitations:

- **A coding agent can miss UX defects while producing a convincing PASS report.** The mobile overflow required my own reproduction and a better measurement method.
- **An agent reviewing tests and code it helped produce is not an independent human reviewer.** This is why I combined automated checks, controlled failure demonstrations, a separate critical discussion with ChatGPT and personal acceptance testing; none alone proves correctness.
- **Generated plans can drift or contain contradictory revisions.** Explicit plan approval, diff inspection, narrow scopes and stopping points were necessary controls.
- **Rapid generation can outpace my detailed mental model of the code.** I therefore focused review effort on security boundaries, API behavior, user workflows and specific risks rather than claiming exhaustive line-by-line authorship or understanding.

Out of scope by choice: per-user boat ownership, optimistic concurrency control, production Keycloak hardening, Swagger/OpenAPI, a permanent Playwright suite and a complete accessibility certification. These decisions reflected the challenge's small scope, time constraints and the need to keep the final release stable.

## 6. Representative prompts (verbatim)

The five prompts below are copied **unchanged** from the development log. They show architecture framing, human correction of the initial plan, Plan Mode for a significant frontend slice, a rejected CI approach, and a test explicitly designed to catch a security regression. The detailed chronological journal is available in [`docs/AI_DEVELOPMENT_LOG.md`](docs/AI_DEVELOPMENT_LOG.md).

### Prompt 1 — Initial scope, architecture and quality gates

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

### Prompt 2 — Human review and correction of the initial AI plan

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

### Prompt 3 — Frontend architecture in Plan Mode

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

### Prompt 4 — Stop complex Bash CI and choose declarative workflows

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

### Prompt 5 — Verify that validation errors do not disclose user input

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

## 7. Final outcome and documentation status

The reported release-acceptance pass found no blockers: the stack started under Docker Compose, required user journeys passed, backend/API security checks passed, and automated frontend/backend suites were green. The PR history and final CI results were checked. Some UI-specific scenarios remained marked **NOT VERIFIED** in the final agent-run journey, as noted above.

This document is a **curated methodology report**, not a transcript of every agent interaction. The complete chronological notes are available in [`docs/AI_DEVELOPMENT_LOG.md`](docs/AI_DEVELOPMENT_LOG.md), preserving detailed prompts, test evidence, revisions and mistakes. All five representative prompts were compared against the archive and confirmed to match exactly.
