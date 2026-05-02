# Coordinator Features

This file is split from the complete P.R.I.S.M Version 4 catalog for easier implementation and demo preparation.

## Coordinator Features

Primary surface: Mobile-first coordinator/event-day portal

Implementation backbone: Coordinator assignment, role view, guest check-in, ingress/egress, urgent issue, and communication APIs

Database backbone: CoordinatorAssignment, CoordinatorTask, GuestCheckIn, SupplierArrival, UrgentIssue, EventThread

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| New-CO1 | Coordinator Portal Homepage | MVP | Simple list of active event assignments. Each card shows event name, date, venue, and assigned role in bold. Tapping opens role-specific view. Completed events in simple archive. Mobile-first design. |
| New-CO2 | Floor Director and Stage Director View | MVP | Role badge prominently displayed. Event details with call time. Briefing documents (script, floor plan, role instructions, attire, call times). Task list with In Progress and Done toggles. Communication thread with Event Day System Operator and Ms. Mys. Urgent Issue button. |
| New-CO3 | Registration Staff View | MVP | Role badge prominently displayed. Searchable guest masterlist with Check In button per guest. Walk-In Addition button. Flag for Verification button for unauthorized walk-ins. Real-time attendance count. Laptop-optimized interface. |
| New-CO4 | Ingress and Egress Assistant View | MVP | Role badge prominently displayed. Supplier schedule with Arrived, Set Up and Ready, and Done and Leaving status buttons. Verified toggle after physical check. Photo upload per supplier. Late Arrival flag auto-appears after 15 minutes past scheduled window. |
| New-CO5 | Event Day System Operator View | MVP | Role badge prominently displayed. Full event task dashboard with status lanes on laptop. Supplier status overview. Coordinator check-in section. Urgent Issue log with one-tap access. Task reassignment tool with Ms. Mys notification. Wrap-up screen access after event. Real-time attendance feed from registration staff. |
| New-CO6 | Usher and General Coordinator View | MVP | Role badge prominently displayed. Simple instruction list with specific post and responsibilities. Urgent Issue button. Minimal interface. |
| FR-90 | Coordinator Assignment Acknowledgment | MVP | Formal yes confirmation required from all coordinators. Pending Acknowledgment tracked on PMCM dashboard. Digital replacement for Viber group chat reconfirmation. |

### Demo Focus
| FR # | Feature | Scope | Demo focus |
| --- | --- | --- | --- |
| New-CO1 | Coordinator Portal Homepage | MVP | Live walkthrough in seeded defense data. |
| New-CO2 | Floor Director and Stage Director View | MVP | Live walkthrough in seeded defense data. |
| New-CO3 | Registration Staff View | MVP | Live walkthrough in seeded defense data. |
| New-CO4 | Ingress and Egress Assistant View | MVP | Live walkthrough in seeded defense data. |
| New-CO5 | Event Day System Operator View | MVP | Live walkthrough in seeded defense data. |
| New-CO6 | Usher and General Coordinator View | MVP | Live walkthrough in seeded defense data. |
| FR-90 | Coordinator Assignment Acknowledgment | MVP | Live walkthrough in seeded defense data. |
