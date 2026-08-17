# 11. Plugin distribution

Date: 2026-07-02

## Status

Accepted

## Context

Plugins (ADR-0009, ADR-0010) must be packaged, distributed, and installed — with no backend
in S1–S3 (ADR-0007). The original premise is that the monorepo is a set of consumable
packages that get "built" into an instance. Runtime dynamic install (a marketplace) is a
different, heavier delivery path than build-time composition.

## Decision

**Plugins are npm packages** carrying an in-package manifest (id, version, kind, tier,
requested capabilities). Two delivery paths for the *same* artifact, sequenced by scenario:

- **Build/install-time (S1–S3, now):** compose `kernel + first-party HostExtensions + chosen
  plugins` as dependencies; a build produces the instance (Storybook-addon style). This is
  the primary near-term model.
- **Runtime registry/marketplace (S4, later):** a **static** catalog (JSON index + modules
  hosted on CDN/npm/git-pages — no server) plus dynamic load and a consent UI, loading the
  same packages at runtime without a rebuild. Where the paid tier and possible backend live.

The manifest's declared tier/capabilities let the kernel enforce the sandbox split
(ADR-0010) and gate consent.

## Consequences

- In S1–S3 the trust decision is an ordinary npm-dependency choice by a developer; the
  sandbox/consent machinery is *designed in* now but *strictly enforced* when runtime
  install arrives (S4).
- No central infrastructure is required to ship the product; the marketplace is additive.
- Project-scoped plugins may also live in the token repo and load from the working copy.
