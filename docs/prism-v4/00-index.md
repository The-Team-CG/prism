# P.R.I.S.M Version 4 Documentation Index

Source: `C:\Users\anton\Downloads\PRISM_V4_Complete_Feature_Catalog.docx`

This document set preserves the official feature catalog for P.R.I.S.M Version 4 and the current redesign roadmap. The original catalog serves two purposes: (1) the manuscript reference for Chapter 3 Section 3.3.1 Functional Requirements, and (2) the panel defense reference confirming the originally documented system scope. Every feature from Version 3 is preserved. Ten new AI features have been added. All AI features include a security note explaining how client and supplier data is protected.

The complete catalog is now treated as the baseline feature inventory, not a hard ceiling. The product may add, revise, merge, defer, or retire features during the whole-app redesign when that makes P.R.I.S.M better for PMCM operations. For current implementation status, needed revisions, and exact revision guidance, use `07-implemented-feature-revisions.md`. For rules on changing the feature set during redesign, use `10-product-evolution-and-redesign-governance.md`.

## Official Count Summary
| Persona | V3 Count | V4 Additions | V4 Total |
| --- | --- | --- | --- |
| PMCM Admin (Ms. Mys and EA) | 67 | 10 new AI features | 77 |
| Client | 13 | 0 | 13 |
| Supplier (Existing and New) | 13 | 0 | 13 |
| Coordinator | 7 | 0 | 7 |
| Guest (Extended Scope) | 5 | 0 | 5 |
| External and Public | 8 | 0 | 8 |
| Security (Cross-Cutting) | 4 | 0 (ZDR under PMCM AI) | 4 |
| Total Numbered Features | 117 | +10 AI Features | 127 |
| System Behaviors | 31 | +6 new AI-related behaviors | 37 |
| GRAND TOTAL | 148 | +16 | 164 |

## Navigation
| Document | Path | Use |
| --- | --- | --- |
| Complete catalog | ./01-complete-feature-catalog.md | Source-preserving catalog tables by section and persona. |
| System behaviors | ./02-system-behaviors.md | All automatic rules and logic, including AI behavior rules. |
| AI and security | ./03-ai-features-and-security.md | Claude ZDR, DataSanitizer, AIAuditLog, and all AI features. |
| Implementation plan | ./04-implementation-plan.md | Frontend, backend, database, dependencies, acceptance criteria, and priority. |
| Defense demo guide | ./05-prism-defense-demo-guide.md | Live demo script, persona flows, and fallback evidence. |
| Chapter 3 cross-reference | ./06-chapter-3-cross-reference.md | Feature references mapped to manuscript functional requirement groups. |
| Implemented feature revisions | ./07-implemented-feature-revisions.md | Current implemented/partial features, revision gaps, and how to revise them safely. |
| Revision phase plan | ./08-revision-phase-plan.md | Durable phase roadmap for revision-first implementation and docs cleanup. |
| Defense demo runbook | ./09-defense-demo-runbook.md | Local startup, accounts, demo order, verification, and defense boundaries. |
| Product evolution governance | ./10-product-evolution-and-redesign-governance.md | Rules for adding, revising, merging, deferring, or retiring features during the whole-app redesign. |
| Feature ledger | ./11-feature-ledger.md | Active feature-family decisions, phase placement, ownership, permission boundaries, and verification requirements. |
| Redesign inventory | ./12-redesign-inventory.md | Current app route inventory with redesign severity, ownership, and role-boundary notes. |
| Docs cleanup checklist | ./13-docs-cleanup-checklist.md | Canonical docs, retired artifacts, cleanup rules, and verification commands. |
| PMCM Admin features | ./features/admin.md | Admin-owned operating system functions. |
| Client features | ./features/client.md | Client portal functions. |
| Supplier features | ./features/supplier.md | Supplier portal functions. |
| Coordinator features | ./features/coordinator.md | Coordinator/event-day portal functions. |
| Guest features | ./features/guest.md | Guest registration and engagement functions. |
| External/public features | ./features/external-public.md | Public inquiry, demo, and marketing-facing scope. |
| Security features | ./features/security.md | Cross-cutting controls. |
| AI feature summary | ./features/ai.md | AI feature matrix and governance notes. |

## Recommended Defense Reading Order
1. Read `05-prism-defense-demo-guide.md` for the live story.
2. Use `01-complete-feature-catalog.md` to answer scope questions.
3. Use `04-implementation-plan.md` when the panel asks how a feature is built.
4. Use `07-implemented-feature-revisions.md` when deciding what to fix before adding more features.
5. Use `08-revision-phase-plan.md` to choose the next revision phase.
6. Use `09-defense-demo-runbook.md` for the exact local rehearsal order.
7. Use `03-ai-features-and-security.md` when the panel asks about AI, privacy, or human approval.
8. Use `10-product-evolution-and-redesign-governance.md` before adding, revising, merging, or retiring catalog features.
9. Use `11-feature-ledger.md`, `12-redesign-inventory.md`, and `13-docs-cleanup-checklist.md` before starting redesign implementation work.
