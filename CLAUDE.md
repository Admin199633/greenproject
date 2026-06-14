# CLAUDE.md — TimeOps Demo

This project is a webinar demo. It exists to show a structured, role-based workflow using Claude Code skills, not to ship to production.

## Stack
- Frontend: React + TypeScript + Vite (`apps/web`, package `@timeops/web`)
- Backend: Node.js + Express + TypeScript (`apps/api`, package `@timeops/api`)
- Shared types: `packages/shared` (package `@timeops/shared`)
- Tests: Vitest (unit + API), Playwright (E2E in `tests/e2e`, package `@timeops/e2e`)
- Data store: in-memory or JSON-seeded only — no database
- Email: mock service only — never send real email

## Workflow (must be followed for every feature)
Each feature flows through these skills in order. The active ticket lives in `docs/TICKET.md`.

1. `product-owner`  — acceptance criteria and user value
2. `architect`      — technical plan and boundaries
3. `developer`      — implementation
4. `tester`         — unit / API / frontend / E2E validation
5. `security`       — critical issues and data exposure review
6. `data-analyst`   — data model and reporting sanity check

Each role appends a `## Handoff -> <next role>` section to `docs/TICKET.md` so the next role has everything it needs without re-asking the previous one.

## Hard rules
- Do not introduce a real database. The store is in-memory or JSON-seeded.
- Do not send real email. Use the mock email service only.
- Do not duplicate types between `apps/web` and `apps/api` — import from `@timeops/shared`.
- Do not skip the workflow above for "small" changes.
- Do not implement the overdue reminder feature in this scaffold task.

## Scripts (run from repo root)
- `npm run dev`   — start API and web together (concurrently)
- `npm run test`  — unit + API tests across workspaces (Vitest)
- `npm run lint`  — type-check across workspaces (`tsc --noEmit`)
- `npm run e2e`   — Playwright end-to-end tests

## Pointers
- `docs/CODEBASE_MAP.md` — current directory layout and boundaries
- `docs/SECURITY.md`     — security review log
- `docs/TICKET.md`       — active ticket
- `.claude/skills/`      — role definitions (one folder per role, each with `SKILL.md`)


# Required workflow

For every Jira ticket implementation, Claude must use these skills:

1. product-owner - clarify user value, acceptance criteria and scope
2. architect - design backend/frontend boundaries and technical plan
3. developer - implement in small safe steps
4. tester - define and run unit, API, frontend and E2E tests
5. security - review critical risks, validation and sensitive data exposure
6. data-analyst - validate data model, statuses, metrics and edge cases

Claude must explicitly print:

Active skills:
- product-owner
- architect
- developer
- tester
- security
- data-analyst

Claude must not skip straight to implementation.
Claude must produce a short handoff after each role.
Claude must update docs/CODEBASE_MAP.md at the end.
Claude must update docs/SECURITY.md when security requirements are touched.