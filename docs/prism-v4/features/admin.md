# PMCM Admin Features

This file is split from the complete P.R.I.S.M Version 4 catalog for easier implementation and demo preparation.

## Inquiry and Client Management

Primary surface: PMCM admin inquiry board, public inquiry intake, client record

Implementation backbone: Inquiry, client, conforme, organization, bidding, and portal-invitation APIs

Database backbone: Inquiry, Client, Organization, ConformeDocument, PortalInvitation, BiddingRecord, InquiryTriage

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

### Demo Focus
| FR # | Feature | Scope | Demo focus |
| --- | --- | --- | --- |
| FR-01 | Inquiry Intake Log | Prism | Live walkthrough in seeded defense data. |
| FR-02 | Client Onboarding Tracker | Prism | Live walkthrough in seeded defense data. |
| FR-03 | Conforme and MOA Document Storage | Prism | Live walkthrough in seeded defense data. |
| FR-44 | Organization Merge Tool | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-45 | Referral Details Field | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-52 | Send Inquiry Link and Log on Behalf Tool | Prism | Live walkthrough in seeded defense data. |
| FR-53 | Pre-Conforme Context Notes Log | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-54 | Pre-Conforme Document Attachment | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-AI-01 | Intelligent Inquiry Triage Agent | Agentic | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. |

## Event Planning and Operations

Primary surface: PMCM event workspace, live operations dashboard, file hub

Implementation backbone: Event, task, milestone, compliance, permit, urgent issue, and audit APIs

Database backbone: Event, EventFile, Task, Milestone, ComplianceCheck, Permit, UrgentIssue, EventDayLog

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

### Demo Focus
| FR # | Feature | Scope | Demo focus |
| --- | --- | --- | --- |
| FR-04 | Per-Event File Hub | Prism | Live walkthrough in seeded defense data. |
| FR-05 | Live Operations Dashboard | Prism | Live walkthrough in seeded defense data. |
| FR-06 | Event Proposal Compliance Engine | Prism | Live walkthrough in seeded defense data. |
| FR-07 | Risk Management Assessment | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-08 | Floor Plan Upload and Client Approval Workflow | Prism | Live walkthrough in seeded defense data. |
| FR-09 | Venue Styling Moodboard Upload and Client Approval Workflow | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-10 | Venue Scouting Module | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-11 | AI Theme and Moodboard Suggestion Engine | AI | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. |
| FR-12 | EOD Report Inbox Per Event | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-13 | Coordinator Assignment with Role Tagging and Skills Tags | Prism | Live walkthrough in seeded defense data. |
| FR-43 | Bid Workspace | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-AI-05 | P.R.I.S.M Operations Assistant (POA) — Caged Claude Chatbot | AI | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. |
| FR-AI-07 | Real-Time Event Day Copilot | Agentic | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. |

## Proposal and Cost Estimation

Primary surface: PMCM CE builder, proposal workspace, client proposal review portal

Implementation backbone: Cost estimate, supplier quote aggregation, proposal, revision, approval, and AI draft APIs

Database backbone: CostEstimate, SupplierQuote, Proposal, ProposalRevision, ProposalApproval, EventBriefing

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

### Demo Focus
| FR # | Feature | Scope | Demo focus |
| --- | --- | --- | --- |
| FR-19 | Cost Estimation Builder | Prism | Live walkthrough in seeded defense data. |
| FR-58 | Event Briefing Form | Prism | Live walkthrough in seeded defense data. |
| FR-59 | Canva and PowerPoint Proposal Integration | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-60 | Proposal Submission and Review Workflow | Prism | Live walkthrough in seeded defense data. |
| FR-61 | Presentation Meeting Scheduler with Zoom Integration | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-62 | Tiered Package Options in CE Builder | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-AI-03 | AI Proposal Drafting Assistant | AI | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. |
| FR-AI-09 | Client Communication Intelligence Assistant | AI | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. |

## Contract and Document Management

Primary surface: PMCM document workspace, client signing and accreditation views

Implementation backbone: Document template, signing, payment terms, accreditation, NDA, and audit APIs

Database backbone: DocumentTemplate, SignedDocument, PaymentTerms, AccreditationDocument, NDARecord, DocumentAudit

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-67 | Document Template Pre-Fill System | Phase 2 | PMCM uploads existing Word templates for conforme and billing statement during onboarding. System pre-fills variable fields from event record. PMCM reviews and sends. Never generates legal documents from scratch. |
| FR-68 | Dual Signing Path | Phase 2 | E-signature is default and primary path. Physical signing available as fallback: PMCM downloads PDF, client signs physically, scans and returns, PMCM uploads manually. Both paths produce timestamped signed document. |
| FR-69 | Flexible Payment Terms Configuration | Phase 2 | 50% downpayment always fixed and non-negotiable. Remaining 50% configurable across up to three payment milestones. Repeat clients may have adjusted terms with PMCM override and documented reason. |
| FR-70 | Accreditation Document Tracker | Phase 2 | Tracks submission of required accreditation documents for large corporate clients. Has own SLA timer. Does not block planning from starting. |
| FR-96 | Event Cancellation Workflow | Prism | PMCM initiates cancellation with reason field and double confirmation screen. Automatic cascade to all supplier and coordinator assignments. Cancellation Financial Summary generated showing downpayment status, sunk costs, and cancellation fee calculation (10 to 15 percent of contract amount when conforme is signed). No cancellation fee when conforme has not yet been signed. |
| FR-97 | Event Postponement Workflow | Prism | PMCM marks event as Postponed with reason field and new date or Date To Be Confirmed. Automatic impact assessment: supplier availability re-check, coordinator availability re-check, venue confirmation sub-ticket created. No cancellation fee for postponements ever. Downpayment retained and applied to rescheduled event. |

### Demo Focus
| FR # | Feature | Scope | Demo focus |
| --- | --- | --- | --- |
| FR-67 | Document Template Pre-Fill System | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-68 | Dual Signing Path | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-69 | Flexible Payment Terms Configuration | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-70 | Accreditation Document Tracker | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-96 | Event Cancellation Workflow | Prism | Live walkthrough in seeded defense data. |
| FR-97 | Event Postponement Workflow | Prism | Live walkthrough in seeded defense data. |

## Supplier Management

Primary surface: PMCM supplier directory, quote comparison, supplier portal

Implementation backbone: Supplier, category, quote request, quote comparison, performance review, emergency replacement APIs

Database backbone: Supplier, SupplierCategory, SupplierTier, QuoteRequest, QuoteSubmission, SupplierReview, SupplierRiskProfile

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

### Demo Focus
| FR # | Feature | Scope | Demo focus |
| --- | --- | --- | --- |
| FR-14 | Supplier Directory with Category Tagging | Prism | Live walkthrough in seeded defense data. |
| FR-15 | Tier 1 and Tier 2 Supplier Designation | Prism | Live walkthrough in seeded defense data. |
| FR-16 | Supplier Selection Policy Layer | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-17 | Supplier Quote Request and Comparison | Prism | Live walkthrough in seeded defense data. |
| FR-18 | Supplier Competitive Bidding Module | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-49 | Confidential Bid Quote Request | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-63 | Supplier Gap Warning | Prism | Live walkthrough in seeded defense data. |
| FR-64 | Supplier Communication Thread | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-75 | Supplier Formal Assignment Notification | Prism | Live walkthrough in seeded defense data. |
| FR-76 | Supplier Unresponsive Escalation with Viber Deep Link | Prism | Live walkthrough in seeded defense data. |
| FR-77 | Supplier Contract Mismatch Warning | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-78 | Ingress and Egress Schedule View | Prism | Live walkthrough in seeded defense data. |
| FR-79 | Supplier Reliability Notes | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-87 | Outsourced Creative Designer Sub-Ticket | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| New-S1 | Supplier Registration Page | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| New-S2 | Supplier Applications Inbox | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| New-S3 | Pending First Event Status | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| New-S4 | Supplier Performance Assessment | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| New-S5 | PMCM Internal Supplier Review | Prism | Live walkthrough in seeded defense data. |
| FR-AI-06 | Probabilistic Supplier Reliability Scoring Model | AI | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. |
| FR-AI-04 | P.R.I.S.M Agentic Response Engine (PARE) — Multi-Agent Emergency Response | Agentic | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. |

## Financial Management

Primary surface: PMCM billing workspace and client payment visibility

Implementation backbone: Billing statement, payment milestone, partial payment, waiver, and collection reminder APIs

Database backbone: BillingStatement, PaymentMilestone, PaymentRecord, WaiverReason, CollectionReminder

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-20 | Billing Statement Generation | Prism | Auto-triggered upon conforme signing. Generates numbered billing statement with client details, event name, total amount due, payment terms, and accepted payment methods. Linked directly to approved proposal and CE for dispute reference. |
| FR-21 | Post-Event Additional Billing Statement | Prism | Issues supplementary billing for extra work done during or after event. Linked to Urgent Issue ticket that triggered extra work. Mark as Waived option with documented reason for goodwill cases. |
| FR-92 | Payment Milestone Tracker | Prism | Tracks confirmed payment milestones: 50% downpayment upon conforme signing and 50% balance 7 days before event. Configurable up to three milestones. Automated reminders at configurable intervals. Payment Overdue Alert on dashboard. Payment At Risk flag at 48 hours. |
| FR-93 | Partial Payment Recording | Phase 2 | PMCM records partial payment amount and date. System calculates remaining balance. Partial Payment Received status on dashboard. PMCM prompted to follow up on outstanding balance. |
| FR-94 | Billing Statement to Proposal Link | Phase 2 | Every billing statement directly linked to approved proposal and CE. Two severity levels: typo correction and amount discrepancy. Billing Dispute flag raises formal record with resolution notes. |

### Demo Focus
| FR # | Feature | Scope | Demo focus |
| --- | --- | --- | --- |
| FR-20 | Billing Statement Generation | Prism | Live walkthrough in seeded defense data. |
| FR-21 | Post-Event Additional Billing Statement | Prism | Live walkthrough in seeded defense data. |
| FR-92 | Payment Milestone Tracker | Prism | Live walkthrough in seeded defense data. |
| FR-93 | Partial Payment Recording | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-94 | Billing Statement to Proposal Link | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |

## Floor Plan Builder

Primary surface: Canvas floor plan editor and client annotation/approval view

Implementation backbone: Floor plan, venue, preset, annotation, approval, and export APIs

Database backbone: FloorPlan, Venue, VenueFeature, FloorPlanPreset, FloorPlanAnnotation, FloorPlanApproval

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-80 | Floor Plan Builder with Draggable Element Library | Prism | Canvas-based tool for creating floor plans directly inside P.R.I.S.M. Pre-built draggable elements organized by category: Furniture, Stage and Production, Registration and Flow, Safety. Built using Konva.js or Fabric.js for React. |
| FR-81 | Venue Library | Phase 2 | Saves venue space dimensions and permanent features after each ocular. Pre-loads accurate canvas with permanent walls, pillars, emergency exits, fixed stage direction, loading bay, and venue rules on reuse. |
| FR-82 | Quick Setup Presets | Phase 2 | 18 event-type-specific presets based on confirmed PMCM event types. One-click auto-arrangement based on venue canvas dimensions and confirmed pax count. Editor adjusts from preset. |
| FR-83 | Client Floor Plan Annotation and Approval | Prism | Client views floor plan in portal. Can annotate directly on canvas. Only designated primary contact annotations are actionable. Others flagged as Non-Binding Notes. Full revision history tracked. Floor plan locked once formally approved. |
| FR-84 | Table Assignment List | Phase 2 | Available only for private events under 200 pax. Each table assigned a number or name. PMCM or client assigns guest names from uploaded masterlist to specific tables. Printable seating list output. |

### Demo Focus
| FR # | Feature | Scope | Demo focus |
| --- | --- | --- | --- |
| FR-80 | Floor Plan Builder with Draggable Element Library | Prism | Live walkthrough in seeded defense data. |
| FR-81 | Venue Library | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-82 | Quick Setup Presets | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-83 | Client Floor Plan Annotation and Approval | Prism | Live walkthrough in seeded defense data. |
| FR-84 | Table Assignment List | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |

## Coordinator Management

Primary surface: PMCM coordinator staffing desk and coordinator portal

Implementation backbone: Coordinator, assignment, acknowledgment, availability, withdrawal, and replacement APIs

Database backbone: Coordinator, CoordinatorSkill, CoordinatorAssignment, AvailabilityBlock, Acknowledgment, ReplacementLog

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

### Demo Focus
| FR # | Feature | Scope | Demo focus |
| --- | --- | --- | --- |
| FR-88 | Coordinator Double Booking Detection | Prism | Live walkthrough in seeded defense data. |
| FR-89 | Coordinator Withdrawal and Replacement | Prism | Live walkthrough in seeded defense data. |
| FR-90 | Coordinator Assignment Acknowledgment | Prism | Live walkthrough in seeded defense data. |
| FR-91 | Coordinator Availability and Staffing View | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| New-C1 | Coordinator Role-Specific Portal Views | Prism | Live walkthrough in seeded defense data. |
| New-C2 | Event Day System Operator Role Tag | Prism | Live walkthrough in seeded defense data. |
| New-C3 | Coordinator Late Arrival and No Show Flag | Prism | Live walkthrough in seeded defense data. |
| New-C4 | Task Reassignment with Ms. Mys Notification | Prism | Live walkthrough in seeded defense data. |

## Post-Event and Archive

Primary surface: PMCM post-event workspace, archive, insights, and client deliverable acknowledgment

Implementation backbone: Post-event deliverable, archive, comparison, insights, supplier review, and testimonial APIs

Database backbone: PostEventDeliverable, EventArchive, EventInsight, SupplierInternalReview, TestimonialRequest, ClosureChecklist

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

### Demo Focus
| FR # | Feature | Scope | Demo focus |
| --- | --- | --- | --- |
| FR-22 | Post-Event Documentation Submission Tracker | Prism | Live walkthrough in seeded defense data. |
| FR-23 | Event Archive with Search | Prism | Live walkthrough in seeded defense data. |
| New-P1 | Event Comparison View | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| New-P2 | Event Insights Card | Prism | Live walkthrough in seeded defense data. |
| New-P3 | Client Testimonial Feature | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| New-P4 | Logistics Booking Record | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| New-P5 | Additional Billing Waiver | Prism | Live walkthrough in seeded defense data. |
| FR-AI-08 | Post-Event Intelligence Layer (PEIL) | AI | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. |

## System Configuration and Event Lifecycle

Primary surface: PMCM admin settings, lifecycle controls, notification preferences

Implementation backbone: Module toggle, notification, data anonymization, lifecycle, cancellation, and activity APIs

Database backbone: ModuleToggle, NotificationPreference, DataAnonymizationRequest, LifecycleState, CancellationPolicy, ActivityHistory

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

### Demo Focus
| FR # | Feature | Scope | Demo focus |
| --- | --- | --- | --- |
| FR-24 | Toggle System | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-25 | Dual Notification System | Prism | Live walkthrough in seeded defense data. |
| FR-55 | Bilingual Notification Email Templates | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-56 | Data Anonymization Tool | Prism | Live walkthrough in seeded defense data. |
| New-SY1 | Post-Event Wrap-Up Screen | Prism | Live walkthrough in seeded defense data. |
| New-SY2 | One-Screen Close | Prism | Live walkthrough in seeded defense data. |
| New-SY3 | Change Freeze Deadline | Prism | Live walkthrough in seeded defense data. |
| New-SY4 | Addendum Conforme Workflow | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
