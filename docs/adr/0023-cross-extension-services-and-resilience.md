# 23. Cross-extension services and resilience

Date: 2026-07-03

## Status

Accepted — refines ADR-0022

## Context

The Themes extension must publish the theme list for the Tokens extension to consume,
without the two importing each other, and the app must survive an extension failing or being
absent. React context can't carry cross-extension state because each extension mounts in its
own React root (ADR-0017), so the coordination point must be the kernel.

## Decision

- **Service registry** on the `ExtensionContext`: extensions `register(key, service)` and
  `get(key)`. The service's *shape* is a contract defined in `@vertekum/core` (e.g. `ThemeService`
  under the `THEME_SERVICE` key), so publisher and consumer depend only on the core contract
  — never on each other.
- **Soft dependencies.** A consumer `get`s a service and **degrades gracefully** when it is
  absent (Tokens falls back to the `default` theme only). Extensions never hard-import one
  another.
- **Error boundaries.** Each extension's mounted view is wrapped — inside its own root, by the
  `reactMount` bridge — in a React error boundary, so a crash is contained to that pane
  instead of taking down the shell. First-party failures also surface at build/typecheck;
  runtime/external failures (Scenario 4) are caught by the boundary plus the soft-dependency
  check.

## Consequences

- Extensions collaborate through kernel-registered services + core contracts, never through
  shared React internals (which can't cross the mount-isolation boundary, ADR-0017).
- Removing or breaking an extension degrades *features*, not *function*: Tokens still edits
  token values with any peer extension gone.
- This is the concrete cross-extension seam; the general "enhance via lifecycle hooks /
  middleware" mechanism remains deferred — no consumer has needed a mutation interceptor.
