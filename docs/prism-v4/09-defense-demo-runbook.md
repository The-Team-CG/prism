# P.R.I.S.M Defense Demo Runbook

Last updated: 2026-05-02

This runbook is the local-only May 9, 2026 defense path. It should be used with the active Turborepo workspace and the seeded demo data. It is not the full V4 roadmap and does not require SendGrid, Viber, OAuth, QR scanning, file storage, Canva, Zoom, external auth, ticketing, or live AI.

## Start And Reset

1. Start the stack from the repo root:
   `.\start-prism.cmd`
2. Open these surfaces:
   - PMCM and coordinator command: `http://localhost:3004`
   - Client portal: `http://localhost:3001`
   - Supplier portal: `http://localhost:3002`
   - Guest portal: `http://localhost:3003`
   - API health: `http://localhost:4000/health`
3. Use the PMCM command app reset action only when the demo needs a fresh seeded lifecycle.

## Demo Accounts

| Role | URL | Account |
| --- | --- | --- |
| PMCM admin | `http://localhost:3004` | `mys@pmcm.test` / `prism-admin` |
| Coordinator | `http://localhost:3004` | `marco@pmcm.test` / `prism-coordinator` |
| Client | `http://localhost:3001/sign-in` | `ana@ayala.test` / `prism-client` |
| Supplier | `http://localhost:3002/sign-in` | `ops@xperto.test` / `prism-supplier` |
| Guest | `http://localhost:3003/open` | event access code generated in the PMCM selected-event workspace |

## Defense Story

1. **Public inquiry**
   - Open the client public landing and inquiry page.
   - Show that public pages explain the operating-system lifecycle and do not link straight to dashboards.
   - Submit or reference the seeded inquiry.

2. **PMCM acceptance and conforme**
   - Sign in as PMCM admin.
   - Open the inquiry/onboarding area.
   - Accept or review the seeded inquiry, then show signed-conforme status and portal unlock.
   - Emphasize that planning starts only after accepted inquiry plus signed conforme.

3. **Client portal**
   - Sign in as the client.
   - Show the confirmed event workspace, briefing, billing milestones, documents, activity, and official floorplan review.
   - Show that the client can submit layout preferences but can only open PMCM official floorplans read-only.

4. **Planning workspace**
   - Return to PMCM selected-event workspace.
   - Show the defense readiness score, action queue, workflow tabs, floorplan drafts, briefing, supplier quote planner, and financial workspace.
   - Explain that notification records are in-app/local for defense and do not claim production email or Viber delivery.

5. **Supplier quote and readiness**
   - Sign in as supplier.
   - Show quote requests, quote submit/revise/locked state, awarded assignment confirmation, readiness confirmation, contract metadata, and event-day status buttons.
   - Make clear suppliers only see their own request/assignment context.

6. **Event-day operations**
   - In PMCM command, open live operations.
   - Show tasks, urgent issue escalation, supplier setup verification, coordinator attendance, and coordinator replacement flow.
   - Sign in as coordinator and show role-safe event-day controls without PMCM finance, audit, or private supplier review data.

7. **Guest access**
   - Open guest code entry.
   - Show event-code gate, guest check-in, walk-in flagging, consent copy, attendance count, and feedback moderation state.

8. **Closure and archive**
   - Return to PMCM closure/archive.
   - Show close gates, override reason when needed, deterministic event insights, and archive status.
   - Explain archive search/comparison as local defense polish when visible, with richer post-defense roadmap items deferred.

## Verification Before Presenting

Run:

```powershell
npm run typecheck
npm run build
npm --workspace prism-api run test
npm run smoke:ui
git diff --check
```

If Windows sandboxing reports `spawn EPERM` for Vitest or `.next` unlink failures for explicit Next builds, rerun the same command outside the sandbox. Treat that as environment noise only when the rerun passes.

## Hard Boundaries To Say Out Loud

- PMCM owns official floorplan editing.
- Client official floorplan access is read-only.
- Supplier quotes and PMCM private supplier reviews are supplier-scoped or PMCM-only.
- Guests require an event code.
- Coordinator views are role-safe and do not expose PMCM finance/audit/private supplier data.
- Live AI is blocked until ZDR, sanitization, audit rows, and PMCM approval gates are verified end to end.
