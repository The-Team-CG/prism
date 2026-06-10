# P.R.I.S.M V4 Feature Screenshot Index

Generated: 2026-05-07

Source catalog: `docs/prism-v4/01-complete-feature-catalog.md`

## Skeleton Capture Guard

The capture pass uses a content-readiness guard instead of a fixed delay:

- Seeds the correct demo session into `localStorage` before each route hydrates.
- Waits for API health, route-specific text markers, `document.readyState === "complete"`, and loaded fonts.
- Rejects screenshots while `.animate-pulse` skeleton elements or loading copy are still present.
- Captures with Microsoft Edge headless through the Chrome DevTools Protocol, so no Playwright install is required.

This is the safer idea for this repo because skeleton-only screenshots are a timing/auth/data-readiness problem. Waiting for real page markers makes the screenshot fail loudly instead of silently saving a loading state.

## Demo Context

- Event: `Ayala Tech Summit 2026` (`evt_demo_ayala`)
- Guest code: `AYALA-TECH-YALA`
- Viewport: `1440x1100`, max capture height `3200px`

## Pages

| Page | App | URL | Screenshot | Direct feature refs |
| --- | --- | --- | --- | --- |
| Client Public Landing | `apps/client` | `http://localhost:3001/` | [screenshots/client-public-landing.png](screenshots/client-public-landing.png) | `FR-42`, `FR-46`, `FR-26` |
| Public Inquiry Form | `apps/client` | `http://localhost:3001/inquiry` | [screenshots/client-public-inquiry.png](screenshots/client-public-inquiry.png) | `FR-46`, `FR-47`, `FR-48`, `FR-50`, `FR-51` |
| Client Sign-In Gate | `apps/client` | `http://localhost:3001/sign-in` | [screenshots/client-sign-in.png](screenshots/client-sign-in.png) | `FR-26`, `New-SEC1` |
| Client Dashboard Overview | `apps/client` | `http://localhost:3001/dashboard` | [screenshots/client-dashboard-overview.png](screenshots/client-dashboard-overview.png) | `FR-26`, `FR-27`, `FR-34`, `New-CL1`, `New-CL2` |
| Client Event Floorplan | `apps/client` | `http://localhost:3001/dashboard/events/evt_demo_ayala/floor-plan` | [screenshots/client-event-floorplan.png](screenshots/client-event-floorplan.png) | `FR-08`, `FR-28`, `FR-29`, `FR-83` |
| Client Proposal Review | `apps/client` | `http://localhost:3001/dashboard/events/evt_demo_ayala/proposal` | [screenshots/client-event-proposal.png](screenshots/client-event-proposal.png) | `FR-58`, `FR-60`, `FR-AI-09` |
| Client Billing And Documents | `apps/client` | `http://localhost:3001/dashboard/events/evt_demo_ayala/billing` | [screenshots/client-event-billing-documents.png](screenshots/client-event-billing-documents.png) | `FR-32`, `FR-33`, `FR-34`, `FR-92` |
| PMCM Command Dashboard | `apps/event` | `http://localhost:3004/dashboard` | [screenshots/pmcm-command-dashboard.png](screenshots/pmcm-command-dashboard.png) | `FR-04`, `FR-05`, `FR-06`, `FR-25`, `FR-56`, `FR-AI-05`, `FR-AI-07`, `FR-AI-ZDR`, `New-SY3` |
| PMCM Inquiry And Onboarding | `apps/event` | `http://localhost:3004/dashboard/inquiries` | [screenshots/pmcm-inquiry-onboarding.png](screenshots/pmcm-inquiry-onboarding.png) | `FR-01`, `FR-02`, `FR-03`, `FR-44`, `FR-45`, `FR-52`, `FR-53`, `FR-54`, `FR-AI-01` |
| PMCM Event Workspace Overview | `apps/event` | `http://localhost:3004/dashboard/events/evt_demo_ayala/overview` | [screenshots/pmcm-event-overview.png](screenshots/pmcm-event-overview.png) | `FR-04`, `FR-05`, `FR-06`, `FR-58`, `FR-60` |
| PMCM Briefing And Proposal | `apps/event` | `http://localhost:3004/dashboard/events/evt_demo_ayala/briefing` | [screenshots/pmcm-event-briefing.png](screenshots/pmcm-event-briefing.png) | `FR-19`, `FR-58`, `FR-59`, `FR-60`, `FR-61`, `FR-62`, `FR-AI-03`, `FR-AI-09` |
| PMCM Floorplans | `apps/event` | `http://localhost:3004/dashboard/events/evt_demo_ayala/floorplans` | [screenshots/pmcm-event-floorplans.png](screenshots/pmcm-event-floorplans.png) | `FR-08`, `FR-80`, `FR-81`, `FR-82`, `FR-83`, `FR-84` |
| PMCM Suppliers And PARE | `apps/event` | `http://localhost:3004/dashboard/events/evt_demo_ayala/suppliers` | [screenshots/pmcm-event-suppliers-pare.png](screenshots/pmcm-event-suppliers-pare.png) | `FR-14`, `FR-15`, `FR-16`, `FR-17`, `FR-18`, `FR-49`, `FR-63`, `FR-64`, `FR-75`, `FR-76`, `FR-AI-04`, `FR-AI-04b`, `FR-AI-06`, `New-S5` |
| PMCM Coordinator Desk | `apps/event` | `http://localhost:3004/dashboard/events/evt_demo_ayala/coordinators` | [screenshots/pmcm-event-coordinators.png](screenshots/pmcm-event-coordinators.png) | `FR-13`, `FR-88`, `FR-89`, `FR-90`, `New-C1`, `New-C2`, `New-C3`, `New-C4` |
| PMCM Live Operations | `apps/event` | `http://localhost:3004/dashboard/events/evt_demo_ayala/live-ops` | [screenshots/pmcm-event-live-ops.png](screenshots/pmcm-event-live-ops.png) | `FR-39`, `FR-78`, `FR-79`, `FR-95`, `FR-AI-07`, `New-C3`, `New-C4`, `New-SUP1` |
| PMCM Billing And Finance | `apps/event` | `http://localhost:3004/dashboard/events/evt_demo_ayala/billing` | [screenshots/pmcm-event-billing.png](screenshots/pmcm-event-billing.png) | `FR-20`, `FR-21`, `FR-69`, `FR-92`, `New-P5` |
| PMCM Closure And Archive | `apps/event` | `http://localhost:3004/dashboard/events/evt_demo_ayala/closure` | [screenshots/pmcm-event-closure-archive.png](screenshots/pmcm-event-closure-archive.png) | `FR-22`, `FR-23`, `New-P1`, `New-P2`, `New-P3`, `New-P5`, `FR-AI-08`, `New-SY1`, `New-SY2` |
| PMCM Audit And Security | `apps/event` | `http://localhost:3004/dashboard/audit` | [screenshots/pmcm-audit-settings.png](screenshots/pmcm-audit-settings.png) | `New-SEC1`, `New-SEC2`, `New-SEC3`, `New-SEC4`, `FR-56`, `FR-AI-ZDR` |
| Supplier Dashboard | `apps/supplier` | `http://localhost:3002/dashboard` | [screenshots/supplier-dashboard-overview.png](screenshots/supplier-dashboard-overview.png) | `FR-35`, `FR-36`, `FR-37`, `FR-38`, `FR-49`, `FR-64`, `New-SUP1`, `New-SUP2`, `New-SUP3`, `New-SUP4`, `FR-AI-04b` |
| Supplier Quote Requests | `apps/supplier` | `http://localhost:3002/dashboard` | [screenshots/supplier-quote-requests.png](screenshots/supplier-quote-requests.png) | `FR-36`, `FR-49`, `FR-64` |
| Coordinator Dashboard | `apps/event` | `http://localhost:3004/dashboard` | [screenshots/coordinator-dashboard.png](screenshots/coordinator-dashboard.png) | `New-CO1`, `New-CO2`, `New-CO3`, `New-CO4`, `New-CO5`, `New-CO6`, `FR-90` |
| Guest Code Gate | `apps/guest` | `http://localhost:3003/open` | [screenshots/guest-open-code.png](screenshots/guest-open-code.png) | `FR-39`, `FR-95` |
| Guest Dashboard | `apps/guest` | `http://localhost:3003/dashboard` | [screenshots/guest-dashboard.png](screenshots/guest-dashboard.png) | `FR-39`, `FR-40`, `FR-41`, `FR-95`, `New-GU1`, `New-EX2` |

## Page Feature Notes

### Client Public Landing

Screenshot: [screenshots/client-public-landing.png](screenshots/client-public-landing.png)

Public entry point and lifecycle boundary before any dashboard access.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-26` | Client Portal Access Gated by Signed Conforme | Prism | Client Features |
| `FR-42` | Guest Pass Promotional Demo | External | External and Public Features |
| `FR-46` | P.R.I.S.M Public Inquiry Page | Prism | External and Public Features |

### Public Inquiry Form

Screenshot: [screenshots/client-public-inquiry.png](screenshots/client-public-inquiry.png)

Public inquiry intake and client type capture.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-46` | P.R.I.S.M Public Inquiry Page | Prism | External and Public Features |
| `FR-47` | Lightweight Spatial Preference Form | Phase 2 | External and Public Features |
| `FR-48` | Referral Source Dropdown | Prism | External and Public Features |
| `FR-50` | Abandoned Inquiry Draft Save with Edit Window | Phase 2 | External and Public Features |
| `FR-51` | Client Type Field | Prism | External and Public Features |

### Client Sign-In Gate

Screenshot: [screenshots/client-sign-in.png](screenshots/client-sign-in.png)

Signed-conforme client portal gate.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `New-SEC1` | Role-Based Authentication and Session Management | Security | Security - Cross-Cutting All Personas and All Phases |
| `FR-26` | Client Portal Access Gated by Signed Conforme | Prism | Client Features |

### Client Dashboard Overview

Screenshot: [screenshots/client-dashboard-overview.png](screenshots/client-dashboard-overview.png)

Client confirmed-event overview, milestones, notifications, and visible actions.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-26` | Client Portal Access Gated by Signed Conforme | Prism | Client Features |
| `FR-27` | Event Progress Visibility | Prism | Client Features |
| `FR-34` | Notification of Task and Milestone Updates | Prism | Client Features |
| `New-CL1` | Walk-In Policy Setting | Prism | Client Features |
| `New-CL2` | Event Day Limited View | Phase 2 | Client Features |

### Client Event Floorplan

Screenshot: [screenshots/client-event-floorplan.png](screenshots/client-event-floorplan.png)

Client layout preference and read-only official layout review boundary.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-08` | Floor Plan Upload and Client Approval Workflow | Prism | Event Planning and Operations |
| `FR-83` | Client Floor Plan Annotation and Approval | Prism | Floor Plan Builder |
| `FR-28` | Client Draft Floor Plan Submission | Phase 2 | Client Features |
| `FR-29` | Official Floor Plan Viewing and Formal Approval | Prism | Client Features |

### Client Proposal Review

Screenshot: [screenshots/client-event-proposal.png](screenshots/client-event-proposal.png)

Client-facing proposal review summary without internal cost exposure.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-AI-09` | Client Communication Intelligence Assistant | Cross | AI Feature Architecture |
| `FR-58` | Event Briefing Form | Prism | Proposal and Cost Estimation |
| `FR-60` | Proposal Submission and Review Workflow | Prism | Proposal and Cost Estimation |
| `FR-AI-09` | Client Communication Intelligence Assistant | AI | Proposal and Cost Estimation |

### Client Billing And Documents

Screenshot: [screenshots/client-event-billing-documents.png](screenshots/client-event-billing-documents.png)

Client-accessible billing milestones and document context.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-92` | Payment Milestone Tracker | Prism | Financial Management |
| `FR-32` | Document Submission Portal | Prism | Client Features |
| `FR-33` | Per-Event File Hub Access | Prism | Client Features |
| `FR-34` | Notification of Task and Milestone Updates | Prism | Client Features |

### PMCM Command Dashboard

Screenshot: [screenshots/pmcm-command-dashboard.png](screenshots/pmcm-command-dashboard.png)

PMCM command home for active events, readiness, alerts, and system boundaries.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-AI-05` | P.R.I.S.M Operations Assistant — POA Chatbot | All | AI Feature Architecture |
| `FR-AI-07` | Real-Time Event Day Copilot | Phase 5 | AI Feature Architecture |
| `FR-AI-ZDR` | Zero Data Retention AI Governance Layer | All | AI Feature Architecture |
| `FR-04` | Per-Event File Hub | Prism | Event Planning and Operations |
| `FR-05` | Live Operations Dashboard | Prism | Event Planning and Operations |
| `FR-06` | Event Proposal Compliance Engine | Prism | Event Planning and Operations |
| `FR-AI-05` | P.R.I.S.M Operations Assistant (POA) — Caged Claude Chatbot | AI | Event Planning and Operations |
| `FR-AI-07` | Real-Time Event Day Copilot | Agentic | Event Planning and Operations |
| `FR-25` | Dual Notification System | Prism | System Configuration and Event Lifecycle |
| `FR-56` | Data Anonymization Tool | Prism | System Configuration and Event Lifecycle |
| `New-SY3` | Change Freeze Deadline | Prism | System Configuration and Event Lifecycle |
| `FR-AI-ZDR` | Zero Data Retention AI Governance Layer | Security | Security - Cross-Cutting All Personas and All Phases |

### PMCM Inquiry And Onboarding

Screenshot: [screenshots/pmcm-inquiry-onboarding.png](screenshots/pmcm-inquiry-onboarding.png)

PMCM intake, conforme, and portal activation evidence.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-AI-01` | Intelligent Inquiry Triage Agent | Phase 1 | AI Feature Architecture |
| `FR-01` | Inquiry Intake Log | Prism | Inquiry and Client Management |
| `FR-02` | Client Onboarding Tracker | Prism | Inquiry and Client Management |
| `FR-03` | Conforme and MOA Document Storage | Prism | Inquiry and Client Management |
| `FR-44` | Organization Merge Tool | Phase 2 | Inquiry and Client Management |
| `FR-45` | Referral Details Field | Phase 2 | Inquiry and Client Management |
| `FR-52` | Send Inquiry Link and Log on Behalf Tool | Prism | Inquiry and Client Management |
| `FR-53` | Pre-Conforme Context Notes Log | Phase 2 | Inquiry and Client Management |
| `FR-54` | Pre-Conforme Document Attachment | Phase 2 | Inquiry and Client Management |
| `FR-AI-01` | Intelligent Inquiry Triage Agent | Agentic | Inquiry and Client Management |

### PMCM Event Workspace Overview

Screenshot: [screenshots/pmcm-event-overview.png](screenshots/pmcm-event-overview.png)

Selected-event workspace overview after accepted inquiry and signed conforme.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-04` | Per-Event File Hub | Prism | Event Planning and Operations |
| `FR-05` | Live Operations Dashboard | Prism | Event Planning and Operations |
| `FR-06` | Event Proposal Compliance Engine | Prism | Event Planning and Operations |
| `FR-58` | Event Briefing Form | Prism | Proposal and Cost Estimation |
| `FR-60` | Proposal Submission and Review Workflow | Prism | Proposal and Cost Estimation |

### PMCM Briefing And Proposal

Screenshot: [screenshots/pmcm-event-briefing.png](screenshots/pmcm-event-briefing.png)

PMCM briefing, proposal, and CE-related planning surface.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-AI-03` | AI Proposal Drafting Assistant | Phase 2 | AI Feature Architecture |
| `FR-AI-09` | Client Communication Intelligence Assistant | Cross | AI Feature Architecture |
| `FR-19` | Cost Estimation Builder | Prism | Proposal and Cost Estimation |
| `FR-58` | Event Briefing Form | Prism | Proposal and Cost Estimation |
| `FR-59` | Canva and PowerPoint Proposal Integration | Phase 2 | Proposal and Cost Estimation |
| `FR-60` | Proposal Submission and Review Workflow | Prism | Proposal and Cost Estimation |
| `FR-61` | Presentation Meeting Scheduler with Zoom Integration | Phase 2 | Proposal and Cost Estimation |
| `FR-62` | Tiered Package Options in CE Builder | Phase 2 | Proposal and Cost Estimation |
| `FR-AI-03` | AI Proposal Drafting Assistant | AI | Proposal and Cost Estimation |
| `FR-AI-09` | Client Communication Intelligence Assistant | AI | Proposal and Cost Estimation |

### PMCM Floorplans

Screenshot: [screenshots/pmcm-event-floorplans.png](screenshots/pmcm-event-floorplans.png)

PMCM-owned official floorplan management.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-08` | Floor Plan Upload and Client Approval Workflow | Prism | Event Planning and Operations |
| `FR-80` | Floor Plan Builder with Draggable Element Library | Prism | Floor Plan Builder |
| `FR-81` | Venue Library | Phase 2 | Floor Plan Builder |
| `FR-82` | Quick Setup Presets | Phase 2 | Floor Plan Builder |
| `FR-83` | Client Floor Plan Annotation and Approval | Prism | Floor Plan Builder |
| `FR-84` | Table Assignment List | Phase 2 | Floor Plan Builder |

### PMCM Suppliers And PARE

Screenshot: [screenshots/pmcm-event-suppliers-pare.png](screenshots/pmcm-event-suppliers-pare.png)

Supplier comparison, assignment, gap handling, and PARE human-approval boundary.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-15` | AI Theme and Moodboard Suggestion Engine | Phase 2 | AI Feature Architecture |
| `FR-AI-04` | Agentic Response Engine — PARE | Ph3-5 | AI Feature Architecture |
| `FR-AI-06` | Probabilistic Supplier Reliability Scoring | Cross | AI Feature Architecture |
| `FR-14` | Supplier Directory with Category Tagging | Prism | Supplier Management |
| `FR-15` | Tier 1 and Tier 2 Supplier Designation | Prism | Supplier Management |
| `FR-16` | Supplier Selection Policy Layer | Phase 2 | Supplier Management |
| `FR-17` | Supplier Quote Request and Comparison | Prism | Supplier Management |
| `FR-18` | Supplier Competitive Bidding Module | Phase 2 | Supplier Management |
| `FR-49` | Confidential Bid Quote Request | Phase 2 | Supplier Management |
| `FR-63` | Supplier Gap Warning | Prism | Supplier Management |
| `FR-64` | Supplier Communication Thread | Phase 2 | Supplier Management |
| `FR-75` | Supplier Formal Assignment Notification | Prism | Supplier Management |
| `FR-76` | Supplier Unresponsive Escalation with Viber Deep Link | Prism | Supplier Management |
| `New-S5` | PMCM Internal Supplier Review | Prism | Supplier Management |
| `FR-AI-06` | Probabilistic Supplier Reliability Scoring Model | AI | Supplier Management |
| `FR-AI-04` | P.R.I.S.M Agentic Response Engine (PARE) — Multi-Agent Emergency Response | Agentic | Supplier Management |
| `FR-49` | Confidential Bid Quote Request | Phase 2 | Supplier Features |
| `FR-64` | Supplier Communication Thread Access | Phase 2 | Supplier Features |
| `FR-AI-04b` | PARE — Supplier Replacement Recommendation (Supplier-Facing Output) | Agentic | Supplier Features |

### PMCM Coordinator Desk

Screenshot: [screenshots/pmcm-event-coordinators.png](screenshots/pmcm-event-coordinators.png)

Coordinator assignment, acknowledgment, and replacement evidence.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-13` | Coordinator Assignment with Role Tagging and Skills Tags | Prism | Event Planning and Operations |
| `FR-88` | Coordinator Double Booking Detection | Prism | Coordinator Management |
| `FR-89` | Coordinator Withdrawal and Replacement | Prism | Coordinator Management |
| `FR-90` | Coordinator Assignment Acknowledgment | Prism | Coordinator Management |
| `New-C1` | Coordinator Role-Specific Portal Views | Prism | Coordinator Management |
| `New-C2` | Event Day System Operator Role Tag | Prism | Coordinator Management |
| `New-C3` | Coordinator Late Arrival and No Show Flag | Prism | Coordinator Management |
| `New-C4` | Task Reassignment with Ms. Mys Notification | Prism | Coordinator Management |
| `FR-90` | Coordinator Assignment Acknowledgment | Prism | Coordinator Features |

### PMCM Live Operations

Screenshot: [screenshots/pmcm-event-live-ops.png](screenshots/pmcm-event-live-ops.png)

Event-day operations, supplier status, coordinator attendance, and urgent issues.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-AI-07` | Real-Time Event Day Copilot | Phase 5 | AI Feature Architecture |
| `FR-AI-07` | Real-Time Event Day Copilot | Agentic | Event Planning and Operations |
| `FR-78` | Ingress and Egress Schedule View | Prism | Supplier Management |
| `FR-79` | Supplier Reliability Notes | Phase 2 | Supplier Management |
| `New-C3` | Coordinator Late Arrival and No Show Flag | Prism | Coordinator Management |
| `New-C4` | Task Reassignment with Ms. Mys Notification | Prism | Coordinator Management |
| `New-SUP1` | Supplier Event Day Status Updates | Prism | Supplier Features |
| `FR-39` | Digital Registration and Masterlist | Prism | Guest Features |
| `FR-95` | Lightweight Digital Registration Module | Prism | Guest Features |

### PMCM Billing And Finance

Screenshot: [screenshots/pmcm-event-billing.png](screenshots/pmcm-event-billing.png)

Billing statement generation and manual payment tracking.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-69` | Flexible Payment Terms Configuration | Phase 2 | Contract and Document Management |
| `FR-20` | Billing Statement Generation | Prism | Financial Management |
| `FR-21` | Post-Event Additional Billing Statement | Prism | Financial Management |
| `FR-92` | Payment Milestone Tracker | Prism | Financial Management |
| `New-P5` | Additional Billing Waiver | Prism | Post-Event and Archive |

### PMCM Closure And Archive

Screenshot: [screenshots/pmcm-event-closure-archive.png](screenshots/pmcm-event-closure-archive.png)

Close gates, post-event documents, insights, and archive readiness.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-AI-08` | Post-Event Intelligence Layer — PEIL | Phase 6 | AI Feature Architecture |
| `FR-22` | Post-Event Documentation Submission Tracker | Prism | Post-Event and Archive |
| `FR-23` | Event Archive with Search | Prism | Post-Event and Archive |
| `New-P1` | Event Comparison View | Phase 2 | Post-Event and Archive |
| `New-P2` | Event Insights Card | Prism | Post-Event and Archive |
| `New-P3` | Client Testimonial Feature | Phase 2 | Post-Event and Archive |
| `New-P5` | Additional Billing Waiver | Prism | Post-Event and Archive |
| `FR-AI-08` | Post-Event Intelligence Layer (PEIL) | AI | Post-Event and Archive |
| `New-SY1` | Post-Event Wrap-Up Screen | Prism | System Configuration and Event Lifecycle |
| `New-SY2` | One-Screen Close | Prism | System Configuration and Event Lifecycle |

### PMCM Audit And Security

Screenshot: [screenshots/pmcm-audit-settings.png](screenshots/pmcm-audit-settings.png)

Audit trail, privacy, and security readiness evidence.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-AI-ZDR` | Zero Data Retention AI Governance Layer | All | AI Feature Architecture |
| `FR-56` | Data Anonymization Tool | Prism | System Configuration and Event Lifecycle |
| `New-SEC1` | Role-Based Authentication and Session Management | Security | Security - Cross-Cutting All Personas and All Phases |
| `New-SEC2` | Data Privacy Compliance Module | Security | Security - Cross-Cutting All Personas and All Phases |
| `New-SEC3` | Secure File Upload Validation | Security | Security - Cross-Cutting All Personas and All Phases |
| `New-SEC4` | Comprehensive Audit Trail and Activity Log | Security | Security - Cross-Cutting All Personas and All Phases |
| `FR-AI-ZDR` | Zero Data Retention AI Governance Layer | Security | Security - Cross-Cutting All Personas and All Phases |

### Supplier Dashboard

Screenshot: [screenshots/supplier-dashboard-overview.png](screenshots/supplier-dashboard-overview.png)

Supplier-scoped quote, booking, readiness, event-day, and profile surface.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-49` | Confidential Bid Quote Request | Phase 2 | Supplier Management |
| `FR-64` | Supplier Communication Thread | Phase 2 | Supplier Management |
| `FR-35` | Supplier Profile with Category Tagging and Tier Designation | Prism | Supplier Features |
| `FR-36` | Quote Submission | Prism | Supplier Features |
| `FR-37` | Event Assignment Confirmation | Prism | Supplier Features |
| `FR-38` | Contract and Terms of Service Upload | Phase 2 | Supplier Features |
| `FR-49` | Confidential Bid Quote Request | Phase 2 | Supplier Features |
| `FR-64` | Supplier Communication Thread Access | Phase 2 | Supplier Features |
| `New-SUP1` | Supplier Event Day Status Updates | Prism | Supplier Features |
| `New-SUP2` | Pre-Event Readiness Confirmation | Prism | Supplier Features |
| `New-SUP3` | Supplier Registration Page | Phase 2 | Supplier Features |
| `New-SUP4` | Supplier Application Status Tracking | Phase 2 | Supplier Features |
| `FR-AI-04b` | PARE — Supplier Replacement Recommendation (Supplier-Facing Output) | Agentic | Supplier Features |

### Supplier Quote Requests

Screenshot: [screenshots/supplier-quote-requests.png](screenshots/supplier-quote-requests.png)

Supplier quote submission and confidential request surface.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-49` | Confidential Bid Quote Request | Phase 2 | Supplier Management |
| `FR-64` | Supplier Communication Thread | Phase 2 | Supplier Management |
| `FR-36` | Quote Submission | Prism | Supplier Features |
| `FR-49` | Confidential Bid Quote Request | Phase 2 | Supplier Features |
| `FR-64` | Supplier Communication Thread Access | Phase 2 | Supplier Features |

### Coordinator Dashboard

Screenshot: [screenshots/coordinator-dashboard.png](screenshots/coordinator-dashboard.png)

Role-safe coordinator portal view.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-90` | Coordinator Assignment Acknowledgment | Prism | Coordinator Management |
| `New-CO1` | Coordinator Portal Homepage | Prism | Coordinator Features |
| `New-CO2` | Floor Director and Stage Director View | Prism | Coordinator Features |
| `New-CO3` | Registration Staff View | Prism | Coordinator Features |
| `New-CO4` | Ingress and Egress Assistant View | Prism | Coordinator Features |
| `New-CO5` | Event Day System Operator View | Prism | Coordinator Features |
| `New-CO6` | Usher and General Coordinator View | Prism | Coordinator Features |
| `FR-90` | Coordinator Assignment Acknowledgment | Prism | Coordinator Features |

### Guest Code Gate

Screenshot: [screenshots/guest-open-code.png](screenshots/guest-open-code.png)

Guest event-code gate before dashboard access.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-39` | Digital Registration and Masterlist | Prism | Guest Features |
| `FR-95` | Lightweight Digital Registration Module | Prism | Guest Features |

### Guest Dashboard

Screenshot: [screenshots/guest-dashboard.png](screenshots/guest-dashboard.png)

Guest pass, check-in, walk-in flagging, and moderated feedback evidence.

| Ref | Feature | Scope | Catalog section |
| --- | --- | --- | --- |
| `FR-39` | Digital Registration and Masterlist | Prism | Guest Features |
| `FR-40` | In-Event Engagement Feature with Game Builder | Phase 2 | Guest Features |
| `FR-41` | Post-Event Experience Upload with Moderation | Phase 2 | Guest Features |
| `FR-95` | Lightweight Digital Registration Module | Prism | Guest Features |
| `New-GU1` | Ticket-Based Event Registration Coordination | Phase 2 | Guest Features |
| `New-EX2` | Post-Event Guest Feedback Page | Phase 2 | External and Public Features |

## Catalog Coverage

Catalog rows parsed: 151
Unique catalog refs: 138
Unique refs with direct screenshot mapping: 108

| Ref | Feature | Scope | Section | Screenshot page(s) | Coverage mode |
| --- | --- | --- | --- | --- | --- |
| `FR-AI-01` | Intelligent Inquiry Triage Agent | Phase 1 | AI Feature Architecture | [PMCM Inquiry And Onboarding](screenshots/pmcm-inquiry-onboarding.png) | Direct |
| `FR-AI-03` | AI Proposal Drafting Assistant | Phase 2 | AI Feature Architecture | [PMCM Briefing And Proposal](screenshots/pmcm-event-briefing.png) | Direct |
| `FR-10+` | Compliance Engine AI Advisory Layer | Ph2+4 | AI Feature Architecture | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png), [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png), [PMCM Audit And Security](screenshots/pmcm-audit-settings.png) | Nearest surface |
| `FR-15` | AI Theme and Moodboard Suggestion Engine | Phase 2 | AI Feature Architecture | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png) | Direct |
| `FR-AI-05` | P.R.I.S.M Operations Assistant — POA Chatbot | All | AI Feature Architecture | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png) | Direct |
| `FR-AI-04` | Agentic Response Engine — PARE | Ph3-5 | AI Feature Architecture | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png) | Direct |
| `FR-AI-06` | Probabilistic Supplier Reliability Scoring | Cross | AI Feature Architecture | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png) | Direct |
| `FR-AI-07` | Real-Time Event Day Copilot | Phase 5 | AI Feature Architecture | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png), [PMCM Live Operations](screenshots/pmcm-event-live-ops.png) | Direct |
| `FR-AI-08` | Post-Event Intelligence Layer — PEIL | Phase 6 | AI Feature Architecture | [PMCM Closure And Archive](screenshots/pmcm-event-closure-archive.png) | Direct |
| `FR-AI-09` | Client Communication Intelligence Assistant | Cross | AI Feature Architecture | [Client Proposal Review](screenshots/client-event-proposal.png), [PMCM Briefing And Proposal](screenshots/pmcm-event-briefing.png) | Direct |
| `FR-AI-ZDR` | Zero Data Retention AI Governance Layer | All | AI Feature Architecture | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png), [PMCM Audit And Security](screenshots/pmcm-audit-settings.png) | Direct |
| `FR-01` | Inquiry Intake Log | Prism | Inquiry and Client Management | [PMCM Inquiry And Onboarding](screenshots/pmcm-inquiry-onboarding.png) | Direct |
| `FR-02` | Client Onboarding Tracker | Prism | Inquiry and Client Management | [PMCM Inquiry And Onboarding](screenshots/pmcm-inquiry-onboarding.png) | Direct |
| `FR-03` | Conforme and MOA Document Storage | Prism | Inquiry and Client Management | [PMCM Inquiry And Onboarding](screenshots/pmcm-inquiry-onboarding.png) | Direct |
| `FR-44` | Organization Merge Tool | Phase 2 | Inquiry and Client Management | [PMCM Inquiry And Onboarding](screenshots/pmcm-inquiry-onboarding.png) | Direct |
| `FR-45` | Referral Details Field | Phase 2 | Inquiry and Client Management | [PMCM Inquiry And Onboarding](screenshots/pmcm-inquiry-onboarding.png) | Direct |
| `FR-52` | Send Inquiry Link and Log on Behalf Tool | Prism | Inquiry and Client Management | [PMCM Inquiry And Onboarding](screenshots/pmcm-inquiry-onboarding.png) | Direct |
| `FR-53` | Pre-Conforme Context Notes Log | Phase 2 | Inquiry and Client Management | [PMCM Inquiry And Onboarding](screenshots/pmcm-inquiry-onboarding.png) | Direct |
| `FR-54` | Pre-Conforme Document Attachment | Phase 2 | Inquiry and Client Management | [PMCM Inquiry And Onboarding](screenshots/pmcm-inquiry-onboarding.png) | Direct |
| `FR-AI-01` | Intelligent Inquiry Triage Agent | Agentic | Inquiry and Client Management | [PMCM Inquiry And Onboarding](screenshots/pmcm-inquiry-onboarding.png) | Direct |
| `FR-04` | Per-Event File Hub | Prism | Event Planning and Operations | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png), [PMCM Event Workspace Overview](screenshots/pmcm-event-overview.png) | Direct |
| `FR-05` | Live Operations Dashboard | Prism | Event Planning and Operations | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png), [PMCM Event Workspace Overview](screenshots/pmcm-event-overview.png) | Direct |
| `FR-06` | Event Proposal Compliance Engine | Prism | Event Planning and Operations | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png), [PMCM Event Workspace Overview](screenshots/pmcm-event-overview.png) | Direct |
| `FR-07` | Risk Management Assessment | Phase 2 | Event Planning and Operations | [PMCM Event Workspace Overview](screenshots/pmcm-event-overview.png), [PMCM Briefing And Proposal](screenshots/pmcm-event-briefing.png), [PMCM Live Operations](screenshots/pmcm-event-live-ops.png) | Nearest / roadmap |
| `FR-08` | Floor Plan Upload and Client Approval Workflow | Prism | Event Planning and Operations | [Client Event Floorplan](screenshots/client-event-floorplan.png), [PMCM Floorplans](screenshots/pmcm-event-floorplans.png) | Direct |
| `FR-09` | Venue Styling Moodboard Upload and Client Approval Workflow | Phase 2 | Event Planning and Operations | [PMCM Event Workspace Overview](screenshots/pmcm-event-overview.png), [PMCM Briefing And Proposal](screenshots/pmcm-event-briefing.png), [PMCM Live Operations](screenshots/pmcm-event-live-ops.png) | Nearest / roadmap |
| `FR-10` | Venue Scouting Module | Phase 2 | Event Planning and Operations | [PMCM Event Workspace Overview](screenshots/pmcm-event-overview.png), [PMCM Briefing And Proposal](screenshots/pmcm-event-briefing.png), [PMCM Live Operations](screenshots/pmcm-event-live-ops.png) | Nearest / roadmap |
| `FR-11` | AI Theme and Moodboard Suggestion Engine | AI | Event Planning and Operations | [PMCM Event Workspace Overview](screenshots/pmcm-event-overview.png), [PMCM Briefing And Proposal](screenshots/pmcm-event-briefing.png), [PMCM Live Operations](screenshots/pmcm-event-live-ops.png) | Nearest / roadmap |
| `FR-12` | EOD Report Inbox Per Event | Phase 2 | Event Planning and Operations | [PMCM Event Workspace Overview](screenshots/pmcm-event-overview.png), [PMCM Briefing And Proposal](screenshots/pmcm-event-briefing.png), [PMCM Live Operations](screenshots/pmcm-event-live-ops.png) | Nearest / roadmap |
| `FR-13` | Coordinator Assignment with Role Tagging and Skills Tags | Prism | Event Planning and Operations | [PMCM Coordinator Desk](screenshots/pmcm-event-coordinators.png) | Direct |
| `FR-43` | Bid Workspace | Phase 2 | Event Planning and Operations | [PMCM Event Workspace Overview](screenshots/pmcm-event-overview.png), [PMCM Briefing And Proposal](screenshots/pmcm-event-briefing.png), [PMCM Live Operations](screenshots/pmcm-event-live-ops.png) | Nearest / roadmap |
| `FR-AI-05` | P.R.I.S.M Operations Assistant (POA) — Caged Claude Chatbot | AI | Event Planning and Operations | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png) | Direct |
| `FR-AI-07` | Real-Time Event Day Copilot | Agentic | Event Planning and Operations | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png), [PMCM Live Operations](screenshots/pmcm-event-live-ops.png) | Direct |
| `FR-19` | Cost Estimation Builder | Prism | Proposal and Cost Estimation | [PMCM Briefing And Proposal](screenshots/pmcm-event-briefing.png) | Direct |
| `FR-58` | Event Briefing Form | Prism | Proposal and Cost Estimation | [Client Proposal Review](screenshots/client-event-proposal.png), [PMCM Event Workspace Overview](screenshots/pmcm-event-overview.png), [PMCM Briefing And Proposal](screenshots/pmcm-event-briefing.png) | Direct |
| `FR-59` | Canva and PowerPoint Proposal Integration | Phase 2 | Proposal and Cost Estimation | [PMCM Briefing And Proposal](screenshots/pmcm-event-briefing.png) | Direct |
| `FR-60` | Proposal Submission and Review Workflow | Prism | Proposal and Cost Estimation | [Client Proposal Review](screenshots/client-event-proposal.png), [PMCM Event Workspace Overview](screenshots/pmcm-event-overview.png), [PMCM Briefing And Proposal](screenshots/pmcm-event-briefing.png) | Direct |
| `FR-61` | Presentation Meeting Scheduler with Zoom Integration | Phase 2 | Proposal and Cost Estimation | [PMCM Briefing And Proposal](screenshots/pmcm-event-briefing.png) | Direct |
| `FR-62` | Tiered Package Options in CE Builder | Phase 2 | Proposal and Cost Estimation | [PMCM Briefing And Proposal](screenshots/pmcm-event-briefing.png) | Direct |
| `FR-AI-03` | AI Proposal Drafting Assistant | AI | Proposal and Cost Estimation | [PMCM Briefing And Proposal](screenshots/pmcm-event-briefing.png) | Direct |
| `FR-AI-09` | Client Communication Intelligence Assistant | AI | Proposal and Cost Estimation | [Client Proposal Review](screenshots/client-event-proposal.png), [PMCM Briefing And Proposal](screenshots/pmcm-event-briefing.png) | Direct |
| `FR-67` | Document Template Pre-Fill System | Phase 2 | Contract and Document Management | [PMCM Billing And Finance](screenshots/pmcm-event-billing.png), [Client Billing And Documents](screenshots/client-event-billing-documents.png) | Nearest / roadmap |
| `FR-68` | Dual Signing Path | Phase 2 | Contract and Document Management | [PMCM Billing And Finance](screenshots/pmcm-event-billing.png), [Client Billing And Documents](screenshots/client-event-billing-documents.png) | Nearest / roadmap |
| `FR-69` | Flexible Payment Terms Configuration | Phase 2 | Contract and Document Management | [PMCM Billing And Finance](screenshots/pmcm-event-billing.png) | Direct |
| `FR-70` | Accreditation Document Tracker | Phase 2 | Contract and Document Management | [PMCM Billing And Finance](screenshots/pmcm-event-billing.png), [Client Billing And Documents](screenshots/client-event-billing-documents.png) | Nearest / roadmap |
| `FR-96` | Event Cancellation Workflow | Prism | Contract and Document Management | [PMCM Billing And Finance](screenshots/pmcm-event-billing.png), [Client Billing And Documents](screenshots/client-event-billing-documents.png) | Nearest surface |
| `FR-97` | Event Postponement Workflow | Prism | Contract and Document Management | [PMCM Billing And Finance](screenshots/pmcm-event-billing.png), [Client Billing And Documents](screenshots/client-event-billing-documents.png) | Nearest surface |
| `FR-14` | Supplier Directory with Category Tagging | Prism | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png) | Direct |
| `FR-15` | Tier 1 and Tier 2 Supplier Designation | Prism | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png) | Direct |
| `FR-16` | Supplier Selection Policy Layer | Phase 2 | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png) | Direct |
| `FR-17` | Supplier Quote Request and Comparison | Prism | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png) | Direct |
| `FR-18` | Supplier Competitive Bidding Module | Phase 2 | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png) | Direct |
| `FR-49` | Confidential Bid Quote Request | Phase 2 | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png), [Supplier Dashboard](screenshots/supplier-dashboard-overview.png), [Supplier Quote Requests](screenshots/supplier-quote-requests.png) | Direct |
| `FR-63` | Supplier Gap Warning | Prism | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png) | Direct |
| `FR-64` | Supplier Communication Thread | Phase 2 | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png), [Supplier Dashboard](screenshots/supplier-dashboard-overview.png), [Supplier Quote Requests](screenshots/supplier-quote-requests.png) | Direct |
| `FR-75` | Supplier Formal Assignment Notification | Prism | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png) | Direct |
| `FR-76` | Supplier Unresponsive Escalation with Viber Deep Link | Prism | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png) | Direct |
| `FR-77` | Supplier Contract Mismatch Warning | Phase 2 | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png), [Supplier Dashboard](screenshots/supplier-dashboard-overview.png) | Nearest / roadmap |
| `FR-78` | Ingress and Egress Schedule View | Prism | Supplier Management | [PMCM Live Operations](screenshots/pmcm-event-live-ops.png) | Direct |
| `FR-79` | Supplier Reliability Notes | Phase 2 | Supplier Management | [PMCM Live Operations](screenshots/pmcm-event-live-ops.png) | Direct |
| `FR-87` | Outsourced Creative Designer Sub-Ticket | Phase 2 | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png), [Supplier Dashboard](screenshots/supplier-dashboard-overview.png) | Nearest / roadmap |
| `New-S1` | Supplier Registration Page | Phase 2 | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png), [Supplier Dashboard](screenshots/supplier-dashboard-overview.png) | Nearest / roadmap |
| `New-S2` | Supplier Applications Inbox | Phase 2 | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png), [Supplier Dashboard](screenshots/supplier-dashboard-overview.png) | Nearest / roadmap |
| `New-S3` | Pending First Event Status | Phase 2 | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png), [Supplier Dashboard](screenshots/supplier-dashboard-overview.png) | Nearest / roadmap |
| `New-S4` | Supplier Performance Assessment | Phase 2 | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png), [Supplier Dashboard](screenshots/supplier-dashboard-overview.png) | Nearest / roadmap |
| `New-S5` | PMCM Internal Supplier Review | Prism | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png) | Direct |
| `FR-AI-06` | Probabilistic Supplier Reliability Scoring Model | AI | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png) | Direct |
| `FR-AI-04` | P.R.I.S.M Agentic Response Engine (PARE) — Multi-Agent Emergency Response | Agentic | Supplier Management | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png) | Direct |
| `FR-20` | Billing Statement Generation | Prism | Financial Management | [PMCM Billing And Finance](screenshots/pmcm-event-billing.png) | Direct |
| `FR-21` | Post-Event Additional Billing Statement | Prism | Financial Management | [PMCM Billing And Finance](screenshots/pmcm-event-billing.png) | Direct |
| `FR-92` | Payment Milestone Tracker | Prism | Financial Management | [Client Billing And Documents](screenshots/client-event-billing-documents.png), [PMCM Billing And Finance](screenshots/pmcm-event-billing.png) | Direct |
| `FR-93` | Partial Payment Recording | Phase 2 | Financial Management | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png) | Nearest / roadmap |
| `FR-94` | Billing Statement to Proposal Link | Phase 2 | Financial Management | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png) | Nearest / roadmap |
| `FR-80` | Floor Plan Builder with Draggable Element Library | Prism | Floor Plan Builder | [PMCM Floorplans](screenshots/pmcm-event-floorplans.png) | Direct |
| `FR-81` | Venue Library | Phase 2 | Floor Plan Builder | [PMCM Floorplans](screenshots/pmcm-event-floorplans.png) | Direct |
| `FR-82` | Quick Setup Presets | Phase 2 | Floor Plan Builder | [PMCM Floorplans](screenshots/pmcm-event-floorplans.png) | Direct |
| `FR-83` | Client Floor Plan Annotation and Approval | Prism | Floor Plan Builder | [Client Event Floorplan](screenshots/client-event-floorplan.png), [PMCM Floorplans](screenshots/pmcm-event-floorplans.png) | Direct |
| `FR-84` | Table Assignment List | Phase 2 | Floor Plan Builder | [PMCM Floorplans](screenshots/pmcm-event-floorplans.png) | Direct |
| `FR-88` | Coordinator Double Booking Detection | Prism | Coordinator Management | [PMCM Coordinator Desk](screenshots/pmcm-event-coordinators.png) | Direct |
| `FR-89` | Coordinator Withdrawal and Replacement | Prism | Coordinator Management | [PMCM Coordinator Desk](screenshots/pmcm-event-coordinators.png) | Direct |
| `FR-90` | Coordinator Assignment Acknowledgment | Prism | Coordinator Management | [PMCM Coordinator Desk](screenshots/pmcm-event-coordinators.png), [Coordinator Dashboard](screenshots/coordinator-dashboard.png) | Direct |
| `FR-91` | Coordinator Availability and Staffing View | Phase 2 | Coordinator Management | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png) | Nearest / roadmap |
| `New-C1` | Coordinator Role-Specific Portal Views | Prism | Coordinator Management | [PMCM Coordinator Desk](screenshots/pmcm-event-coordinators.png) | Direct |
| `New-C2` | Event Day System Operator Role Tag | Prism | Coordinator Management | [PMCM Coordinator Desk](screenshots/pmcm-event-coordinators.png) | Direct |
| `New-C3` | Coordinator Late Arrival and No Show Flag | Prism | Coordinator Management | [PMCM Coordinator Desk](screenshots/pmcm-event-coordinators.png), [PMCM Live Operations](screenshots/pmcm-event-live-ops.png) | Direct |
| `New-C4` | Task Reassignment with Ms. Mys Notification | Prism | Coordinator Management | [PMCM Coordinator Desk](screenshots/pmcm-event-coordinators.png), [PMCM Live Operations](screenshots/pmcm-event-live-ops.png) | Direct |
| `FR-22` | Post-Event Documentation Submission Tracker | Prism | Post-Event and Archive | [PMCM Closure And Archive](screenshots/pmcm-event-closure-archive.png) | Direct |
| `FR-23` | Event Archive with Search | Prism | Post-Event and Archive | [PMCM Closure And Archive](screenshots/pmcm-event-closure-archive.png) | Direct |
| `New-P1` | Event Comparison View | Phase 2 | Post-Event and Archive | [PMCM Closure And Archive](screenshots/pmcm-event-closure-archive.png) | Direct |
| `New-P2` | Event Insights Card | Prism | Post-Event and Archive | [PMCM Closure And Archive](screenshots/pmcm-event-closure-archive.png) | Direct |
| `New-P3` | Client Testimonial Feature | Phase 2 | Post-Event and Archive | [PMCM Closure And Archive](screenshots/pmcm-event-closure-archive.png) | Direct |
| `New-P4` | Logistics Booking Record | Phase 2 | Post-Event and Archive | [PMCM Closure And Archive](screenshots/pmcm-event-closure-archive.png) | Nearest / roadmap |
| `New-P5` | Additional Billing Waiver | Prism | Post-Event and Archive | [PMCM Billing And Finance](screenshots/pmcm-event-billing.png), [PMCM Closure And Archive](screenshots/pmcm-event-closure-archive.png) | Direct |
| `FR-AI-08` | Post-Event Intelligence Layer (PEIL) | AI | Post-Event and Archive | [PMCM Closure And Archive](screenshots/pmcm-event-closure-archive.png) | Direct |
| `FR-24` | Toggle System | Phase 2 | System Configuration and Event Lifecycle | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png), [PMCM Closure And Archive](screenshots/pmcm-event-closure-archive.png), [PMCM Audit And Security](screenshots/pmcm-audit-settings.png) | Nearest / roadmap |
| `FR-25` | Dual Notification System | Prism | System Configuration and Event Lifecycle | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png) | Direct |
| `FR-55` | Bilingual Notification Email Templates | Phase 2 | System Configuration and Event Lifecycle | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png), [PMCM Closure And Archive](screenshots/pmcm-event-closure-archive.png), [PMCM Audit And Security](screenshots/pmcm-audit-settings.png) | Nearest / roadmap |
| `FR-56` | Data Anonymization Tool | Prism | System Configuration and Event Lifecycle | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png), [PMCM Audit And Security](screenshots/pmcm-audit-settings.png) | Direct |
| `New-SY1` | Post-Event Wrap-Up Screen | Prism | System Configuration and Event Lifecycle | [PMCM Closure And Archive](screenshots/pmcm-event-closure-archive.png) | Direct |
| `New-SY2` | One-Screen Close | Prism | System Configuration and Event Lifecycle | [PMCM Closure And Archive](screenshots/pmcm-event-closure-archive.png) | Direct |
| `New-SY3` | Change Freeze Deadline | Prism | System Configuration and Event Lifecycle | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png) | Direct |
| `New-SY4` | Addendum Conforme Workflow | Phase 2 | System Configuration and Event Lifecycle | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png), [PMCM Closure And Archive](screenshots/pmcm-event-closure-archive.png), [PMCM Audit And Security](screenshots/pmcm-audit-settings.png) | Nearest / roadmap |
| `New-SEC1` | Role-Based Authentication and Session Management | Security | Security - Cross-Cutting All Personas and All Phases | [Client Sign-In Gate](screenshots/client-sign-in.png), [PMCM Audit And Security](screenshots/pmcm-audit-settings.png) | Direct |
| `New-SEC2` | Data Privacy Compliance Module | Security | Security - Cross-Cutting All Personas and All Phases | [PMCM Audit And Security](screenshots/pmcm-audit-settings.png) | Direct |
| `New-SEC3` | Secure File Upload Validation | Security | Security - Cross-Cutting All Personas and All Phases | [PMCM Audit And Security](screenshots/pmcm-audit-settings.png) | Direct |
| `New-SEC4` | Comprehensive Audit Trail and Activity Log | Security | Security - Cross-Cutting All Personas and All Phases | [PMCM Audit And Security](screenshots/pmcm-audit-settings.png) | Direct |
| `FR-AI-ZDR` | Zero Data Retention AI Governance Layer | Security | Security - Cross-Cutting All Personas and All Phases | [PMCM Command Dashboard](screenshots/pmcm-command-dashboard.png), [PMCM Audit And Security](screenshots/pmcm-audit-settings.png) | Direct |
| `FR-26` | Client Portal Access Gated by Signed Conforme | Prism | Client Features | [Client Public Landing](screenshots/client-public-landing.png), [Client Sign-In Gate](screenshots/client-sign-in.png), [Client Dashboard Overview](screenshots/client-dashboard-overview.png) | Direct |
| `FR-27` | Event Progress Visibility | Prism | Client Features | [Client Dashboard Overview](screenshots/client-dashboard-overview.png) | Direct |
| `FR-28` | Client Draft Floor Plan Submission | Phase 2 | Client Features | [Client Event Floorplan](screenshots/client-event-floorplan.png) | Direct |
| `FR-29` | Official Floor Plan Viewing and Formal Approval | Prism | Client Features | [Client Event Floorplan](screenshots/client-event-floorplan.png) | Direct |
| `FR-30` | Venue Styling Moodboard Viewing and Formal Approval | Phase 2 | Client Features | [Client Dashboard Overview](screenshots/client-dashboard-overview.png), [Client Event Floorplan](screenshots/client-event-floorplan.png), [Client Billing And Documents](screenshots/client-event-billing-documents.png) | Nearest / roadmap |
| `FR-31` | Budget Confirmation Module for Venue Styling | Phase 2 | Client Features | [Client Dashboard Overview](screenshots/client-dashboard-overview.png), [Client Event Floorplan](screenshots/client-event-floorplan.png), [Client Billing And Documents](screenshots/client-event-billing-documents.png) | Nearest / roadmap |
| `FR-32` | Document Submission Portal | Prism | Client Features | [Client Billing And Documents](screenshots/client-event-billing-documents.png) | Direct |
| `FR-33` | Per-Event File Hub Access | Prism | Client Features | [Client Billing And Documents](screenshots/client-event-billing-documents.png) | Direct |
| `FR-34` | Notification of Task and Milestone Updates | Prism | Client Features | [Client Dashboard Overview](screenshots/client-dashboard-overview.png), [Client Billing And Documents](screenshots/client-event-billing-documents.png) | Direct |
| `FR-65` | Client-Owned Supplier Sub-Ticket | Phase 2 | Client Features | [Client Dashboard Overview](screenshots/client-dashboard-overview.png), [Client Event Floorplan](screenshots/client-event-floorplan.png), [Client Billing And Documents](screenshots/client-event-billing-documents.png) | Nearest / roadmap |
| `FR-66` | Venue Ocular Task Trigger | Phase 2 | Client Features | [Client Dashboard Overview](screenshots/client-dashboard-overview.png), [Client Event Floorplan](screenshots/client-event-floorplan.png), [Client Billing And Documents](screenshots/client-event-billing-documents.png) | Nearest / roadmap |
| `New-CL1` | Walk-In Policy Setting | Prism | Client Features | [Client Dashboard Overview](screenshots/client-dashboard-overview.png) | Direct |
| `New-CL2` | Event Day Limited View | Phase 2 | Client Features | [Client Dashboard Overview](screenshots/client-dashboard-overview.png) | Direct |
| `FR-35` | Supplier Profile with Category Tagging and Tier Designation | Prism | Supplier Features | [Supplier Dashboard](screenshots/supplier-dashboard-overview.png) | Direct |
| `FR-36` | Quote Submission | Prism | Supplier Features | [Supplier Dashboard](screenshots/supplier-dashboard-overview.png), [Supplier Quote Requests](screenshots/supplier-quote-requests.png) | Direct |
| `FR-37` | Event Assignment Confirmation | Prism | Supplier Features | [Supplier Dashboard](screenshots/supplier-dashboard-overview.png) | Direct |
| `FR-38` | Contract and Terms of Service Upload | Phase 2 | Supplier Features | [Supplier Dashboard](screenshots/supplier-dashboard-overview.png) | Direct |
| `FR-49` | Confidential Bid Quote Request | Phase 2 | Supplier Features | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png), [Supplier Dashboard](screenshots/supplier-dashboard-overview.png), [Supplier Quote Requests](screenshots/supplier-quote-requests.png) | Direct |
| `FR-64` | Supplier Communication Thread Access | Phase 2 | Supplier Features | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png), [Supplier Dashboard](screenshots/supplier-dashboard-overview.png), [Supplier Quote Requests](screenshots/supplier-quote-requests.png) | Direct |
| `New-SUP1` | Supplier Event Day Status Updates | Prism | Supplier Features | [PMCM Live Operations](screenshots/pmcm-event-live-ops.png), [Supplier Dashboard](screenshots/supplier-dashboard-overview.png) | Direct |
| `New-SUP2` | Pre-Event Readiness Confirmation | Prism | Supplier Features | [Supplier Dashboard](screenshots/supplier-dashboard-overview.png) | Direct |
| `New-SUP3` | Supplier Registration Page | Phase 2 | Supplier Features | [Supplier Dashboard](screenshots/supplier-dashboard-overview.png) | Direct |
| `New-SUP4` | Supplier Application Status Tracking | Phase 2 | Supplier Features | [Supplier Dashboard](screenshots/supplier-dashboard-overview.png) | Direct |
| `FR-AI-04b` | PARE — Supplier Replacement Recommendation (Supplier-Facing Output) | Agentic | Supplier Features | [PMCM Suppliers And PARE](screenshots/pmcm-event-suppliers-pare.png), [Supplier Dashboard](screenshots/supplier-dashboard-overview.png) | Direct |
| `New-CO1` | Coordinator Portal Homepage | Prism | Coordinator Features | [Coordinator Dashboard](screenshots/coordinator-dashboard.png) | Direct |
| `New-CO2` | Floor Director and Stage Director View | Prism | Coordinator Features | [Coordinator Dashboard](screenshots/coordinator-dashboard.png) | Direct |
| `New-CO3` | Registration Staff View | Prism | Coordinator Features | [Coordinator Dashboard](screenshots/coordinator-dashboard.png) | Direct |
| `New-CO4` | Ingress and Egress Assistant View | Prism | Coordinator Features | [Coordinator Dashboard](screenshots/coordinator-dashboard.png) | Direct |
| `New-CO5` | Event Day System Operator View | Prism | Coordinator Features | [Coordinator Dashboard](screenshots/coordinator-dashboard.png) | Direct |
| `New-CO6` | Usher and General Coordinator View | Prism | Coordinator Features | [Coordinator Dashboard](screenshots/coordinator-dashboard.png) | Direct |
| `FR-90` | Coordinator Assignment Acknowledgment | Prism | Coordinator Features | [PMCM Coordinator Desk](screenshots/pmcm-event-coordinators.png), [Coordinator Dashboard](screenshots/coordinator-dashboard.png) | Direct |
| `FR-39` | Digital Registration and Masterlist | Prism | Guest Features | [PMCM Live Operations](screenshots/pmcm-event-live-ops.png), [Guest Code Gate](screenshots/guest-open-code.png), [Guest Dashboard](screenshots/guest-dashboard.png) | Direct |
| `FR-40` | In-Event Engagement Feature with Game Builder | Phase 2 | Guest Features | [Guest Dashboard](screenshots/guest-dashboard.png) | Direct |
| `FR-41` | Post-Event Experience Upload with Moderation | Phase 2 | Guest Features | [Guest Dashboard](screenshots/guest-dashboard.png) | Direct |
| `FR-95` | Lightweight Digital Registration Module | Prism | Guest Features | [PMCM Live Operations](screenshots/pmcm-event-live-ops.png), [Guest Code Gate](screenshots/guest-open-code.png), [Guest Dashboard](screenshots/guest-dashboard.png) | Direct |
| `New-GU1` | Ticket-Based Event Registration Coordination | Phase 2 | Guest Features | [Guest Dashboard](screenshots/guest-dashboard.png) | Direct |
| `FR-42` | Guest Pass Promotional Demo | External | External and Public Features | [Client Public Landing](screenshots/client-public-landing.png) | Direct |
| `FR-46` | P.R.I.S.M Public Inquiry Page | Prism | External and Public Features | [Client Public Landing](screenshots/client-public-landing.png), [Public Inquiry Form](screenshots/client-public-inquiry.png) | Direct |
| `FR-47` | Lightweight Spatial Preference Form | Phase 2 | External and Public Features | [Public Inquiry Form](screenshots/client-public-inquiry.png) | Direct |
| `FR-48` | Referral Source Dropdown | Prism | External and Public Features | [Public Inquiry Form](screenshots/client-public-inquiry.png) | Direct |
| `FR-50` | Abandoned Inquiry Draft Save with Edit Window | Phase 2 | External and Public Features | [Public Inquiry Form](screenshots/client-public-inquiry.png) | Direct |
| `FR-51` | Client Type Field | Prism | External and Public Features | [Public Inquiry Form](screenshots/client-public-inquiry.png) | Direct |
| `New-EX1` | Supplier Registration Page (Public-Facing) | Phase 2 | External and Public Features | [Client Public Landing](screenshots/client-public-landing.png), [Public Inquiry Form](screenshots/client-public-inquiry.png), [Guest Code Gate](screenshots/guest-open-code.png) | Nearest / roadmap |
| `New-EX2` | Post-Event Guest Feedback Page | Phase 2 | External and Public Features | [Guest Dashboard](screenshots/guest-dashboard.png) | Direct |

## Notes

- `Direct` means the feature ref is intentionally assigned to that screenshot page in the capture manifest.
- `Nearest surface` means the feature is in the catalog but does not have a one-feature route; the index points to the closest current page for that persona/workflow.
- `Nearest / roadmap` is used for Phase 2 or live-AI catalog items whose current Prism evidence is a designed surface, data model, governance boundary, or roadmap view rather than live production behavior.
