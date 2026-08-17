# 10. Plugin architecture: trust tiers and API shape

Date: 2026-07-02

## Status

Accepted

## Context

With features built as plugins (ADR-0009) and the ecosystem "open to the public," plugin
code runs in a browser page that may hold the user's git credentials and their entire token
set. We needed an execution/trust model that is safe for public plugins, and an API shape
that keeps that safety while remaining expressive. Most plugin kinds (transforms, token
manipulation, theme resolution, validation) are pure functions over token data; only deep
UI/lifecycle integration needs broad access.

## Decision

**Three plugin tiers:**

- **Cheap tier — event/hook bus.** Lightweight plugins subscribe to lifecycle events and to
  hooks that HostExtensions publish. For reactive, parse-on-action work.
- **Sandboxed tier — data plugins.** Pure data-in/data-out work (transforms, token ops,
  theme resolution, exporters) runs isolated in a Web Worker with a capability-scoped API —
  no DOM, no ambient network, no credentials. Snapshot in, patch/artifact out.
- **Trusted tier — HostExtensions.** UI, lifecycle, storage, and schema/validation.
  Full access, installed with consent. The primary surface (ADR-0009).

**API shape:** a fixed set of **typed extension points** (`StorageProvider`,
`Transformer/Exporter`, `TokenOperation`, `SchemaProvider/Validator`,
`HostExtension`) plus the **event/hook bus**. Each plugin declares its kind and gets a
scoped API; HostExtensions may publish their own bus hooks for cheap-tier plugins to attach
to.

## Consequences

- Public/untrusted plugins can be confined to the sandboxed or cheap tiers safely; only
  explicitly trusted plugins touch credentials or the DOM.
- The tier split earns its keep mainly at runtime install (ADR-0011 S4); build-time
  composition (S1–S3) relies on ordinary npm-dependency trust, so strict enforcement can
  arrive with runtime install.
- Typed points keep the sandbox composable; the bus + HostExtension tier provide the
  open-ended escape hatch.
- The `SchemaProvider/Validator` extension point is declared here but its **design is
  deferred** until after a solid prototype / production-ready app exists; it is not needed
  for the first core-loop slice.
