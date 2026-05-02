# P.R.I.S.M System Behaviors

System behaviors are automatic rules and logic the system follows across phases. They are not standalone screens, but they must be visible through status changes, validation, logs, or notifications during implementation and demo.

Note: the source count summary lists 37 system behaviors, but the source behavior table contains 38 data rows. This Markdown file preserves all 38 behavior rows from the table.

## All Behaviors
| System Behavior | What It Does | Phase |
| --- | --- | --- |
| Addendum Conforme Workflow | Client-driven scope additions require new conforme signed before change is implemented. New conforme triggers updated billing statement automatically. | Phase 3 |
| Change Freeze Deadline Enforcement | Hard deadline 5 days before event. Client scope changes frozen automatically and routed to post-event billing. Internal operational adjustments always allowed. | Phase 3-4 |
| Multi-Day Event Support | Setup Day, Event Day, and Egress Day activated as distinct phases with separate sub-tickets per day for multi-day events. | All Phases |
| Duplicate Inquiry Detection | System checks for matching email and approximate event date on submission. Flags duplicates to PMCM rather than blocking them outright. | Phase 1 |
| Awaiting Conforme Status | Automated PMCM follow-up reminders sent at configurable intervals when client delays signing conforme. | Phase 1 |
| Portal Invitation Resend | Invitation resend capability with expiry tracking: sent, opened, and expired status visible to PMCM. | Phase 1 |
| Returning Client Recognition | New inquiry from same email auto-linked to existing client account. New event workspace added alongside full event history. | Phase 1 |
| Urgency Flag on Bid Deadline | Escalation engine recognizes bid deadlines same as SLA thresholds. Urgency flag appears when deadline is within critical window. | Phase 1 |
| Draft Pending Review on Bid Conversion | All carried-over bid content flagged as Draft Pending Review when Bid Workspace converts to full event workspace after winning. | Phase 1 |
| Dormant Client Reactivation Notification | PMCM receives historical event summary when a dormant client account submits a new inquiry. | Phase 1 |
| Previously Rejected Prospect Flag | Previous rejection with reason surfaced on new inquiry from same email address. | Phase 1 |
| Change Scope Flag | PMCM alerted when client introduces requirements significantly outside original inquiry scope after briefing form is submitted. | Phase 2 |
| Proposal Stalled Status | After configurable unanswered reminders post-proposal submission, status escalates to Proposal Stalled and PMCM alerted to take direct action. | Phase 2 |
| Compliance Rules Per Event Type | Compliance rule set configurable per event type using three-layer architecture. Layer 2 conditional rules triggered automatically by event type from briefing form. | Phase 2+4 |
| Sub-Ticket Hard Dependency | Task B locked with Waiting for Dependency status until Task A is marked complete. System unlocks automatically and notifies assigned owner when dependency is resolved. | Phase 3 |
| Sub-Ticket Soft Parallel | Tasks flagged as parallel run simultaneously without blocking each other. Both show as active on the dashboard. | Phase 3 |
| Production-First Ingress Sequencing | Default ingress setup order: Production first, then Venue Styling, then other suppliers by setup complexity. PMCM can adjust per event. | Phase 3+5 |
| Supplier Personnel Change as Risk Warning | When supplier informs PMCM that their team leader for an event has changed, system logs this as a Risk Warning on the supplier sub-ticket not a Critical Flag. | Phase 3 |
| Post-Event Billing Chain | Client additions during event logged as Urgent Issues. Supplier bills PMCM post-event. PMCM bills client via additional billing statement linked to the original Urgent Issue ticket. | Phase 5+6 |
| PMCM Supplier Review Prompt | After each event is formally closed, PMCM receives a prompt to review each assigned supplier. Review is internal only and never visible to suppliers or clients. | Phase 6 |
| Pre-Event Compliance Re-Check | Automatically runs 7 days before event across all three compliance layers. Generates Pre-Event Readiness Report. Event flagged as Not Ready until all Must-Fix Items resolved. | Phase 4 |
| Payment At Risk Flag | Triggered 48 hours before event if 50% downpayment has not been recorded. PMCM prompted to make direct decision on whether to proceed or pause supplier confirmations. | Phase 4 |
| Cancellation Financial Rules | No cancellation fee when conforme has not yet been signed. 10 to 15 percent cancellation fee applied when client cancels after conforme is signed. Configurable per event. Downpayment always retained for postponements. | Phase 3+6 |
| Postponement Date Cascade | All SLA timers, deadlines, and milestone dates across all sub-tickets update automatically when new event date is confirmed after postponement. | Phase 3+ |
| Wrap-Up 24-Hour Window | System sends reminders at 12-hour and 24-hour marks after event ends. Phase 6 post-event documentation tracking activates after 24 hours regardless of wrap-up completion status. | Phase 5-6 |
| Event Reopen Window | Closed event can be reopened within 7 days with documented reason. After 7 days formal amendment note required. Reopened event shown on dashboard with Correction In Progress status. | Phase 6 |
| Supplier Two-Level Confirmation | Self-Reported status when supplier says they are ready. Verified status when ingress assistant physically confirms setup. Dashboard shows which level each supplier has reached. | Phase 5 |
| BNI Member Auto-Trust Flag | BNI member suppliers flagged automatically in directory. No formal accreditation checklist required for BNI members. | Phase 3 |
| Coordinator Skills-Based Assignment Filter | When PMCM assigns coordinators, system filters available pool by event date availability, assigned role type, and skills tags relevant to event type. | Phase 3 |
| Email Format Validation on Inquiry | Standard email format validation on public inquiry form submission. Manual email correction field available on PMCM side of inquiry record. | Phase 1 |
| Company Name Change Log | Organization Merge Tool supports editing company name with full change history log preserved for reference. | Phase 1 |
| Parallel Inquiry Alert | Organization Merge Tool surfaces alert when two active inquiries from the same organization are submitted simultaneously by different contacts. | Phase 1 |
| AI Triage Auto-Run | AI Inquiry Triage Agent (FR-AI-01) runs automatically within 30 seconds of every new inquiry submission. Results stored in InquiryTriage table. PMCM Admin sees summary badge on inquiry card. | Phase 1 |
| ZDR Enforcement on Every AI Call | Before every Claude API call, system verifies ZDR is enabled on the API key. If ZDR cannot be confirmed, AI feature returns error and logs ZDR_UNCONFIRMED in AIAuditLog. No API call proceeds without ZDR confirmation. | All AI Phases |
| DataSanitizer Pre-Processing | Before every Claude API call, DataSanitizer service replaces: client names with anonymized labels (Client A), company names with category labels (Corporate Client), contact numbers and emails removed entirely, financial amounts formatted only (PHP 150,000), supplier names replaced with category labels (Supplier X - Production). | All AI Phases |
| AI Audit Log Entry | Every Claude API call logs to AIAuditLog table: timestamp, feature_name, data_categories_processed, model_version, tokens_consumed, zdr_confirmed (boolean), human_approval_required (boolean), human_approved (boolean or null if not yet actioned). | All AI Phases |
| Human Approval Gate Enforcement | No AI recommendation in P.R.I.S.M is executed automatically. Every AI output (triage score, proposal draft, compliance advisory, PARE recommendation, PEIL recommendation, copilot alert, communication draft) requires explicit PMCM Admin click to Approve before any system action is taken. | All AI Phases |
| PARE Emergency Activation | PARE Multi-Agent Emergency Response Engine (FR-AI-04) activates automatically when: a supplier marks as unavailable, PMCM Admin marks supplier as Withdrawn, or system detects Tier 1 unresponsive past quote deadline. PARE recommendation package presented to PMCM Admin within 20 seconds of trigger. | Phase 3-5 |

## AI-Related Behaviors
The final six behavior rows in the source table govern AI execution, privacy, audit logging, and human approval.

| System Behavior | What It Does | Phase |
| --- | --- | --- |
| AI Triage Auto-Run | AI Inquiry Triage Agent (FR-AI-01) runs automatically within 30 seconds of every new inquiry submission. Results stored in InquiryTriage table. PMCM Admin sees summary badge on inquiry card. | Phase 1 |
| ZDR Enforcement on Every AI Call | Before every Claude API call, system verifies ZDR is enabled on the API key. If ZDR cannot be confirmed, AI feature returns error and logs ZDR_UNCONFIRMED in AIAuditLog. No API call proceeds without ZDR confirmation. | All AI Phases |
| DataSanitizer Pre-Processing | Before every Claude API call, DataSanitizer service replaces: client names with anonymized labels (Client A), company names with category labels (Corporate Client), contact numbers and emails removed entirely, financial amounts formatted only (PHP 150,000), supplier names replaced with category labels (Supplier X - Production). | All AI Phases |
| AI Audit Log Entry | Every Claude API call logs to AIAuditLog table: timestamp, feature_name, data_categories_processed, model_version, tokens_consumed, zdr_confirmed (boolean), human_approval_required (boolean), human_approved (boolean or null if not yet actioned). | All AI Phases |
| Human Approval Gate Enforcement | No AI recommendation in P.R.I.S.M is executed automatically. Every AI output (triage score, proposal draft, compliance advisory, PARE recommendation, PEIL recommendation, copilot alert, communication draft) requires explicit PMCM Admin click to Approve before any system action is taken. | All AI Phases |
| PARE Emergency Activation | PARE Multi-Agent Emergency Response Engine (FR-AI-04) activates automatically when: a supplier marks as unavailable, PMCM Admin marks supplier as Withdrawn, or system detects Tier 1 unresponsive past quote deadline. PARE recommendation package presented to PMCM Admin within 20 seconds of trigger. | Phase 3-5 |
