# 9. Thin kernel; features ship as HostExtensions

Date: 2026-07-02

## Status

Accepted

## Context

A hard constraint is that Vertekum is built to be extended by plugins acting at many levels
(storage, transforms, token manipulation, themes, schema/validation, app lifecycle). We had
to decide whether the app is a monolith that merely *also* accepts plugins, or whether its
own features are themselves built on the public plugin API.

## Decision

The app is a **thin kernel**, and the majority of its features ship as **first-party
HostExtensions** built against the same public API third parties use. The kernel provides
only: the extension host (registry, manifest, activation), the event/hook bus, the sandbox
runtime, the document store (ADR-0012), and core interfaces such as `StorageProvider`
(ADR-0008). Editing, themes, schema/validation, and export are all HostExtensions.

## Consequences

- The public extension API is dogfooded, so it is guaranteed powerful enough — a
  prerequisite for the marketplace and possible paid tier (ADR-0011, ADR-0007 S4).
- A **stable internal extension API is required from day one**, demanding API discipline
  before the product is fully known. This is the accepted cost.
- "The majority of the system" being extensions also makes the trusted tier (ADR-0010) the
  primary surface where value is built.
