---
type: "Reference Catalog"
title: "P.R.I.S.M Version 4 complete feature catalog"
description: "Source-preserving Version 4 feature tables and official manuscript/defense counts."
tags: [reference, prism-v4, catalog, manuscript]
status: reference
updated: "2026-10-28"
authority: reference
audience: [product, reviewers, researchers]
scope: "P.R.I.S.M Version 4 feature catalog and source counts"
last_verified: "V4 source"
sources:
  - id: official-catalog
    resource: "Official P.R.I.S.M V4 feature catalog DOCX"
    title: "Source manuscript"
---
# P.R.I.S.M Version 4 complete feature catalog

## At a glance

- **Purpose:** Preserve the Version 4 feature inventory and source counts for traceability.
- **Authority:** Reference only; it does not override the current product ledger or architecture.
- **Scope:** Manuscript/defense catalog material and its feature identifiers.
- **Use when:** Tracing a current decision back to the Version 4 source inventory.
- **Change when:** A new source catalog version replaces Version 4.
- **Verify with:** The cited source artifact and the current feature ledger; catalog presence is not implementation evidence.

This Markdown catalog preserves the feature tables from the official DOCX source. The count summary below is authoritative for the manuscript and defense.

## Feature Scope Legend
| Tag | Meaning |
| --- | --- |
| Prism | Implemented in working prototype for May 9, 2026 oral defense. |
| Phase 2 | Fully designed and documented in Chapter 3. Built after oral defense. |
| AI | AI-powered feature using Anthropic Claude API with ZDR and DataSanitizer. |
| Agentic | Multi-step AI agent workflow. Human approval required before any action. |
| Security | Cross-cutting security control active across all personas and phases. |
| External | Public-facing feature accessible without a portal account. |
| Behavior | Automatic system rule or logic (not a user-facing feature). |

## Feature Count Summary - Version 4
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

## AI Feature Architecture
The source identifies 10 AI features plus the mandatory `FR-AI-ZDR` governance layer that must be in place before any AI feature goes live.

| FR | Feature | Phase | Model | Type | Prism | Summary |
| --- | --- | --- | --- | --- | --- | --- |
| FR-AI-01 | Intelligent Inquiry Triage Agent | Phase 1 | Haiku | Agentic | No | Auto-analyzes new inquiries before PMCM Admin opens them. Generates prospect score, event type prediction, date conflict check, and client fit assessment. |
| FR-AI-03 | AI Proposal Drafting Assistant | Phase 2 | Sonnet | AI | No | Generates structured first draft of event proposal after CE Builder is populated. PMCM Admin reviews and finalizes before sending to client. |
| FR-10+ | Compliance Engine AI Advisory Layer | Ph2+4 | Haiku | AI | Prism base | Adds natural language explanations and prioritized action list on top of existing field-presence compliance checks. |
| FR-15 | AI Theme and Moodboard Suggestion Engine | Phase 2 | Sonnet | AI | No | Generates 2-3 theme concept suggestions with name, color palette, description, and reference terms based on event type and client preferences. |
| FR-AI-05 | P.R.I.S.M Operations Assistant — POA Chatbot | All | Sonnet | AI | No | Caged Claude chatbot embedded in PMCM Admin dashboard. Answers operational questions. ZDR enforced. Cannot take any action without human confirmation. |
| FR-AI-04 | Agentic Response Engine — PARE | Ph3-5 | Sonnet | AI+Agentic | No | 5-agent orchestrator for Emergency Change response. Handles supplier cancellation: reads event context, finds replacement, checks budget, assesses risk, drafts messages. Human approval required. |
| FR-AI-06 | Probabilistic Supplier Reliability Scoring | Cross | None | AI | No | Bayesian weighted reliability score per supplier combining on-time rate, complaint rate, response time, and contract mismatch frequency. Shown with confidence band. |
| FR-AI-07 | Real-Time Event Day Copilot | Phase 5 | Haiku | AI+Agentic | No | Monitoring agent on event day that surfaces prioritized alerts and recommended interventions to Event Day System Operator. Polls every 60 seconds. |
| FR-AI-08 | Post-Event Intelligence Layer — PEIL | Phase 6 | Sonnet | AI | No | Analyzes complete event record after closure. Generates three-section intelligence report: What Worked, What Failed and Why, Recommended Actions. |
| FR-AI-09 | Client Communication Intelligence Assistant | Cross | Haiku | AI | No | Proactively generates context-aware draft messages at specific workflow trigger points (unsigned conforme, unanswered proposal, overdue payment). PMCM Admin sends. |
| FR-AI-ZDR | Zero Data Retention AI Governance Layer | All | N/A | Security | YES | Mandatory setup before any AI feature goes live. ZDR agreement with Anthropic ensures no data stored outside PRISM. DataSanitizer replaces PII before every API call. |

## Inquiry and Client Management

Persona/scope: PMCM Admin

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-01 | Inquiry Intake Log | Prism | Centralizes all incoming inquiries regardless of entry point. Tags source, client type, and referral details. Detects duplicate submissions based on email and event date. Flags previous rejection history on resubmission. Includes Client Type field for quick filtering. |
| FR-02 | Client Onboarding Tracker | Prism | Monitors each inquiry through Accepted, Pending, and Declined states. Tracks conforme signing status with Awaiting Conforme status and automated PMCM follow-up reminders. Monitors portal invitation status: sent, opened, or expired. Tracks bidding path separately from standard inquiry path. |
| FR-03 | Conforme and MOA Document Storage | Prism | Stores signed conforme, MOA, NDA, and pre-conforme documents with timestamps. Serves as formal authorization gate before portal activation and Event Request creation. Auto-triggers billing statement generation upon conforme signing. |
| FR-44 | Organization Merge Tool | Phase 2 | Groups multiple client accounts from same company under one organization record. Supports company name editing with change log. Surfaces parallel inquiry alerts. Notifies PMCM with historical event summary on dormant client reactivation. |
| FR-45 | Referral Details Field | Phase 2 | Manual field on PMCM side of Inquiry Tracker for recording referrer name and relationship context for referral-sourced inquiries. |
| FR-52 | Send Inquiry Link and Log on Behalf Tool | Prism | Two options for verbal or informal referrals. Send Inquiry Link generates pre-tagged direct link. Log on Behalf opens simplified internal form for immediate basic detail capture with Pending Full Details tag. |
| FR-53 | Pre-Conforme Context Notes Log | Phase 2 | Structured notes log on inquiry record capturing discussion notes, scope flags, and follow-up reminders from pre-conforme period. Carries over automatically as Pre-Conforme Context when event workspace opens. |
| FR-54 | Pre-Conforme Document Attachment | Phase 2 | Supports uploading NDAs and other required documents to inquiry record before conforme stage. |
| FR-AI-01 | Intelligent Inquiry Triage Agent | Agentic | AI agent that automatically analyzes new inquiries before PMCM Admin opens them. Generates prospect score (High/Medium/Low), likely event type, date conflict check, client fit assessment, and one-sentence recommendation. PMCM Admin makes all Accept/Pend/Decline decisions independently. 🔒 AI Security: All data sent to Claude for Inquiry Triage passes through DataSanitizer (PII replaced with anonymized labels). Zero Data Retention (ZDR) enabled — Anthropic does not store inputs or outputs. Every API call logged in AIAuditLog table. Human approval required before any action is taken. |

## Event Planning and Operations

Persona/scope: PMCM Admin

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-04 | Per-Event File Hub | Prism | Centralized storage of all event assets, documents, and links per client. Contains floor plans, moodboards, key visuals, work permits, ingress and egress forms, registration data, crew meal allocations, manpower lists, supplier contracts, and client-submitted assets. |
| FR-05 | Live Operations Dashboard | Prism | Real-time view of every active event showing task completion, supplier confirmations, document submission, approval statuses, proposal lifecycle stage, revision rounds, SLA timers, escalation alerts, and milestone progress. Multi-day event support. Mobile-first phone-friendly design with laptop as primary command station on event day. |
| FR-06 | Event Proposal Compliance Engine | Prism | NLP-powered engine on three layers: Layer 1 six universal Must-Fix items, Layer 2 eighteen event-type-specific conditional rules, Layer 3 custom per-event items. Runs twice: at proposal stage and 7 days before event. Generates Readiness Report with All Clear, Must-Fix Items, and Watch Out Items. Override with documented reason recorded in Activity History. |
| FR-07 | Risk Management Assessment | Phase 2 | Structured per-event risk register organized by event phase. PMCM logs risks, assigns likelihood and impact ratings, tracks mitigation actions. Pre-populated risks for client-owned suppliers and known operational risks. Final review in Phase 4. |
| FR-08 | Floor Plan Upload and Client Approval Workflow | Prism | After venue ocular, editor uploads official floor plan. Formal approval request sent to client. Supports multiple revision rounds. Floor plan locked once formally approved. |
| FR-09 | Venue Styling Moodboard Upload and Client Approval Workflow | Phase 2 | Handles thematic design workflow separately from floor plan. Only activates after client confirms styling budget. Budget vs Expectation Check triggered on full rejection. Supports multiple revision rounds with full history. |
| FR-10 | Venue Scouting Module | Phase 2 | Presents at least three venue options with location, capacity, price range, and available dates when client has no venue yet. Client indicates preference inside portal. |
| FR-11 | AI Theme and Moodboard Suggestion Engine | AI | Generates two to three theme concept suggestions with name, color palette, moodboard description, and reference image search terms based on event type and client preferences. Not image generation. Activated during Bid Workspace and Phase 3 styling production. 🔒 AI Security: All data sent to Claude for Theme Generation passes through DataSanitizer (PII replaced with anonymized labels). Zero Data Retention (ZDR) enabled — Anthropic does not store inputs or outputs. Every API call logged in AIAuditLog table. Human approval required before any action is taken. |
| FR-12 | EOD Report Inbox Per Event | Phase 2 | Team members submit end-of-day reports tagged to specific events during pre-event phases. Ms. Mys sees all EOD reports consolidated per event. Can track daily progress, flag incomplete tasks, and respond within thread. |
| FR-13 | Coordinator Assignment with Role Tagging and Skills Tags | Prism | Maintains roster of on-call coordinators with role and skills tags. PMCM assigns coordinators per event filtered by availability, role, and skills. Double-booking detection across concurrent events. Coordinator receives assignment notification via email and Viber. |
| FR-43 | Bid Workspace | Phase 2 | Pre-conforme working environment for competitive bids. Contains TOR document storage, bid proposal drafting, pre-conforme venue styling capability, tentative supplier assignment with confidential quote requests, CE builder, bid submission tracking, outcome recording, automatic workspace conversion if won. |
| FR-AI-05 | P.R.I.S.M Operations Assistant (POA) — Caged Claude Chatbot | AI | Claude-powered conversational AI assistant embedded in PMCM Admin dashboard. Ms. Mys can ask natural language questions about any active event. Caged with Zero Data Retention — no data ever leaves PRISM. Cannot take any action without PMCM Admin confirmation. 🔒 AI Security: All data sent to Claude for POA Chatbot passes through DataSanitizer (PII replaced with anonymized labels). Zero Data Retention (ZDR) enabled — Anthropic does not store inputs or outputs. Every API call logged in AIAuditLog table. Human approval required before any action is taken. |
| FR-AI-07 | Real-Time Event Day Copilot | Agentic | On event day, AI monitoring agent watches all incoming data streams on the Live Operations Dashboard. Proactively surfaces prioritized alerts and recommended interventions to Event Day System Operator every 60 seconds. Covers supplier late arrivals, overdue tasks, coordinator no-shows, and check-in anomalies. 🔒 AI Security: All data sent to Claude for Event Day Copilot passes through DataSanitizer (PII replaced with anonymized labels). Zero Data Retention (ZDR) enabled — Anthropic does not store inputs or outputs. Every API call logged in AIAuditLog table. Human approval required before any action is taken. |

## Proposal and Cost Estimation

Persona/scope: PMCM Admin

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-19 | Cost Estimation Builder | Prism | Consolidates supplier quotes into internal CE document organized by category. Real-time budget alignment indicator comparing running total against client stated budget range. Previous CE accessible as reference for returning clients. Never visible to client. |
| FR-58 | Event Briefing Form | Prism | Structured detailed intake form completed by client inside portal. Covers confirmed event date, start and end time, attendee count, confirmed venue, program flow, service requirements per supplier category, theme and mood preferences, styling budget range, and special requirements. |
| FR-59 | Canva and PowerPoint Proposal Integration | Phase 2 | Connects PMCM Canva account via OAuth. System prepares structured proposal data package and launches Canva with template pre-loaded. Also supports PowerPoint export. Prism: manual PDF upload back into system. |
| FR-60 | Proposal Submission and Review Workflow | Prism | Client views full proposal in portal. Can leave comments, request revisions, or formally approve. Configurable maximum revision rounds. Designated primary contact is sole authorized approver. Others have Comments Only view. |
| FR-61 | Presentation Meeting Scheduler with Zoom Integration | Phase 2 | PMCM proposes time slots. System auto-creates Zoom meeting via Zoom API. Calendar invite with embedded Zoom link sent to all parties. Supports rescheduling and two consecutive no-show At Risk flag. |
| FR-62 | Tiered Package Options in CE Builder | Phase 2 | Single option when client provides specific confirmed budget. Two options maximum when budget is a range or unconfirmed. PMCM can manually override either way. |
| FR-AI-03 | AI Proposal Drafting Assistant | AI | After CE Builder is populated with supplier quotes, AI automatically generates a structured first draft of the event proposal. Sections: Executive Summary, Event Concept, Service Package Summary, Investment Summary, Payment Schedule. PMCM Admin reviews and finalizes before sending to client. 🔒 AI Security: All data sent to Claude for Proposal Drafting passes through DataSanitizer (PII replaced with anonymized labels). Zero Data Retention (ZDR) enabled — Anthropic does not store inputs or outputs. Every API call logged in AIAuditLog table. Human approval required before any action is taken. |
| FR-AI-09 | Client Communication Intelligence Assistant | AI | Proactively generates context-aware draft messages at specific workflow trigger points: unsigned conforme after 5 days, unanswered proposal after 3 days, balance payment due in 48 hours, floor plan approval pending after 2 days. PMCM Admin reviews and sends. Cannot send anything automatically. 🔒 AI Security: All data sent to Claude for Communication Assistant passes through DataSanitizer (PII replaced with anonymized labels). Zero Data Retention (ZDR) enabled — Anthropic does not store inputs or outputs. Every API call logged in AIAuditLog table. Human approval required before any action is taken. |

## Contract and Document Management

Persona/scope: PMCM Admin

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-67 | Document Template Pre-Fill System | Phase 2 | PMCM uploads existing Word templates for conforme and billing statement during onboarding. System pre-fills variable fields from event record. PMCM reviews and sends. Never generates legal documents from scratch. |
| FR-68 | Dual Signing Path | Phase 2 | E-signature is default and primary path. Physical signing available as fallback: PMCM downloads PDF, client signs physically, scans and returns, PMCM uploads manually. Both paths produce timestamped signed document. |
| FR-69 | Flexible Payment Terms Configuration | Phase 2 | 50% downpayment always fixed and non-negotiable. Remaining 50% configurable across up to three payment milestones. Repeat clients may have adjusted terms with PMCM override and documented reason. |
| FR-70 | Accreditation Document Tracker | Phase 2 | Tracks submission of required accreditation documents for large corporate clients. Has own SLA timer. Does not block planning from starting. |
| FR-96 | Event Cancellation Workflow | Prism | PMCM initiates cancellation with reason field and double confirmation screen. Automatic cascade to all supplier and coordinator assignments. Cancellation Financial Summary generated showing downpayment status, sunk costs, and cancellation fee calculation (10 to 15 percent of contract amount when conforme is signed). No cancellation fee when conforme has not yet been signed. |
| FR-97 | Event Postponement Workflow | Prism | PMCM marks event as Postponed with reason field and new date or Date To Be Confirmed. Automatic impact assessment: supplier availability re-check, coordinator availability re-check, venue confirmation sub-ticket created. No cancellation fee for postponements ever. Downpayment retained and applied to rescheduled event. |

## Supplier Management

Persona/scope: PMCM Admin

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-14 | Supplier Directory with Category Tagging | Prism | Master directory of all PMCM suppliers organized by eight confirmed categories: Production, Technicals, Digital Registration, Documentation, Food and Beverages, Talents, Logistics, and Program and Manpower. Each profile includes contact details, past event records, performance notes, certifications, Capacity or Scale Rating, Reliability Notes, BNI Member flag, aggregate review rating, and tier designation. |
| FR-15 | Tier 1 and Tier 2 Supplier Designation | Prism | Primary and backup supplier designated per category. System auto-suggests Tier 1 when building event. PMCM can accept, switch to Tier 2, or open competitive quote round. |
| FR-16 | Supplier Selection Policy Layer | Phase 2 | Escalates beyond Tier 1 when both conditions are met: Tier 1 unavailable AND event requirements exceed Tier 1 capacity rating. PMCM can manually override at any time. |
| FR-17 | Supplier Quote Request and Comparison | Prism | Sends structured quote requests. Suppliers submit via structured portal form. PMCM views all quotes side by side. Flags quotes outside PMCM-defined acceptable price range. One revision allowed before deadline. Locked after PMCM selects supplier and begins CE building. |
| FR-18 | Supplier Competitive Bidding Module | Phase 2 | Triggered mode when event scale or Tier 1 unavailability warrants it. Multiple suppliers submit proposals. PMCM reviews and selects winning bid. |
| FR-49 | Confidential Bid Quote Request | Phase 2 | Hides all client identifying information during bidding phase. Shows event type, scale, date, venue type, and service requirements only. Confidentiality lifts when bid is won. |
| FR-63 | Supplier Gap Warning | Prism | Immediate dashboard alert when both Tier 1 and Tier 2 suppliers are unavailable for a specific category on an event date. Event cannot advance until gap is resolved or PMCM manually acknowledges risk. |
| FR-64 | Supplier Communication Thread | Phase 2 | Per-event dedicated message thread between PMCM and each assigned supplier. Messages sent as email and Viber notifications. Supplier does not need to log into portal to see messages. |
| FR-75 | Supplier Formal Assignment Notification | Prism | Formal assignment notification sent to supplier via email and Viber containing event details, specific deliverables, ingress schedule, and payment terms. Supplier confirms inside portal. |
| FR-76 | Supplier Unresponsive Escalation with Viber Deep Link | Prism | Escalation alert to PMCM when supplier unresponsive. Includes Contact via Viber deep link button opening pre-drafted message in one tap. Tier 2 suggestion only after second window passes. |
| FR-77 | Supplier Contract Mismatch Warning | Phase 2 | Detects discrepancy between supplier formal contract and original quote. Two types: supplier-initiated mismatch flagged as warning, and client-driven addendum triggering new conforme and updated billing statement. |
| FR-78 | Ingress and Egress Schedule View | Prism | PMCM assigns each supplier a specific ingress time window. Default production-first setup order. System flags Schedule Conflict if two suppliers overlap. Schedule visible to all assigned suppliers and ingress assistant. |
| FR-79 | Supplier Reliability Notes | Phase 2 | Automatic note added to supplier profile when supplier withdraws, is unresponsive, contract mismatches quote, or underperforms on event day. PMCM views reliability history when selecting suppliers for future events. |
| FR-87 | Outsourced Creative Designer Sub-Ticket | Phase 2 | Managed fully externally. No supplier directory entry. No portal account. Sub-ticket assigned to PMCM tracks deliverable progress only. PMCM uploads finished creative output into file hub and marks sub-ticket complete. |
| New-S1 | Supplier Registration Page | Phase 2 | Public-facing application form where prospective suppliers submit company profile, past events portfolio, service category, certifications, price range, and contact details. Goes to Supplier Applications inbox on PMCM dashboard. |
| New-S2 | Supplier Applications Inbox | Phase 2 | PMCM dashboard inbox showing all pending supplier applications with three action options: Request Proposal, Schedule Meeting, or Decline. Approved suppliers added with Pending First Event status. |
| New-S3 | Pending First Event Status | Phase 2 | New approved suppliers start at this status. Not auto-suggested by Supplier Selection Policy Layer until PMCM manually promotes them after first successful event performance assessment. |
| New-S4 | Supplier Performance Assessment | Phase 2 | Post-event performance notes added to supplier profile after each event. Manual tier upgrade or downgrade by PMCM based on reliability and quality across multiple events. Informed by PMCM Internal Supplier Review ratings. |
| New-S5 | PMCM Internal Supplier Review | Prism | After each event is formally closed, PMCM is prompted to review each assigned supplier. Contains overall star rating (1 to 5), category-specific dimension ratings, and a private notes field. All reviews visible only to Ms. Mys and the EA. Feeds directly into tier upgrade or downgrade decisions and the Event Insights Card. |
| FR-AI-06 | Probabilistic Supplier Reliability Scoring Model | AI | Builds probabilistic reliability score per supplier combining on-time arrival history, complaint rates from Urgent Issue logs, quote response times, and contract mismatch frequency. Displayed with confidence band (e.g., 87% ± 8%, based on 12 events). PARE agent uses this score when recommending replacements. 🔒 AI Security: All data sent to Claude for Supplier Scoring passes through DataSanitizer (PII replaced with anonymized labels). Zero Data Retention (ZDR) enabled — Anthropic does not store inputs or outputs. Every API call logged in AIAuditLog table. Human approval required before any action is taken. |
| FR-AI-04 | P.R.I.S.M Agentic Response Engine (PARE) — Multi-Agent Emergency Response | Agentic | 5-agent orchestrator that activates on Emergency Change triggers (supplier cancellation, coordinator withdrawal within 48 hours). Agent 1 reads event context. Agent 2 finds replacement suppliers. Agent 3 checks budget feasibility. Agent 4 assesses risk. Agent 5 drafts messages. Orchestrator assembles recommendation package. PMCM Admin approves before any action is taken. 🔒 AI Security: All data sent to Claude for PARE Multi-Agent passes through DataSanitizer (PII replaced with anonymized labels). Zero Data Retention (ZDR) enabled — Anthropic does not store inputs or outputs. Every API call logged in AIAuditLog table. Human approval required before any action is taken. |

## Financial Management

Persona/scope: PMCM Admin

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-20 | Billing Statement Generation | Prism | Auto-triggered upon conforme signing. Generates numbered billing statement with client details, event name, total amount due, payment terms, and accepted payment methods. Linked directly to approved proposal and CE for dispute reference. |
| FR-21 | Post-Event Additional Billing Statement | Prism | Issues supplementary billing for extra work done during or after event. Linked to Urgent Issue ticket that triggered extra work. Mark as Waived option with documented reason for goodwill cases. |
| FR-92 | Payment Milestone Tracker | Prism | Tracks confirmed payment milestones: 50% downpayment upon conforme signing and 50% balance 7 days before event. Configurable up to three milestones. Automated reminders at configurable intervals. Payment Overdue Alert on dashboard. Payment At Risk flag at 48 hours. |
| FR-93 | Partial Payment Recording | Phase 2 | PMCM records partial payment amount and date. System calculates remaining balance. Partial Payment Received status on dashboard. PMCM prompted to follow up on outstanding balance. |
| FR-94 | Billing Statement to Proposal Link | Phase 2 | Every billing statement directly linked to approved proposal and CE. Two severity levels: typo correction and amount discrepancy. Billing Dispute flag raises formal record with resolution notes. |

## Floor Plan Builder

Persona/scope: PMCM Admin

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-80 | Floor Plan Builder with Draggable Element Library | Prism | Canvas-based tool for creating floor plans directly inside P.R.I.S.M. Pre-built draggable elements organized by category: Furniture, Stage and Production, Registration and Flow, Safety. Built using Konva.js or Fabric.js for React. |
| FR-81 | Venue Library | Phase 2 | Saves venue space dimensions and permanent features after each ocular. Pre-loads accurate canvas with permanent walls, pillars, emergency exits, fixed stage direction, loading bay, and venue rules on reuse. |
| FR-82 | Quick Setup Presets | Phase 2 | 18 event-type-specific presets based on confirmed PMCM event types. One-click auto-arrangement based on venue canvas dimensions and confirmed pax count. Editor adjusts from preset. |
| FR-83 | Client Floor Plan Annotation and Approval | Prism | Client views floor plan in portal. Can annotate directly on canvas. Only designated primary contact annotations are actionable. Others flagged as Non-Binding Notes. Full revision history tracked. Floor plan locked once formally approved. |
| FR-84 | Table Assignment List | Phase 2 | Available only for private events under 200 pax. Each table assigned a number or name. PMCM or client assigns guest names from uploaded masterlist to specific tables. Printable seating list output. |

## Coordinator Management

Persona/scope: PMCM Admin

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-88 | Coordinator Double Booking Detection | Prism | Detects double booking immediately upon assignment. Blocks with Double Booking Alert. Suggests available coordinators with same role not assigned on that date. |
| FR-89 | Coordinator Withdrawal and Replacement | Prism | PMCM marks coordinator as withdrawn. System surfaces available replacement coordinators immediately filtered by role and skills. Withdrawal noted on profile. Emergency Change triggered if withdrawal happens within 48 hours of event. |
| FR-90 | Coordinator Assignment Acknowledgment | Prism | Digital replacement for Viber group chat reconfirmation. Coordinator must formally acknowledge assignment inside system with definite yes confirmation. Pending Acknowledgment status on dashboard. Follow-up reminder after configurable days. |
| FR-91 | Coordinator Availability and Staffing View | Phase 2 | Real-time availability count per role and skills tag across full coordinator pool. Staffing Gap Warning when required count exceeds available coordinators. Filterable by event date, role, and skills. |
| New-C1 | Coordinator Role-Specific Portal Views | Prism | Each coordinator type sees only information relevant to their assigned role. Confirmed views: Floor Director and Stage Director, Registration Staff, Ingress and Egress Assistant, Event Day System Operator, Usher and General Coordinator. Role badge prominently displayed at top of every coordinator view. |
| New-C2 | Event Day System Operator Role Tag | Prism | Special designation added to one coordinator per event during Phase 3 assignment. Gives access to full event task dashboard on laptop during event day. |
| New-C3 | Coordinator Late Arrival and No Show Flag | Prism | During on-site briefing check-in, Event Day System Operator marks each coordinator as Present, Late Arrival, or Absent. Late Arrival and No Show recorded on coordinator profile as reliability notes. |
| New-C4 | Task Reassignment with Ms. Mys Notification | Prism | Event Day System Operator initiates task reassignment. Ms. Mys notified immediately via phone with reassignment details. One-tap approval or rejection. Auto-approves after 2 minutes if no response to prioritize event flow. |

## Post-Event and Archive

Persona/scope: PMCM Admin

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-22 | Post-Event Documentation Submission Tracker | Prism | Tracks PMCM obligation to endorse all deliverables within 3 to 5 days. Lists required items and submission status. Client acknowledges receipt inside portal. Countdown to deadline. Deadline Overdue alert if missed. |
| FR-23 | Event Archive with Search | Prism | All completed events in searchable archive. Search by event name, client name, venue, event type, or chronological month and year. Full event record retained including file hub, approvals, compliance reports, billing, and post-event documentation. |
| New-P1 | Event Comparison View | Phase 2 | PMCM selects two or more archived events and taps Compare. Simple side by side table showing event type, venue, attendee count, total cost, client satisfaction rating, number of urgent issues on event day, and top performing supplier per category. |
| New-P2 | Event Insights Card | Prism | Structured knowledge capture per closed event. Contains event type, venue, pax, supplier lineup with performance notes, coordinator team with role tags, client satisfaction rating, category-based feedback across eight dimensions, issues and resolutions, Urgent Issue log, and PMCM Internal Supplier Review ratings. Private Notes section visible to Ms. Mys and EA only. Seeded with AI-generated analysis from PEIL. |
| New-P3 | Client Testimonial Feature | Phase 2 | Optional post-event testimonial request sent to client after event closure. Submitted testimonials stored in PMCM testimonials library inside system. Selected testimonials auto-populate future Canva proposals. |
| New-P4 | Logistics Booking Record | Phase 2 | PMCM records Grab, Lalamove, or Transportify booking reference in Logistics Sub-Ticket for returning client assets. System generates logistics billing item automatically. Logistics Brief generated and shareable via Viber deep link or printable slip. |
| New-P5 | Additional Billing Waiver | Prism | PMCM can mark any additional billing item as Waived with documented reason. Recorded in Activity History as deliberate goodwill decision not an oversight. |
| FR-AI-08 | Post-Event Intelligence Layer (PEIL) | AI | After One-Screen Close, AI analyzes the complete event record and generates a three-section intelligence report: (1) What Worked — operational successes with evidence, (2) What Failed and Why — failure patterns with causal explanations, (3) Recommended Actions — specific actionable items with one-click approval. Upgrades Event Insights Card from static capture to AI-generated analytical report. 🔒 AI Security: All data sent to Claude for PEIL Post-Event passes through DataSanitizer (PII replaced with anonymized labels). Zero Data Retention (ZDR) enabled — Anthropic does not store inputs or outputs. Every API call logged in AIAuditLog table. Human approval required before any action is taken. |

## System Configuration and Event Lifecycle

Persona/scope: PMCM Admin

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-24 | Toggle System | Phase 2 | PMCM enables or disables specific modules per event. Keeps interface appropriate to event complexity. |
| FR-25 | Dual Notification System | Prism | All updates trigger notifications via email and Viber simultaneously. Covers all portal communication thread messages to clients, suppliers, and coordinators. Users configure notification preferences. |
| FR-55 | Bilingual Notification Email Templates | Phase 2 | English and Filipino templates for key automated messages. Language preference toggle per client record defaulting to English. |
| FR-56 | Data Anonymization Tool | Prism | Administrative function for deleting or anonymizing rejected prospect personal data. Compliance with Philippine Data Privacy Act of 2012. Core component of Data Privacy Compliance Module. |
| New-SY1 | Post-Event Wrap-Up Screen | Prism | Activated within 24 hours after event ends. Two modes: Full Wrap-Up and Quick Close. Five sections: Event Completion Confirmation, Urgent Issues retroactive log, Supplier Egress Confirmation, Additional Billing Items draft capture, and Submit. System sends reminders at 12-hour and 24-hour marks. |
| New-SY2 | One-Screen Close | Prism | Single screen for formal event closure. Five green or red indicator lights: Deliverables, Billing, Logistics, Issues, and Client Feedback. Close Event button appears only when all five are green. Override available with documented reason. |
| New-SY3 | Change Freeze Deadline | Prism | Hard deadline automatically set to 5 days before event. Client-driven scope changes locked and routed to post-event billing after this point. Internal operational adjustments always allowed. |
| New-SY4 | Addendum Conforme Workflow | Phase 2 | Client-driven scope additions require new conforme signed before implementation. New conforme triggers updated billing statement. Available before Change Freeze Deadline only. |

## Security - Cross-Cutting All Personas and All Phases

Persona/scope: Security

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| New-SEC1 | Role-Based Authentication and Session Management | Security | Email and password authentication for all user roles with minimum password requirements. 2FA mandatory for PMCM Admin using TOTP via authenticator app. Session timeout configurable per role. Account lockout after five consecutive failed login attempts with 10-minute cooldown. Secure password reset via time-limited 15-minute email link. |
| New-SEC2 | Data Privacy Compliance Module | Security | Privacy Notice shown to all users on first login explaining data collection, use, sharing, retention, and user rights. Data export function for right to access requests. Data Anonymization Tool for right to erasure requests. Data Retention Policy configurable per data type. Personal Information Inventory accessible to PMCM Admin for NPC compliance documentation. |
| New-SEC3 | Secure File Upload Validation | Security | All uploaded files validated for file type using MIME type checking not just file extension. Accepted types: PDF, DOCX, XLSX, JPG, PNG, MP4, MOV. File size limits enforced. Files stored with randomly generated names to prevent directory traversal. |
| New-SEC4 | Comprehensive Audit Trail and Activity Log | Security | Every system action logged with timestamp, user identity, user role, action type, and affected data. Append-only and tamper-resistant. Accessible only to Ms. Mys and EA. Filterable by user, event, date range, and action type. |
| FR-AI-ZDR | Zero Data Retention AI Governance Layer | Security | MANDATORY setup before any AI feature goes live. ZDR agreement with Anthropic guarantees no AI inputs or outputs are stored on Anthropic servers. DataSanitizer service replaces all PII with anonymized labels before every Claude API call. AIAuditLog table records every AI call with data categories processed, model version, and ZDR confirmation. Human approval required before any AI recommendation is acted upon. 🔒 AI Security: This is not optional. Without ZDR configured and DataSanitizer implemented, P.R.I.S.M cannot legally claim Philippine Data Privacy Act compliance for AI features. ZDR setup requires Anthropic Business Associates Agreement (contact api@anthropic.com). Process takes 1-3 business days. |

## Client Features

Persona/scope: Client

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-26 | Client Portal Access Gated by Signed Conforme | Prism | Portal activates only after conforme signed and uploaded by PMCM. Returning client email recognition auto-links new event to existing account. Full event history visible on portal homepage. |
| FR-27 | Event Progress Visibility | Prism | Structured view of all active tasks, current status, upcoming deadlines, and items awaiting client action. Proposal lifecycle stage, revision rounds, and payment milestone status visible. |
| FR-28 | Client Draft Floor Plan Submission | Phase 2 | Client submits rough spatial preference draft communicating layout ideas before official floor plan is made. Labeled as preference draft not a floor plan. Visible to editor as starting reference. |
| FR-29 | Official Floor Plan Viewing and Formal Approval | Prism | Client reviews official floor plan. Approves or submits revision comments with annotations directly on canvas. Only designated primary contact annotations are actionable. Approval timestamped. Floor plan locked once approved. |
| FR-30 | Venue Styling Moodboard Viewing and Formal Approval | Phase 2 | Client views moodboard. Only available after budget confirmation. Approves or requests changes. Budget vs Expectation Check triggered on full rejection. |
| FR-31 | Budget Confirmation Module for Venue Styling | Phase 2 | Client formally inputs or confirms styling budget range before any design work begins. Mandatory step unlocking venue styling workflow. No design begins without confirmed budget. |
| FR-32 | Document Submission Portal | Prism | Client uploads required event assets: guest list, company logo, key visuals, speaker files, venue details, booking confirmation, work permits. Goes directly into event file hub. |
| FR-33 | Per-Event File Hub Access | Prism | Client views all event files in one structured place inside portal with appropriate access controls. Cannot see CE or PMCM internal cost data. |
| FR-34 | Notification of Task and Milestone Updates | Prism | Client receives notifications when key milestones are reached via email and Viber. All portal communication thread messages trigger dual notification. |
| FR-65 | Client-Owned Supplier Sub-Ticket | Phase 2 | Client coordinates with external supplier outside P.R.I.S.M. Client marks sub-ticket as confirmed when supplier commits. PMCM sees only necessary operational details. PMCM can raise Risk Warnings. |
| FR-66 | Venue Ocular Task Trigger | Phase 2 | Client submission of venue details automatically opens venue ocular Change Task assigned to PMCM. Ocular must be completed before floor plan workflow begins. |
| New-CL1 | Walk-In Policy Setting | Prism | Client sets walk-in policy during Phase 3: Allow Walk-Ins, Verify with PMCM, or No Walk-Ins Allowed. Applies to private events under 200 pax. Flag for Verification sends instant notification to Event Day System Operator and Ms. Mys. |
| New-CL2 | Event Day Limited View | Phase 2 | High-level event status and milestone updates visible on event day. No internal task or coordinator details visible. PMCM-to-client messages trigger email and Viber notification. Toggle per event by PMCM. |

## Supplier Features

Persona/scope: Supplier

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-35 | Supplier Profile with Category Tagging and Tier Designation | Prism | Supplier profile with category, tier, contact details, past event records, performance notes, certifications, Capacity or Scale Rating, Reliability Notes, BNI Member flag, Pending First Event status for new suppliers, and aggregate review rating from PMCM Internal Supplier Review visible to PMCM only. |
| FR-36 | Quote Submission | Prism | Structured quote form showing event type, scale, date, venue type, and service requirements. Supplier submits price, inclusions, and payment terms. One revision allowed before deadline. |
| FR-37 | Event Assignment Confirmation | Prism | Supplier receives formal assignment notification. Confirms availability and reviews event details and terms before formally accepting. |
| FR-38 | Contract and Terms of Service Upload | Phase 2 | Supplier uploads service contract per event linked to event file hub. |
| FR-49 | Confidential Bid Quote Request | Phase 2 | Hides all client identifying information during bidding phase. Confidentiality lifts when bid is won. |
| FR-64 | Supplier Communication Thread Access | Phase 2 | Supplier side of per-event message thread with PMCM. Receives messages as email and Viber notifications. |
| New-SUP1 | Supplier Event Day Status Updates | Prism | Simplified phone view for event day. Three large status buttons: Arrived, Set Up and Ready, and Done and Leaving. Optional photo upload per status update. Two-level confirmation: Self-Reported and Verified. |
| New-SUP2 | Pre-Event Readiness Confirmation | Prism | 7 days before event, supplier receives readiness confirmation request. Reviews their deliverables and confirms readiness with one tap. Flags any concerns via communication thread. |
| New-SUP3 | Supplier Registration Page | Phase 2 | Public-facing application form. Submits company profile, past events portfolio, service category, certifications, price range, and contact details. Goes to Supplier Applications inbox on PMCM dashboard. BNI Member toggle available. |
| New-SUP4 | Supplier Application Status Tracking | Phase 2 | After submitting application, prospective supplier receives confirmation email and can check status through a simple status page: Under Review, Proposal Requested, Meeting Scheduled, Approved, or Declined. |
| FR-AI-04b | PARE — Supplier Replacement Recommendation (Supplier-Facing Output) | Agentic | When PARE identifies a replacement supplier, that supplier receives a formal assignment notification (drafted by PARE Agent 5) which PMCM Admin has reviewed and approved before sending. Supplier sees standard assignment notification and confirms through their portal as normal. 🔒 AI Security: No raw AI outputs are shown to suppliers. All supplier-facing communications are reviewed and approved by PMCM Admin before sending. Supplier data used by PARE is anonymized before API calls. |

## Coordinator Features

Persona/scope: Coordinator

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| New-CO1 | Coordinator Portal Homepage | Prism | Simple list of active event assignments. Each card shows event name, date, venue, and assigned role in bold. Tapping opens role-specific view. Completed events in simple archive. Mobile-first design. |
| New-CO2 | Floor Director and Stage Director View | Prism | Role badge prominently displayed. Event details with call time. Briefing documents (script, floor plan, role instructions, attire, call times). Task list with In Progress and Done toggles. Communication thread with Event Day System Operator and Ms. Mys. Urgent Issue button. |
| New-CO3 | Registration Staff View | Prism | Role badge prominently displayed. Searchable guest masterlist with Check In button per guest. Walk-In Addition button. Flag for Verification button for unauthorized walk-ins. Real-time attendance count. Laptop-optimized interface. |
| New-CO4 | Ingress and Egress Assistant View | Prism | Role badge prominently displayed. Supplier schedule with Arrived, Set Up and Ready, and Done and Leaving status buttons. Verified toggle after physical check. Photo upload per supplier. Late Arrival flag auto-appears after 15 minutes past scheduled window. |
| New-CO5 | Event Day System Operator View | Prism | Role badge prominently displayed. Full event task dashboard with status lanes on laptop. Supplier status overview. Coordinator check-in section. Urgent Issue log with one-tap access. Task reassignment tool with Ms. Mys notification. Wrap-up screen access after event. Real-time attendance feed from registration staff. |
| New-CO6 | Usher and General Coordinator View | Prism | Role badge prominently displayed. Simple instruction list with specific post and responsibilities. Urgent Issue button. Minimal interface. |
| FR-90 | Coordinator Assignment Acknowledgment | Prism | Formal yes confirmation required from all coordinators. Pending Acknowledgment tracked on PMCM dashboard. Digital replacement for Viber group chat reconfirmation. |

## Guest Features

Persona/scope: Guest

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-39 | Digital Registration and Masterlist | Prism | Three check-in modes. Mode 1 QR Code: optional upgrade when client provides email addresses. Mode 2 Name-Based Digital Checklist: default for private events. Mode 3 Headcount Only: very small informal events. Walk-in guest addition on spot. Unauthorized walk-ins trigger Flag for Verification per client-set walk-in policy. Real-time attendance count on dashboard. |
| FR-40 | In-Event Engagement Feature with Game Builder | Phase 2 | Five pre-built customizable game templates: Live Poll, Word Cloud, Ice Breaker Quiz, Raffle Draw, Open Q and A. QR code on LED wall opens web page on guest phone browser. No app download or account needed. |
| FR-41 | Post-Event Experience Upload with Moderation | Phase 2 | QR code generated per event after closure. Guests scan and access simple web page: star rating, short text review, photo upload, short video upload maximum 60 seconds. All submissions go to PMCM moderated review queue. Client permission required before any public use. |
| FR-95 | Lightweight Digital Registration Module | Prism | Supports all three check-in modes. QR code generation using standard libraries. Browser-based QR scanning requiring HTTPS. Manual name search and check-in interface on laptop. Walk-in addition form. Unauthorized walk-in flag. Attendance count on Live Operations Dashboard in real time. |
| New-GU1 | Ticket-Based Event Registration Coordination | Phase 2 | For large events 200 to 250 pax and above using XPERTO or client-chosen platform. PMCM records registration platform details in event file hub. Digital Registration supplier sub-ticket tracks platform setup confirmation. Final headcount data imported from XPERTO after event. P.R.I.S.M does not handle ticket sales or payment processing. |

## External and Public Features

Persona/scope: External/Public

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-42 | Guest Pass Promotional Sample | External | Lightweight interactive simulation of P.R.I.S.M embedded on PMCM public website. Not connected to live data. Marketing and credibility tool for prospects. |
| FR-46 | P.R.I.S.M Public Inquiry Page | Prism | Public-facing structured intake page. No account needed. Auto-creates inquiry ticket on submission. Confirmation email sent to prospect. |
| FR-47 | Lightweight Spatial Preference Form | Phase 2 | Short structured section at end of public inquiry form. Covers preferred seating arrangement type, stage position preference, and optional setup notes. Not a floor plan. |
| FR-48 | Referral Source Dropdown | Prism | How did you hear about us dropdown on public inquiry form. Six source options. |
| FR-50 | Abandoned Inquiry Draft Save with Edit Window | Phase 2 | Silent background draft saving. One gentle reminder email if email provided. 24-hour edit window after submission. Editing locked after PMCM marks as reviewed. |
| FR-51 | Client Type Field | Prism | Corporate, Government, Individual, Non-profit dropdown on inquiry form for PMCM filtering. |
| New-EX1 | Supplier Registration Page (Public-Facing) | Phase 2 | Public-facing page where prospective suppliers submit application to join PMCM supplier network. Separate from client inquiry page. Feeds into Supplier Applications inbox on PMCM dashboard. |
| New-EX2 | Post-Event Guest Feedback Page | Phase 2 | Simple web page accessed via QR code after event. No account or app needed. Star rating, text review, photo upload, and short video upload. Submissions go to PMCM moderated queue. Never auto-published. |
