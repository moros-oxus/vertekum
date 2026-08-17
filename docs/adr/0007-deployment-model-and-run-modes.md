# 7. Deployment model and run modes

Date: 2026-07-02

## Status

Accepted — amends ADR-0001; amended by ADR-0015 (a local helper process is allowed for local run modes)

## Context

ADR-0001 established `vtk-app` as a local-first browser SPA with "no accounts,
authentication, or multi-user collaboration." As the product vision sharpened, two things
were added that ADR-0001 did not anticipate: the app should be **deployable** (not only run
locally), and it should **interface with git**, where "permissions and auth are determined
by the repo." This required reconciling those goals with the no-backend posture.

## Decision

The app runs across a ladder of scenarios, all served as the **same static client** with
**no stateful backend**:

- **S1 — Embedded** in a project repo (Storybook-like): installed as dev dependencies, run
  locally, tokens managed inside that repo.
- **S2 — Dedicated tokens repo**, local: a standalone repo whose purpose is token
  management; can export a consumable package for downstream repos.
- **S3 — Hosted**: the same client deployed to git-pages / a container, pointed at a repo.
- **S4 — Easy-install / SaaS** (future): one-click or a hosted paid offering; **this is the
  only scenario that may introduce a backend** (e.g. licensing).

Git-host **authentication happens client-side** — the SPA talks to a git host's API with
the user's own credentials (OAuth/token); "auth determined by the repo" means the repo host
governs permissions, not a Vertekum server.

## Consequences

- ADR-0001's "no auth" is refined: there is no *Vertekum* auth/accounts, but the app uses
  the **git host's** auth client-side. No Vertekum backend exists in S1–S3.
- "Deployed" (S3) is static hosting of the client, not a server with state.
- A backend is explicitly confined to the future S4, and remains a deliberate, bounded
  change rather than something that leaks into the core.
