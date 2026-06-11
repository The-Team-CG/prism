# Supplier Features

This file is split from the complete P.R.I.S.M Version 4 catalog for easier implementation and sample preparation.

## Supplier Features

Primary surface: Supplier portal and PMCM supplier directory

Implementation backbone: Supplier profile, quote submission, assignment confirmation, contract upload, availability, and review APIs

Database backbone: Supplier, SupplierProfile, QuoteSubmission, AssignmentConfirmation, SupplierContract, SupplierAvailability

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

### Sample Focus
| FR # | Feature | Scope | Sample focus |
| --- | --- | --- | --- |
| FR-35 | Supplier Profile with Category Tagging and Tier Designation | Prism | Live walkthrough in seeded defense data. |
| FR-36 | Quote Submission | Prism | Live walkthrough in seeded defense data. |
| FR-37 | Event Assignment Confirmation | Prism | Live walkthrough in seeded defense data. |
| FR-38 | Contract and Terms of Service Upload | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-49 | Confidential Bid Quote Request | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-64 | Supplier Communication Thread Access | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| New-SUP1 | Supplier Event Day Status Updates | Prism | Live walkthrough in seeded defense data. |
| New-SUP2 | Pre-Event Readiness Confirmation | Prism | Live walkthrough in seeded defense data. |
| New-SUP3 | Supplier Registration Page | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| New-SUP4 | Supplier Application Status Tracking | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-AI-04b | PARE — Supplier Replacement Recommendation (Supplier-Facing Output) | Agentic | Show sanitized sample input, AI output draft, AIAuditLog row, and explicit PMCM approval gate. |
