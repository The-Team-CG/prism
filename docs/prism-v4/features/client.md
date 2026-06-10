# Client Features

This file is split from the complete P.R.I.S.M Version 4 catalog for easier implementation and demo preparation.

## Client Features

Primary surface: Client portal after signed conforme

Implementation backbone: Client portal, event progress, proposal review, floor plan approval, message, billing, and archive APIs

Database backbone: ClientAccount, ClientEventAccess, ProposalComment, FloorPlanAnnotation, ClientMessage, PaymentStatus

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

### Demo Focus
| FR # | Feature | Scope | Demo focus |
| --- | --- | --- | --- |
| FR-26 | Client Portal Access Gated by Signed Conforme | Prism | Live walkthrough in seeded defense data. |
| FR-27 | Event Progress Visibility | Prism | Live walkthrough in seeded defense data. |
| FR-28 | Client Draft Floor Plan Submission | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-29 | Official Floor Plan Viewing and Formal Approval | Prism | Live walkthrough in seeded defense data. |
| FR-30 | Venue Styling Moodboard Viewing and Formal Approval | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-31 | Budget Confirmation Module for Venue Styling | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-32 | Document Submission Portal | Prism | Live walkthrough in seeded defense data. |
| FR-33 | Per-Event File Hub Access | Prism | Live walkthrough in seeded defense data. |
| FR-34 | Notification of Task and Milestone Updates | Prism | Live walkthrough in seeded defense data. |
| FR-65 | Client-Owned Supplier Sub-Ticket | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-66 | Venue Ocular Task Trigger | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| New-CL1 | Walk-In Policy Setting | Prism | Live walkthrough in seeded defense data. |
| New-CL2 | Event Day Limited View | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
