# DES-04 · Sprint 2 UX Brief

**DES-04 · Sprint 2 UX Brief** _Shell pattern, density rules, page title rules, action hierarchy, state languageOwner: Maxine (UIUX Lead) · Applies to: Francis (EVTAPP/PMCM) and Ethan (External portals)_
* * *
**1\. SHELL PATTERN**
P.R.I.S.M has five portal contexts. Each has a fixed shell frame. Do not invent a sixth pattern.

| Portal | Primary nav | Scrollable area | Notes |
| ---| ---| ---| --- |
| PMCM Admin | Left sidebar, persistent | Main content area | Sidebar collapses to icon-only on tablet |
| Client Portal | Top nav, minimal | Page content | No sidebar; client never sees internal structure |
| Supplier Portal | Top nav, minimal | Page content | Mobile-first; event day view hides nav entirely |
| Coordinator Portal | Top nav, minimal | Page content | Mobile-first; event day view hides nav entirely |
| Public (Inquiry) | No nav | Single-page scroll | No authenticated shell |

Rules for all shells:
*   Shell chrome (header, sidebar/nav) is **fixed and never scrolls** with content
*   Role identity (user name + role badge) always appears in the top-right of the header
*   Notification bell is top-right, adjacent to role badge, PMCM Admin only
*   No nested sidebars. No fly-out mega-menus. No tabs inside tabs.
*   The authenticated shell **never appears** on the Public Inquiry Page
* * *
**2\. DENSITY RULES**
PMCM Admin surfaces are information-dense. Client, supplier, coordinator surfaces are lean. Do not cross these lanes.
**PMCM Admin (dense)**
*   Tables are the default for list data (inquiries, events, suppliers, tasks, coordinators)
*   Max visible columns without horizontal scroll: 6
*   Rows paginate at 25; infinite scroll is banned
*   Metric tiles are used on the Live Operations Dashboard only — not on every page
*   Section panels group related content with a labeled divider header; no accordion nesting beyond one level
**Client Portal (lean)**
*   Cards are the default for list data (active events, pending actions, documents)
*   Max items per page before pagination: 10
*   Tables only appear in: payment milestone tracker, document submission list
*   No metric tiles. No data-dense dashboards.
**Supplier Portal (lean, mobile-first)**
*   Event day view: full screen status buttons only (Arrived / Set Up and Ready / Done and Leaving per FR-SUP1)
*   Pre-event view: single-column card list
*   No tables anywhere in supplier-facing views
**Coordinator Portal (lean, mobile-first)**
*   Event day view: role-specific task list with toggle actions, Urgent Issue button always visible (per FR-CO2 through FR-CO6)
*   No tables anywhere in coordinator-facing views
*   Registration Staff exception: guest masterlist uses a simplified table with large tap targets (per FR-CO3) on laptop
* * *
**3\. PAGE TITLE RULES**
Every authenticated page has exactly one `<PageTitle>`. No page is ever untitled.
**Format:** `[Section Name] · [Context Name]` Examples:
*   `Event Command · Sandico Corporate Gala 2026`
*   `Supplier Readiness · DJ Setup – June 28`
*   `Client Action Center · Santos Wedding`
*   `Guest Registration · Santos Wedding`
Rules:
*   Section Name = the functional area (always present)
*   Context Name = the event name, supplier name, or user-specific context (present whenever the page is scoped to a record; omit on list/index pages)
*   Page title renders as `H1`, visually dominant, left-aligned, below the header chrome
*   **No subtitle below the H1** unless it is a status badge (see Section 5)
*   Breadcrumb appears only on PMCM Admin pages that are 3+ levels deep; max two crumbs visible before truncation with ellipsis
*   Do not use the portal name as the page title (e.g., never just "PMCM Admin" or "Client Portal")
* * *
**4\. ACTION HIERARCHY**
Every page has at most **one primary action**. If you think you need two, you're wrong — pick one or scope the page differently.
**Tier 1 – Primary Action**
*   Filled button, brand color
*   Placement: sticky bottom bar on mobile; top-right of page header on desktop (PMCM); end of form on client/supplier/coordinator
*   Examples: Submit Inquiry, Approve Floor Plan, Confirm Readiness, Send Proposal, Log Urgent Issue
**Tier 2 – Secondary Action**
*   Outlined button, same row as primary on desktop
*   Examples: Save Draft, Request Revision, Download, Export
**Tier 3 – Tertiary / Ghost**
*   Text link or ghost button
*   Examples: Cancel, View History, Go Back
**Destructive actions (Delete, Cancel Event, Decline)**
*   Always red/danger treatment
*   Always require a second confirmation screen with typed reason field — no single-tap destructive actions anywhere in the system
*   Never placed adjacent to the primary action; must be visually separated (minimum row gap or section break)
**Floating actions**
*   Urgent Issue button on coordinator and EVTAPP event-day views is the **only permitted FAB** (floating action button)
*   No other FABs anywhere in the system
* * *
**5\. STATE LANGUAGE**
Use these exact strings. Do not write your own. If a state is missing, flag it to Maxine before shipping.
**Loading**
> _Loading \[content type\]…_ Examples: "Loading events…", "Loading supplier list…", "Loading guest list…"
**Empty (no records exist yet)**
> _No \[content type\] yet._ Subtext: _\[Next action instruction.\]_ Examples:  
> "No events yet. Add your first inquiry to get started."  
> "No suppliers assigned. Assign suppliers from the Supplier Directory."  
> "No tasks assigned for this event."
**Empty (filtered — records exist but filter returns nothing)**
> _No results for "\[filter value\]"._ Subtext: _Try a different search or clear your filters._
**Error (system/network)**
> _Something went wrong._ Subtext: _Refresh the page or try again in a moment. If this keeps happening, contact your administrator._
**Error (form validation)**
> _\[Field name\] is required._ (inline, below the field — never in a toast) Do not use generic "Please fill in all fields" banners.
**No permission / role boundary**
> _You don't have access to this section._ Subtext: _Contact PMCM Admin if you need access._
**Success (action confirmed)**
> Toast notification, bottom-center, auto-dismisses after 4 seconds Format: _\[Action\] successful._ Examples: "Readiness confirmed.", "Floor plan approved.", "Urgent issue logged." Do not use exclamation marks. Do not say "Great!" or "Done!".
**Offline (coordinator/supplier event-day only)**
> Banner at top of screen, persistent until reconnected: _You're offline. Actions will sync when you reconnect._
* * *