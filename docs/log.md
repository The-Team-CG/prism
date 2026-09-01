# Documentation bundle update log

## 2026-09-01

- **Created:** Adopted an OKF v0.2-style bundle landing, constitution, typed
  concept metadata, directory indexes, and update history.
- **Restructured:** Moved current architecture, product, roadmap, runbook, and
  V4 reference material into semantic directories.
- **Decided:** Added ADRs for role-app boundaries, shared contracts and sample
  compatibility, DDD-shaped modular-monolith contexts, cross-context seams and
  read models, and Next route/feature MVVM architecture.
- **Promoted:** Converted durable FE/BE findings and priority/risk items into
  architecture ADRs and roadmap records.
- **Retired:** Removed completed execution plans and dated review artifacts
  after promoting their durable content. Git history remains the archive; the
  V4 catalog remains a deliberate reference set.
- **Refined:** Removed the redundant assessment, implementation backlog, and
  compatibility pointer documents; added authority/owner/scope metadata and an
  at-a-glance section to each living concept document.
- **Aligned:** Replaced the event dashboard's central content dispatcher with
  route-owned composition, split its navigation and workspace orchestration,
  moved selectors to `pmcm-kit`, and consolidated event filter compatibility
  behind the dynamic `[eventSlug]` route.
- **Hardened:** Bounded the remaining floorplan list queries, inverted the
  kernel-to-platform audit dependency, and introduced focused audit,
  notification, authentication, document, finance, staffing, guest, and
  floorplan context ports where application code crossed broad service seams.
- **Recorded:** Added the architecture-alignment report, priority/risk status
  snapshot, persistence ownership and intentional-join register, and ADR-0006.
  Remaining legacy DTO migration, deeper domain-policy extraction, and
  microservice extraction stay evidence-driven follow-up work rather than
  unbounded cleanup.
