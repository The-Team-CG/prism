# AI Features and Security Architecture

## Read This First
All 10 AI features in P.R.I.S.M use the Anthropic Claude API under a Zero Data Retention (ZDR) agreement. This means Anthropic does not store any inputs or outputs from P.R.I.S.M API calls. Before any data is sent to Claude, a DataSanitizer service replaces all personally identifiable information (client names, contact numbers, email addresses, financial specifics) with anonymized reference labels. Every AI API call is logged in the AIAuditLog database table. No AI feature can take any action without explicit PMCM Admin approval. This architecture complies with the Philippine Data Privacy Act of 2012 (RA 10173) and ITIL 4 Information Security Management practice (Axelos, 2019).

## AI Feature Matrix
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

## Required Implementation Pattern
| Step | Implementation requirement |
| --- | --- |
| 1. Confirm ZDR | Before any Claude request, verify the key/account is configured for Zero Data Retention. If it cannot be confirmed, stop and write `ZDR_UNCONFIRMED` to `AIAuditLog`. |
| 2. Sanitize data | Run `DataSanitizer` before the API call. Replace client names, company names, supplier names, contact details, and financial specifics with safe labels. |
| 3. Call model | Use the model specified by the feature matrix. Keep prompts feature-scoped and avoid sending raw files unless they have been sanitized. |
| 4. Save audit row | Persist timestamp, feature name, model version, processed data categories, token usage, ZDR status, and approval status. |
| 5. Require approval | Display the AI output as a draft or recommendation. No system action happens until PMCM Admin approves. |
| 6. Apply action | After approval, create the normal system record such as message draft, proposal draft, risk recommendation, supplier replacement package, or post-event insight. |

## AI-Related System Behaviors
| System Behavior | What It Does | Phase |
| --- | --- | --- |
| AI Triage Auto-Run | AI Inquiry Triage Agent (FR-AI-01) runs automatically within 30 seconds of every new inquiry submission. Results stored in InquiryTriage table. PMCM Admin sees summary badge on inquiry card. | Phase 1 |
| ZDR Enforcement on Every AI Call | Before every Claude API call, system verifies ZDR is enabled on the API key. If ZDR cannot be confirmed, AI feature returns error and logs ZDR_UNCONFIRMED in AIAuditLog. No API call proceeds without ZDR confirmation. | All AI Phases |
| DataSanitizer Pre-Processing | Before every Claude API call, DataSanitizer service replaces: client names with anonymized labels (Client A), company names with category labels (Corporate Client), contact numbers and emails removed entirely, financial amounts formatted only (PHP 150,000), supplier names replaced with category labels (Supplier X - Production). | All AI Phases |
| AI Audit Log Entry | Every Claude API call logs to AIAuditLog table: timestamp, feature_name, data_categories_processed, model_version, tokens_consumed, zdr_confirmed (boolean), human_approval_required (boolean), human_approved (boolean or null if not yet actioned). | All AI Phases |
| Human Approval Gate Enforcement | No AI recommendation in P.R.I.S.M is executed automatically. Every AI output (triage score, proposal draft, compliance advisory, PARE recommendation, PEIL recommendation, copilot alert, communication draft) requires explicit PMCM Admin click to Approve before any system action is taken. | All AI Phases |
| PARE Emergency Activation | PARE Multi-Agent Emergency Response Engine (FR-AI-04) activates automatically when: a supplier marks as unavailable, PMCM Admin marks supplier as Withdrawn, or system detects Tier 1 unresponsive past quote deadline. PARE recommendation package presented to PMCM Admin within 20 seconds of trigger. | Phase 3-5 |

## Demo Proof Required
| Evidence | What to show |
| --- | --- |
| Sanitized input | Show the before/after sample where private names, contacts, and supplier names are replaced before Claude is called. |
| AI output | Show the generated draft/recommendation without claiming it was automatically executed. |
| Audit row | Show `AIAuditLog` with ZDR confirmed, model, feature name, tokens, and approval fields. |
| Human approval | Show the PMCM Admin approval button/state and the resulting normal system action after approval. |
| Failure mode | Show or explain that an unconfirmed ZDR state blocks the call and logs the failure. |
