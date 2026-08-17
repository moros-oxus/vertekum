# 8. Pluggable StorageProvider

Date: 2026-07-02

## Status

Accepted — amends ADR-0003; amended by ADR-0015 (adds LocalServerProvider as the default local provider)

## Context

ADR-0003 kept the live document as an in-browser working copy synced to DTCG files. The
sharpened vision makes **git the preferred backing** (local git or a remote repo) while
still supporting plain files and requiring no backend. A browser with no backend can reach
git in two very different ways, with different trade-offs (raw git needs a CORS proxy for
remotes; host APIs support browser OAuth but are host-specific).

## Decision

The working copy (ADR-0003) remains the live store. Its **sync target is pluggable behind a
`StorageProvider` interface** — the first plugin seam, extensible from day one. Built-in
providers:

- **Local git** — isomorphic-git operating on a `.git` folder via the File System Access
  API. Entirely local, **no CORS proxy**.
- **Local files** — plain DTCG files via the File System Access API (no git).
- **Host adapters** — GitHub/GitLab via their APIs + browser OAuth (no proxy). The
  friction-free default for remotes.

An optional **generic git-over-CORS-proxy** provider covers arbitrary/self-hosted remotes;
the proxy is user-supplied (opt-in), keeping the core backend-free. Plugins may add more
providers. Because they handle credentials and network, StorageProviders run in the
**trusted plugin tier** (ADR-0010).

## Consequences

- Local modes need no proxy and no backend; the CORS-proxy concern is confined to arbitrary
  remote hosts a user opts into.
- File System Access is Chromium-only today; non-supporting browsers fall back to
  upload/download import-export.
- ADR-0004's git-*style* merge maps onto real git in git-backed providers.
