# P.R.I.S.M Prism Defense Sample Guide

Use one seeded event story from first inquiry to post-event archive. The goal is to prove the operating system flow, then use the catalog and implementation plan for deeper questions.

For current live/partial/prototype status, use `07-implemented-feature-revisions.md`. Do not present a catalog feature as fully implemented just because it appears in the complete feature list. Live-sample only the surfaces that are connected in the current apps; use roadmap evidence for the rest.

## Current Sample Status Rules

| Rule | Meaning |
| --- | --- |
| One event story first | Keep the defense on one seeded lifecycle: inquiry, conforme, briefing/proposal, planning, event day, closure/archive. |
| Role-specific apps | Use `apps/event` for PMCM/coordinator command, `apps/client` for client portal, `apps/supplier` for supplier portal, and `apps/guest` for guest access. |
| Public-only landing | Public navigation should show landing and inquiry only. Dashboards are signed-in surfaces. |
| Revision honesty | If a feature is partial or prototype in `07-implemented-feature-revisions.md`, describe the working portion and the revision needed. |
| AI safety | AI outputs are drafts/recommendations only. Show sanitized sample data, audit evidence, and PMCM human approval. |

## Seed Scenario
| Seed item | Required setup |
| --- | --- |
| Client | A corporate client submits an event inquiry for a medium-scale company celebration. |
| Event | One active event with date, venue, attendee count, supplier categories, proposal, floor plan, billing, coordinator team, and guest list. |
| PMCM Admin | Ms. Mys or Executive Assistant account with full admin permissions. |
| Supplier | At least two suppliers in one category so quote comparison and tier fallback can be shown. |
| Coordinator | One coordinator available and one conflicting assignment to prove double-booking detection. |
| Guest | A small masterlist with QR/name-based check-in and one walk-in verification case. |
| AI | Use sanitized sample data only; show AI outputs as drafts requiring approval. |

## Main Live Sample Script
| Step | Sample moment | Action | Feature refs | Expected proof |
| --- | --- | --- | --- | --- |
| 1 | Public inquiry | Open public inquiry page, submit structured inquiry with referral source. | FR-46, FR-48, FR-01 | Inquiry ticket appears in admin queue. |
| 2 | Admin triage and onboarding | Open inquiry, show status, duplicate/rejected flags if seeded, accept inquiry and start onboarding. | FR-01, FR-02, FR-44, FR-45, FR-52, FR-AI-01 | Client record and onboarding tracker update. |
| 3 | Conforme gate | Show conforme/MOA storage and explain portal is gated until signed conforme is uploaded. | FR-03, FR-26 | Client portal access becomes active only after signed conforme. |
| 4 | Event workspace | Open event file hub and live operations dashboard. | FR-04, FR-05 | Files, tasks, approvals, milestones, and alerts are centralized. |
| 5 | Compliance and risk | Run or show readiness/compliance report and override/audit note if needed. | FR-06, FR-10, FR-43 | Must-fix/watch-out items are visible and logged. |
| 6 | Supplier quote flow | Show supplier directory, quote request, supplier quote submission, and comparison. | FR-14, FR-15, FR-17, FR-35, FR-36 | PMCM can compare quotes and choose supplier. |
| 7 | Cost estimate and proposal | Open CE builder, show budget alignment, upload or review proposal, client comments/approval. | FR-19, FR-58, FR-60, FR-61, FR-62 | Proposal status and revision round update. |
| 8 | Floor plan | Open floor plan builder, place elements, show client annotation/approval state. | FR-80, FR-83, FR-29 | Floor plan is editable by PMCM and lockable after approval. |
| 9 | Coordinator assignment | Assign coordinator, trigger double-booking detection, request acknowledgment. | FR-88, FR-90, New-CO1, New-CO2 | Conflicting assignment is blocked and acknowledgment is tracked. |
| 10 | Guest registration | Open guest registration/check-in, check in a guest, add or flag a walk-in. | FR-39, FR-95, New-CO3 | Attendance count updates in real time. |
| 11 | Billing | Show billing statement, payment milestone, overdue/at-risk status, and additional billing link if seeded. | FR-20, FR-21, FR-92 | Billing is connected to conforme, proposal, and urgent issues. |
| 12 | Post-event archive | Show documentation tracker, archive search, event insights, and supplier review. | FR-22, FR-23, New-P2, New-P4, FR-AI-08 | Completed event is searchable and reusable for future planning. |

## Feature Sample Matrix
| FR # | Feature | Persona | Scope | How to sample | Fallback evidence |
| --- | --- | --- | --- | --- | --- |
| FR-01 | Inquiry Intake Log | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-02 | Client Onboarding Tracker | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-03 | Conforme and MOA Document Storage | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-44 | Organization Merge Tool | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-45 | Referral Details Field | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-52 | Send Inquiry Link and Log on Behalf Tool | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-53 | Pre-Conforme Context Notes Log | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-54 | Pre-Conforme Document Attachment | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-AI-01 | Intelligent Inquiry Triage Agent | PMCM Admin | Agentic | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. | Sanitized prompt sample, generated draft, blocked/approved audit row. |
| FR-04 | Per-Event File Hub | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-05 | Live Operations Dashboard | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-06 | Event Proposal Compliance Engine | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-07 | Risk Management Assessment | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-08 | Floor Plan Upload and Client Approval Workflow | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-09 | Venue Styling Moodboard Upload and Client Approval Workflow | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-10 | Venue Scouting Module | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-11 | AI Theme and Moodboard Suggestion Engine | PMCM Admin | AI | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. | Sanitized prompt sample, generated draft, blocked/approved audit row. |
| FR-12 | EOD Report Inbox Per Event | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-13 | Coordinator Assignment with Role Tagging and Skills Tags | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-43 | Bid Workspace | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-AI-05 | P.R.I.S.M Operations Assistant (POA) — Caged Claude Chatbot | PMCM Admin | AI | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. | Sanitized prompt sample, generated draft, blocked/approved audit row. |
| FR-AI-07 | Real-Time Event Day Copilot | PMCM Admin | Agentic | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. | Sanitized prompt sample, generated draft, blocked/approved audit row. |
| FR-19 | Cost Estimation Builder | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-58 | Event Briefing Form | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-59 | Canva and PowerPoint Proposal Integration | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-60 | Proposal Submission and Review Workflow | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-61 | Presentation Meeting Scheduler with Zoom Integration | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-62 | Tiered Package Options in CE Builder | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-AI-03 | AI Proposal Drafting Assistant | PMCM Admin | AI | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. | Sanitized prompt sample, generated draft, blocked/approved audit row. |
| FR-AI-09 | Client Communication Intelligence Assistant | PMCM Admin | AI | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. | Sanitized prompt sample, generated draft, blocked/approved audit row. |
| FR-67 | Document Template Pre-Fill System | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-68 | Dual Signing Path | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-69 | Flexible Payment Terms Configuration | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-70 | Accreditation Document Tracker | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-96 | Event Cancellation Workflow | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-97 | Event Postponement Workflow | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-14 | Supplier Directory with Category Tagging | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-15 | Tier 1 and Tier 2 Supplier Designation | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-16 | Supplier Selection Policy Layer | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-17 | Supplier Quote Request and Comparison | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-18 | Supplier Competitive Bidding Module | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-49 | Confidential Bid Quote Request | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-63 | Supplier Gap Warning | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-64 | Supplier Communication Thread | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-75 | Supplier Formal Assignment Notification | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-76 | Supplier Unresponsive Escalation with Viber Deep Link | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-77 | Supplier Contract Mismatch Warning | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-78 | Ingress and Egress Schedule View | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-79 | Supplier Reliability Notes | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-87 | Outsourced Creative Designer Sub-Ticket | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| New-S1 | Supplier Registration Page | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| New-S2 | Supplier Applications Inbox | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| New-S3 | Pending First Event Status | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| New-S4 | Supplier Performance Assessment | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| New-S5 | PMCM Internal Supplier Review | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-AI-06 | Probabilistic Supplier Reliability Scoring Model | PMCM Admin | AI | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. | Sanitized prompt sample, generated draft, blocked/approved audit row. |
| FR-AI-04 | P.R.I.S.M Agentic Response Engine (PARE) — Multi-Agent Emergency Response | PMCM Admin | Agentic | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. | Sanitized prompt sample, generated draft, blocked/approved audit row. |
| FR-20 | Billing Statement Generation | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-21 | Post-Event Additional Billing Statement | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-92 | Payment Milestone Tracker | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-93 | Partial Payment Recording | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-94 | Billing Statement to Proposal Link | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-80 | Floor Plan Builder with Draggable Element Library | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-81 | Venue Library | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-82 | Quick Setup Presets | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-83 | Client Floor Plan Annotation and Approval | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-84 | Table Assignment List | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-88 | Coordinator Double Booking Detection | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-89 | Coordinator Withdrawal and Replacement | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-90 | Coordinator Assignment Acknowledgment | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-91 | Coordinator Availability and Staffing View | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| New-C1 | Coordinator Role-Specific Portal Views | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-C2 | Event Day System Operator Role Tag | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-C3 | Coordinator Late Arrival and No Show Flag | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-C4 | Task Reassignment with Ms. Mys Notification | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-22 | Post-Event Documentation Submission Tracker | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-23 | Event Archive with Search | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-P1 | Event Comparison View | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| New-P2 | Event Insights Card | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-P3 | Client Testimonial Feature | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| New-P4 | Logistics Booking Record | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| New-P5 | Additional Billing Waiver | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-AI-08 | Post-Event Intelligence Layer (PEIL) | PMCM Admin | AI | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. | Sanitized prompt sample, generated draft, blocked/approved audit row. |
| FR-24 | Toggle System | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-25 | Dual Notification System | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-55 | Bilingual Notification Email Templates | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-56 | Data Anonymization Tool | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-SY1 | Post-Event Wrap-Up Screen | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-SY2 | One-Screen Close | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-SY3 | Change Freeze Deadline | PMCM Admin | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-SY4 | Addendum Conforme Workflow | PMCM Admin | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| New-SEC1 | Role-Based Authentication and Session Management | Security | Security | Show configuration, validation failure, and audit/log evidence. | Wireframe/mock screen, data model, and roadmap explanation. |
| New-SEC2 | Data Privacy Compliance Module | Security | Security | Show configuration, validation failure, and audit/log evidence. | Wireframe/mock screen, data model, and roadmap explanation. |
| New-SEC3 | Secure File Upload Validation | Security | Security | Show configuration, validation failure, and audit/log evidence. | Wireframe/mock screen, data model, and roadmap explanation. |
| New-SEC4 | Comprehensive Audit Trail and Activity Log | Security | Security | Show configuration, validation failure, and audit/log evidence. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-AI-ZDR | Zero Data Retention AI Governance Layer | Security | Security | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. | Sanitized prompt sample, generated draft, blocked/approved audit row. |
| FR-26 | Client Portal Access Gated by Signed Conforme | Client | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-27 | Event Progress Visibility | Client | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-28 | Client Draft Floor Plan Submission | Client | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-29 | Official Floor Plan Viewing and Formal Approval | Client | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-30 | Venue Styling Moodboard Viewing and Formal Approval | Client | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-31 | Budget Confirmation Module for Venue Styling | Client | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-32 | Document Submission Portal | Client | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-33 | Per-Event File Hub Access | Client | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-34 | Notification of Task and Milestone Updates | Client | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-65 | Client-Owned Supplier Sub-Ticket | Client | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-66 | Venue Ocular Task Trigger | Client | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| New-CL1 | Walk-In Policy Setting | Client | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-CL2 | Event Day Limited View | Client | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-35 | Supplier Profile with Category Tagging and Tier Designation | Supplier | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-36 | Quote Submission | Supplier | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-37 | Event Assignment Confirmation | Supplier | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-38 | Contract and Terms of Service Upload | Supplier | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-49 | Confidential Bid Quote Request | Supplier | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-64 | Supplier Communication Thread Access | Supplier | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| New-SUP1 | Supplier Event Day Status Updates | Supplier | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-SUP2 | Pre-Event Readiness Confirmation | Supplier | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-SUP3 | Supplier Registration Page | Supplier | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| New-SUP4 | Supplier Application Status Tracking | Supplier | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-AI-04b | PARE — Supplier Replacement Recommendation (Supplier-Facing Output) | Supplier | Agentic | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. | Sanitized prompt sample, generated draft, blocked/approved audit row. |
| New-CO1 | Coordinator Portal Homepage | Coordinator | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-CO2 | Floor Director and Stage Director View | Coordinator | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-CO3 | Registration Staff View | Coordinator | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-CO4 | Ingress and Egress Assistant View | Coordinator | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-CO5 | Event Day System Operator View | Coordinator | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-CO6 | Usher and General Coordinator View | Coordinator | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-90 | Coordinator Assignment Acknowledgment | Coordinator | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-39 | Digital Registration and Masterlist | Guest | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-40 | In-Event Engagement Feature with Game Builder | Guest | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-41 | Post-Event Experience Upload with Moderation | Guest | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-95 | Lightweight Digital Registration Module | Guest | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-GU1 | Ticket-Based Event Registration Coordination | Guest | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-42 | Guest Pass Promotional Sample | External/Public | External | Open public page or static sample with safe sample data. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-46 | P.R.I.S.M Public Inquiry Page | External/Public | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-47 | Lightweight Spatial Preference Form | External/Public | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-48 | Referral Source Dropdown | External/Public | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| FR-50 | Abandoned Inquiry Draft Save with Edit Window | External/Public | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| FR-51 | Client Type Field | External/Public | Prism | Live walkthrough in seeded defense data. | Seeded screenshot, API response, or database row from the same scenario. |
| New-EX1 | Supplier Registration Page (Public-Facing) | External/Public | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |
| New-EX2 | Post-Event Guest Feedback Page | External/Public | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. | Wireframe/mock screen, data model, and roadmap explanation. |

## Live Sample Rules
- Keep the sample on one event record so the panel sees continuity.
- For AI features, never imply automatic action. Say clearly that the system produces drafts or recommendations and PMCM Admin must approve.
- For Phase 2 features, show the designed screen/data model and state that the feature is documented for post-defense buildout unless it is already implemented.
- If a live dependency fails, switch to the seeded screenshot/API/database evidence for that exact feature.
