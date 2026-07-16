# P.R.I.S.M Portal Accounts

Sample / defense accounts for every role portal. These are **local demo credentials only** — not production users.

Accounts exist after sample reset recreates demo users. Password values are stored hashed in `OpsUser`; the plain passwords below are for local sign-in.

## Portals

| Portal | App | URL | Who signs in |
| --- | --- | --- | --- |
| Client | `apps/client` | http://localhost:3001/sign-in | Approved client |
| Supplier | `apps/supplier` | http://localhost:3002/sign-in | Approved supplier |
| Guest | `apps/guest` | http://localhost:3003/open | Event access code (no password account) |
| Event command | `apps/event` | http://localhost:3004 | PMCM admin + coordinator |
| API | `apps/api` | http://localhost:4000 | Shared backend for all portals |

## Sample accounts

| Portal | Role | Name | Email | Password / code | Notes |
| --- | --- | --- | --- | --- | --- |
| Event command | `pmcm-admin` | Ms. Mys | `mys@pmcm.test` | `prism-admin` | Full PMCM command access |
| Event command | `coordinator` | Marco Santos | `marco@pmcm.test` | `prism-coordinator` | Role-safe coordinator workspace |
| Client | `client` | Ana Reyes | `ana@ayala.test` | `prism-client` | Ayala Tech Summit sample client |
| Supplier | `supplier` | XPERTO Registration | `ops@xperto.test` | `prism-supplier` | Tier 1 digital registration (primary) |
| Supplier | `supplier` | Bloom Florals | `flowers@bloom.test` | `prism-supplier` | Tier 2 floral sample |
| Guest | guest pass | — | — | `AYALA-TECH-YALA` | Derived from sample event `Ayala Tech Summit 2026` / `evt_sample_ayala` |

### Quick copy

```text
# Event command (PMCM)
mys@pmcm.test / prism-admin

# Event command (coordinator)
marco@pmcm.test / prism-coordinator

# Client portal
ana@ayala.test / prism-client

# Supplier portal
ops@xperto.test / prism-supplier
flowers@bloom.test / prism-supplier

# Guest portal (open page)
Access code: AYALA-TECH-YALA
Guest name: any display name (e.g. Sofia Lim)
```

## How to load / refresh accounts

Start does **not** seed data.

1. Ensure `apps/api/.env` has database URLs (Docker uses `.env.docker`).
2. Fast local: `start-prism.cmd` — Docker: `start-prism-docker.cmd`
3. To recreate sample users/events, use **Reset sample data** in the event command app.

After a sample reset you should be able to sign in with every account above.

## Portal boundaries

- **Client** only accepts `client` role sessions.
- **Event command** accepts `pmcm-admin` and `coordinator`.
- **Supplier** only accepts `supplier` role sessions.
- **Guest** does not use email/password login. Guests open an event pass with the access code shown in the PMCM selected-event workspace (and the sample code above).

Signing into the wrong portal with a valid account from another role returns a portal-boundary message; use the URL for that role.

## Source of truth in code

| Concern | Location |
| --- | --- |
| Sample `OpsUser` rows + passwords (via sample reset only) | `apps/api/libs/modules/sample-compatibility/src/services/sample-compatibility.service.ts` |
| Sample suppliers (matched by email for supplier workspace) | same file (`SEEDED_SUPPLIERS`) |
| Guest access-code derivation | `apps/api/libs/modules/guest-ops/src/services/guest-workflow.service.ts` (`guestAccessCode`) |
| Product / ops docs | `docs/README.md`, `docs/prism-v4/16-actual-system.md` |

## Security note

These credentials are intentional sample fixtures for local defense and development. Do not reuse them in production or shared non-demo environments.
