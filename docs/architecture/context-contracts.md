---
type: "Architecture Contract Register"
title: "P.R.I.S.M context contracts"
description: "Current public context surfaces, dependency direction, read-model composition, and focused seams in the Prism modular monolith."
tags: [architecture, contracts, boundaries, ddd]
status: canonical
updated: "2026-10-29"
authority: normative
audience: [agents, backend-engineers, reviewers]
scope: "apps/api/src/modules and kernel seams"
last_verified: "2026-10-29; context and kernel folders, injection tokens, and the boundary checker's public-subpath allowlist checked against source"
sources:
  - id: context-source
    resource: "apps/api/src/modules"
    title: "Bounded-context source tree"
  - id: kernel-source
    resource: "apps/api/src/kernel"
    title: "Technical kernel source tree"
  - id: boundary-checker
    resource: "scripts/check-prism-boundaries.mjs"
    title: "Prism architecture boundary checker"
  - id: architecture-reference
    resource: "docs/architecture/current-architecture.md"
    title: "Current architecture reference"
  - id: accepted-domain-ownership
    resource: "docs/architecture/decisions/adr-0008-domain-owned-postgres-schemas.md"
    title: "Accepted write-owner and schema decision"
  - id: approved-model-ownership
    resource: "apps/api/prisma/domain-ownership.json"
    title: "Complete model ownership and target-schema inventory"
  - id: external-reference-policy
    resource: "apps/api/prisma/domain-reference-policy.json"
    title: "Cross-domain foreign-key and scalar-reference behavior inventory"
---
# P.R.I.S.M context contracts

## At a glance

- **Purpose:** Define the supported in-process seams between bounded contexts.
- **Authority:** Normative for backend imports, ports, contracts, and read-model composition.
- **Scope:** `apps/api/src/modules` and `apps/api/src/kernel`.
- **Use when:** Adding a context dependency, public index, port, or cross-context query.
- **Change when:** A supported seam, context owner, or extraction constraint changes.
- **Verify with:** `scripts/check-prism-boundaries.mjs` and boundary tests.

This register describes in-process dependency seams in the one NestJS
deployable. A context index or focused port is an application contract; it is
not a network endpoint and does not imply that the context is already an
independent service.

Lifecycle binds file-requirement evidence through Platform's `STORED_REQUIREMENT_UPLOAD_READER` in the caller transaction. Only confirmed, available bytes from the same event and an allowed upload owner can fulfil a custom requirement. Requirement templates and bindings stay owned by Lifecycle; stored bytes stay owned by Platform.

Floorplan uses the focused `event-lifecycle/floorplan-reference` capability
for event gates and projection facts in event-scoped write transactions.

## Contract rules

1. A context's public `index.ts` is the default surface for stable in-process
   capability use.
2. `contracts/` and shared `@prism/types` types contain serialisable inputs and
   outputs; they do not expose Prisma models, Nest controllers, or vendor SDKs.
3. A focused injected port is used only for genuine inversion, an optional
   integration, a policy seam, a testing replacement, or a transport boundary.
4. Context composition roots may import another context's Nest module only to
   assemble the current module graph. That import is not permission for private
   application code to import the context's concrete implementation.
5. Production code must not import another context's private service,
   repository, DTO, provider adapter, or deep filesystem path.
6. The kernel may be used by contexts and must not import a business context.
7. `read-models` composes role-scoped reads only. It does not own business
   writes, authorization policy, or a general-purpose command facade.

## Context public surfaces

The approved owner column states who owns decisions and writes. It does not
claim every legacy call site has moved; the seam inventory below identifies
current transitional writes separately.

| Context | Public surface | Owns | Cross-context use |
| --- | --- | --- | --- |
| commercial | modules/commercial/index.ts | Supplier network, quotes, proposals, communications, and billing decisions | Expose owner-validated supplier and commercial commands; lifecycle alone owns document metadata. |
| event-lifecycle | modules/event-lifecycle/index.ts | Inquiry and event lifecycle, document metadata, compliance, decisions, and closure | Expose lifecycle commands and scoped reads; consume the versioned Floorplan projection and request Commercial-owned impacts for Lifecycle-issued addenda. |
| floorplan | modules/floorplan/index.ts | Official plans, drafts, templates, publication, and review state | Expose official-layout reads and mutation contracts; consume Lifecycle's transaction-aware reference and versioned projection capabilities. Client preference input remains role-scoped. |
| event-games | modules/event-games/index.ts | Game definitions, sessions, PIN join, participants, submissions, scoring, awards, and moderation | Consume `read-models/event-scope` for host/admin/public event scope and the platform-ops storage capability for game media; no other context writes game records. |
| identity-access | modules/identity-access/index.ts | Authentication, account approval, and account access state | Expose verified actor/access checks; do not export session implementation details. |
| live-ops | modules/live-ops/index.ts | Event-day tasks, schedules, issues, handoffs, end-of-day reports, and event-day policy | Expose live-ops commands and reads; request Operations-owned assignment transitions. |
| operations | modules/operations/index.ts | Coordinator pool, availability, coverage, assignments, attendance, replacement, cancellation, acknowledgments, reliability, and guest operations | Validate and apply staffing and guest changes through Operations-owned commands. |
| platform-ops | modules/platform-ops/index.ts | Trust, audit, notifications, privacy coordination, and AI governance | Expose narrow audit/notification/governance seams; Platform implements the kernel receipt port and consumes read-only reference projections. |
| read-models | modules/read-models/index.ts | Authorized, role-scoped read composition | Combine approved reads and map shared interfaces; never write business state. |

## External-reference lifecycle

Cross-domain identifiers are scalar references in the target model. For a
command that depends on current target state, the target owner validates the
reference and same-event agreement in the command transaction. The initiating
context still authorizes its actor. Historical attribution is retained without
becoming current authorization. Profiles, counts, and recovery rules are in the
[external-reference lifecycle register](external-reference-lifecycle.md) and the
machine policy at `apps/api/prisma/domain-reference-policy.json`.

## Technical kernel surfaces

The kernel contains technical primitives under
`apps/api/src/kernel/`: `access-control`, `database`, `event-core`,
`event-session`, `health`, `mail`, `shared`, and `shared-kernel`. Contexts may
depend on these facilities. Kernel code must not import `modules/*`.

## Registered public subpath seams

Deep `@prism/contexts/<context>/<path>` imports are rejected except for the
exact subpaths allowlisted in `scripts/check-prism-boundaries.mjs`:

| Subpath | Supplies |
| --- | --- |
| `read-models/closeout` | Unresolved urgent issues for lifecycle closeout, in the caller transaction |
| `read-models/event-scope` | Trusted inquiry/assignment event scope |
| `read-models/participant-facts` | Event, supplier, and coordinator participant facts for Identity |
| `read-models/guest-events` | Guest access-code and coordinator workspace projections for Operations |
| `read-models/account-contacts` | Approved account and event-notification contact lookups for Lifecycle, LiveOps, and Platform notifications |
| `read-models/commercial-facts-reader` | Event and audit facts for Commercial supplier review, proposal review, and lifecycle closure |
| `read-models/lifecycle-facts` | Compliance and closure facts for Lifecycle commands |
| `read-models/file-evidence` | Confirmed signed-conforme object identity |
| `event-lifecycle/floorplan-reference` | Locked event gates and projection facts for Floorplan |
| `event-lifecycle/operations-reference` | Locked event state for Operations |
| `event-lifecycle/post-event-reference` | Locked post-event state for Commercial additional billing |
| `event-lifecycle/conforme-reminder-window` | Conforme reminder eligibility claim for Platform |
| `identity-access/account-invitation-reference` | Account invitation issuance for Lifecycle inquiries and Commercial supplier applications |
| `identity-access/coordinator-reference` | Coordinator account eligibility for Operations assignments |
| `operations/live-ops-reference` | Operator and handoff assignment checks for LiveOps |
| `commercial/registration-supplier-reference` | Supplier/category/selection checks for Operations registration links |
| `live-ops/urgent-issue-reference` | Same-event urgent-issue checks for Commercial billing |
| `floorplan/event-drafts` | Floorplan-owned, bounded per-event draft reads for scalar event IDs |

Adding a subpath requires a checker allowlist entry and a row here.

## Current seam inventory

These rows separate the desired owner from the implementation that currently
runs. A direct cross-context table mutation listed as transitional does not
transfer ownership; replace it with an owner capability before removing the
legacy relation or changing schema placement.

| Source | Target or resource | Contract rule | Current treatment |
| --- | --- | --- | --- |
| modules/read-models | owning business contexts | Public index, serialisable read contract, or approved reader | Read-only composition; no command/write ownership. |
| modules/read-models | commercial supplier workspace | SUPPLIER_WORKSPACE_READER public port | Joins only the current-page event header and supplier request/assessment facts needed for PMCM review; excludes quote access tokens, prices, client contacts and audit data. |
| modules/event-lifecycle | read-models closeout reader | Explicit pure public subpath | Reads unresolved urgent issues using the caller transaction. The exact dependency avoids a runtime module cycle. |
| modules/platform-ops | event-lifecycle reminder eligibility | Focused lifecycle claim contract | Lifecycle validates accepted, unsigned inquiry eligibility and atomically claims the reminder window inside the approval transaction. |
| modules/event-lifecycle and modules/floorplan | read-models event-scope reader | Explicit public reader contract | Joins scoped event identity and assignment/profile facts; controllers do not trust actor/query labels or expose joined identity fields. Empty identities and inactive coordinator assignments/profiles confer no event scope. |
| modules/platform-ops storage | read-models platform reference reader | `findStorageEventScope`, optionally in the caller transaction | Returns archive/portal state, client email, and booked supplier IDs with their persisted emails. Storage derives the supplier identity from verified email and locks the event row before writes. |
| kernel/access-control | platform audit behavior | Kernel-owned focused port; composition-root adapter | AUDIT_WRITER is bound to Platform by the composition root; kernel imports no business context. |
| modules/identity-access | platform trust behavior | Identity depends on AUTH_AUDIT; adapter owns the implementation dependency | Authentication/account workflows use an audit/lockout seam; application code does not import AuditService. |
| modules/event-lifecycle | document storage behavior | DOCUMENT_VAULT owned by Lifecycle | Lifecycle registers commercial contract/statement metadata, checks event and allowed-kind eligibility through the caller transaction, and reports the current document retention policy. Onboarding remains an in-context Lifecycle write. |
| modules/commercial | Lifecycle document-vault capability | Register and validate document references for commercial records | Commercial keeps contract/billing decisions and scalar document IDs; supplier contracts, billing statements, billing evidence and client proposal review use the public Lifecycle capability. |
| modules/event-lifecycle | Commercial confirmed-cancellation-fee capability | Create an approved fee source from an acknowledged PMCM cancellation/postponement decision | The focused writer receives the decision transaction, validates the verified PMCM actor and amount, and records an idempotent source. Lifecycle links the source in decision evidence; normal PMCM billing issuance creates its invoice and milestones. |
| modules/event-lifecycle | Commercial addendum-impact capability | Transaction-aware updates to an approved billing source and selected supplier quotes | Lifecycle owns addendum decisions and impact history; Commercial owns the source/quote writes. Current briefing/conforme workflows do not initialize billing because they provide no priced-source input; do not fabricate billing rows. |
| modules/commercial | Lifecycle post-event state reader | Validate event existence and recorded end before additional billing | Lifecycle locks and returns only required event state in the caller transaction; Commercial owns the billing command. |
| modules/commercial | LiveOps urgent-issue reference reader | Validate the incident belongs to the same event before additional billing | LiveOps locks the incident row in the caller transaction and returns only its ID and event ID; Commercial authorizes and writes billing. |
| modules/operations | Lifecycle Operations event-reference capability; read-models guest-event projection capability | Event eligibility, walk-in policy, and guest/coordinator workspace projections | Lifecycle locks and returns scoped event state in the caller transaction; Operations uses it for guest/staffing checks, and Lifecycle owns walk-in policy writes. Read-models owns guest access-code and coordinator workspace composition with narrow fields and bounded floorplan drafts. |
| modules/operations | Commercial registration supplier-reference capability | Validate supplier category and event selection before registration links | Commercial locks supplier, category, and selected quote rows in the caller transaction. A category must be active when a link is new or changed; existing registration history remains editable. |
| modules/live-ops | Operations staffing and LiveOps-reference capabilities; Lifecycle event-reference capability | Owner-validated assignment transitions, current operator/handoff eligibility, and event-state checks | Operations validates and mutates assignment state, attendance, reliability and audit effects; for designation and handoff, it locks and rechecks profiles and same-event assignment state in the LiveOps transaction. Lifecycle supplies transaction-aware event state. LiveOps retains event-day authorization, history, and event-day log composition. |
| modules/event-lifecycle | Operations staffing capability | Owner-validated assignment cancellation/postponement transitions | Event decisions pass their caller transaction to Operations, which validates and applies assignment changes atomically; Lifecycle continues to coordinate the event decision. |
| modules/floorplan | Lifecycle event capabilities | `FLOORPLAN_EVENT_REFERENCE_READER` and `FLOORPLAN_PROJECTION_WRITER` | Lifecycle supplies locked event, conforme, ocular, archive, freeze, portal, and projection facts. Floorplan validates official-draft gates and blocks archived/frozen writes; its versioned projection clock and draft changes commit with Lifecycle's compare-and-set. |
| kernel/event-core | Platform receipt storage | `CommandReceiptStore` port with caller transaction | Platform implements receipt persistence and binds it at the root; kernel keeps command authorization and replay policy, while reservation, command writes, and completion share the caller transaction. |
| modules/platform-ops | each affected data-owning context | Focused redaction/retention capability | Platform coordinates approved privacy requests; data-owner mutations and resumable partial execution remain to be made explicit. Document metadata stays retained and redaction stays disabled while the PMCM document-retention policy is pending. Operations redaction covers guest roster identity/contact fields and feedback filename metadata, while stored media bytes remain outside database redaction. |
| modules/platform-ops | read-models reference projection | `PLATFORM_REFERENCE_READ_MODEL`, bound by `PlatformReferenceReadersModule` at the API composition root | Supplies narrow event/storage scope, PARE request/event/supplier facts, trust-recipient email, and privacy consent inventory. Reads only; no owning-context writes. |
| modules/identity-access | read-models participant event facts | `PARTICIPANT_FACTS` from `read-models/participant-facts`, whose submodule imports only DatabaseModule | Supplies serializable event/inquiry, supplier-assignment, and coordinator-assignment facts; Identity retains approved-account lookup, role eligibility, email matching, actor stamping, and EventAccessPolicy decisions. The focused submodule avoids importing full ReadModelsModule and its Identity/Commercial module cycle. |
| modules/platform-ops | stored-object owner/usage pairs | Closed owner/usage registry in `storage-object.service.ts` | Registered pairs: `billing_statement` and `proposal_version` + `event_deliverable`; `event` + `client_document`/`signed_conforme`; `supplier` + `supplier_document`; `event_game_definition` + `event_game_media`; `event_game_lobby` + `event_game_branding`. Unregistered pairs fail closed before upload side effects and on stored-object confirmation, retrieval, listing, and deletion. The allowlist does not prove the referenced owner record exists or matches the event; each owner capability must validate that. |
| modules/event-lifecycle | `@prism/contexts/read-models/file-evidence` | Pure read seam | Returns confirmed signed-conforme object identity without provider paths or credentials. |
| modules/read-models decision log | Lifecycle, Commercial, LiveOps decision records; Platform audit rows | PMCM-only `GET events/:eventId/decision-log` (FL-019), bounded per-source reads | Audit source: reasons and outcomes come only from the owning record's dedicated fields (event decisions, decided freeze exceptions, addenda and impact counts, archive override, compliance check overrides, PMCM risk history, ocular waiver, resolved billing corrections, waived additional billing, repeat-client payment-terms overrides, decided task reassignments, inquiry merges). `audit_logs` rows supply actor name/role attribution by affected record only; audit metadata is never parsed. |
| context composition roots | other Nest context modules | Module import only at composition root | Allowed for one-process assembly; not a private application dependency. |
| API controllers | owning context application services | Owner service and public mapper | Controllers do not expose Prisma models or perform cross-context persistence lookups. |

## Persistence seam

Prism currently uses one PostgreSQL database and one Prisma client. The approved
ADR-0008 and complete model ownership inventory are linked from this register.
Every business record has one write owner and lives in its write domain's
schema. Foreign keys may join records owned by the same domain; cross-domain
references remain scalar identifiers and use a public owner capability when a
command depends on the referenced record's current eligibility. A shared
database and schema name do not grant another context write authority.

## Verification

Run:

```powershell
npm run check:boundaries
npm run test:boundaries
```

For an API context change, also run the touched API tests, typecheck, build, and
Prisma validation. Inspect the importing file and its public index before
accepting a boundary change; a passing typecheck alone does not prove a clean
seam.
