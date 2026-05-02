# Guest Features

This file is split from the complete P.R.I.S.M Version 4 catalog for easier implementation and demo preparation.

## Guest Features

Primary surface: Guest registration, engagement, and post-event upload pages

Implementation backbone: Guest registration, QR, check-in, game, review, moderation APIs

Database backbone: Guest, GuestCheckIn, WalkInRequest, EngagementSession, GuestReview, ModerationQueue

| FR # | Feature | Scope | Description |
| --- | --- | --- | --- |
| FR-39 | Digital Registration and Masterlist | MVP | Three check-in modes. Mode 1 QR Code: optional upgrade when client provides email addresses. Mode 2 Name-Based Digital Checklist: default for private events. Mode 3 Headcount Only: very small informal events. Walk-in guest addition on spot. Unauthorized walk-ins trigger Flag for Verification per client-set walk-in policy. Real-time attendance count on dashboard. |
| FR-40 | In-Event Engagement Feature with Game Builder | Phase 2 | Five pre-built customizable game templates: Live Poll, Word Cloud, Ice Breaker Quiz, Raffle Draw, Open Q and A. QR code on LED wall opens web page on guest phone browser. No app download or account needed. |
| FR-41 | Post-Event Experience Upload with Moderation | Phase 2 | QR code generated per event after closure. Guests scan and access simple web page: star rating, short text review, photo upload, short video upload maximum 60 seconds. All submissions go to PMCM moderated review queue. Client permission required before any public use. |
| FR-95 | Lightweight Digital Registration Module | MVP | Supports all three check-in modes. QR code generation using standard libraries. Browser-based QR scanning requiring HTTPS. Manual name search and check-in interface on laptop. Walk-in addition form. Unauthorized walk-in flag. Attendance count on Live Operations Dashboard in real time. |
| New-GU1 | Ticket-Based Event Registration Coordination | Phase 2 | For large events 200 to 250 pax and above using XPERTO or client-chosen platform. PMCM records registration platform details in event file hub. Digital Registration supplier sub-ticket tracks platform setup confirmation. Final headcount data imported from XPERTO after event. P.R.I.S.M does not handle ticket sales or payment processing. |

### Demo Focus
| FR # | Feature | Scope | Demo focus |
| --- | --- | --- | --- |
| FR-39 | Digital Registration and Masterlist | MVP | Live walkthrough in seeded defense data. |
| FR-40 | In-Event Engagement Feature with Game Builder | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-41 | Post-Event Experience Upload with Moderation | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
| FR-95 | Lightweight Digital Registration Module | MVP | Live walkthrough in seeded defense data. |
| New-GU1 | Ticket-Based Event Registration Coordination | Phase 2 | Roadmap walkthrough with designed screen, data model, and expected workflow. |
