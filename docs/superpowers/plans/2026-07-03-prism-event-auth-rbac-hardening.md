# Prism Event Auth RBAC Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the event app's client-writable role boundary with a server-signed session token and have event-command API authorization derive actor role from that verified principal.

**Architecture:** Keep the current sample-auth database and password flow, but add a signed HMAC bearer token issued by `apps/api` after login. The event app may still cache the returned session in browser storage for UX, but all PMCM/coordinator API authorization must come from the verified token, not from `localStorage` role values or `actorRole` query parameters.

**Tech Stack:** NestJS 11, Node `crypto`, Prisma-backed sample auth, Vitest, Next.js event app, `@prism/types`, `@prism/api-client`.

---

## Implementation Notes

- Implemented the session contract as a flattened `PrismAuthenticatedSession` so existing event UI code can keep reading `session.role` for UX/routing, while API authorization uses `accessToken`.
- Added HMAC-signed bearer sessions in `identity-ops`; login now returns `accessToken`, `expiresAt`, `signedInAt`, and `tokenType` with the user fields.
- Guarded PMCM dashboard/workspace reads, coordinator workspace/role-view reads, and official floorplan create/submit/approve routes with `EventSessionGuard`.
- Hardened `/api/plans` behind the same verified bearer-session boundary for reads, writes, and exports; client access now requires a signed client session and owning-client plan checks.
- Left client preference submission on the existing query-actor path pending the broader actor-param endpoint sweep; official floorplan snapshot reads are now guarded by verified sessions.
## Scope

This plan covers the event command app and the API surfaces it uses:

- PMCM dashboard and selected event workspace reads.
- Coordinator workspace and coordinator role-view reads.
- Official floorplan create/submit/approve/snapshot routes.
- Floorplan editor plan read/update routes used by `apps/event`.
- Frontend session storage, sign-in, and API request helpers in `apps/event`.

This plan does not migrate client, supplier, guest, public inquiry, or tokenized supplier quote routes in the first landing patch. Those are covered by Task 8 as a follow-up sweep because they have different access models.

## File Structure

- Modify `packages/types/src/event-ops.ts`
  - Add shared authenticated session and verified actor types.
- Modify `packages/types/src/session.ts`
  - Keep canonical storage keys, but add helpers for authenticated session shape validation.
- Modify `packages/types/src/session.test.ts`
  - Cover rejection of stored event sessions that do not include a token.
- Modify `apps/api/libs/modules/identity-ops/src/services/auth-session.service.ts`
  - Create a no-dependency HMAC signed session token service.
- Add `apps/api/libs/modules/identity-ops/src/services/auth-session.service.test.ts`
  - Verify issue/verify/reject behavior.
- Modify `apps/api/libs/modules/identity-ops/src/services/auth-operations.service.ts`
  - Return a signed authenticated session after password login.
- Modify `apps/api/libs/modules/identity-ops/src/services/auth-operations.service.test.ts`
  - Add focused login return-shape coverage.
- Add `apps/api/libs/modules/identity-ops/src/guards/event-session.guard.ts`
  - Parse `Authorization: Bearer <token>` and attach `request.prismActor`.
- Add `apps/api/libs/modules/identity-ops/src/decorators/current-event-actor.decorator.ts`
  - Read the verified actor from the request in controllers.
- Modify `apps/api/libs/modules/identity-ops/src/identity-ops.module.ts`
  - Provide/export auth session service and guard.
- Modify `apps/api/libs/modules/identity-ops/src/index.ts`
  - Export the new service, guard, decorator, and request type.
- Modify `apps/api/libs/modules/access-control/src/services/event-access-policy.service.ts`
  - Add a verified-actor path and remove PMCM defaulting for protected routes.
- Modify `apps/api/libs/modules/access-control/src/services/event-access-policy.service.test.ts`
  - Prove request-supplied actor role cannot override a verified coordinator/client/supplier actor.
- Modify controller tests and controllers for:
  - `apps/api/libs/modules/event-read-models/src/controllers/pmcm-dashboard.controller.ts`
  - `apps/api/libs/modules/staffing-ops/src/controllers/coordinator-workspace.controller.ts`
  - `apps/api/libs/modules/live-ops/src/controllers/coordinator-live-ops.controller.ts`
  - `apps/api/libs/modules/floorplan/src/controllers/event-floorplans.controller.ts`
  - `apps/api/libs/modules/plans/src/plans.controller.ts`
- Modify `apps/api/libs/modules/plans/src/plans.service.ts`
  - Require explicit verified actor role for plan updates; no implicit PMCM default.
- Modify `apps/api/libs/modules/plans/src/plans.service.test.ts`
  - Cover missing actor denial and verified PMCM/coordinator/client outcomes.
- Modify `packages/api-client/src/http.ts`
  - Add optional auth-token injection to shared request helper.
- Modify `packages/api-client/src/event-ops-client.ts`
  - Stop requiring actor query for authenticated PMCM/coordinator methods.
- Modify `packages/api-client/src/event-ops-client.test.ts`
  - Cover Authorization header behavior and absence of actor query params.
- Modify `apps/event/src/app/lib/session.ts`
  - Treat `accessToken` as required for event app sessions.
- Modify `apps/event/src/app/components/public/event-command-landing.tsx`
  - Save the authenticated session returned by login.
- Modify `apps/event/src/app/sign-in/page.tsx`
  - Save the authenticated session returned by login.
- Modify `apps/event/src/lib/prism-api.ts`
  - Add `Authorization` to all event app API calls and remove hardcoded PMCM/coordinator actor query params from authenticated calls.
- Modify `apps/event/src/app/dashboard/EventDashboardClient.tsx`
  - Continue using `session.role` for UI branching only after the session has a token; keep role checks as UX, not security.
- Modify docs:
  - `docs/prism-v4/11-feature-ledger.md`
  - `docs/prism-v4/17-current-state-2026-06-20.md`
  - `docs/prism-v4/18-future-state.md`

---

### Task 1: Shared Auth Session Contract

**Files:**
- Modify: `packages/types/src/event-ops.ts`
- Modify: `packages/types/src/session.ts`
- Modify: `packages/types/src/session.test.ts`

- [ ] **Step 1: Add the authenticated event session types**

In `packages/types/src/event-ops.ts`, keep `PrismUser` unchanged and add these types immediately after `PrismUser`:

```ts
export interface PrismAuthenticatedSession {
  user: PrismUser;
  accessToken: string;
  signedInAt: string;
  expiresAt: string;
}

export interface PrismVerifiedEventActor {
  id: string;
  role: PrismEventOpsActorRole;
  email: string;
  name: string;
  organization: string;
}
```

- [ ] **Step 2: Add a session shape guard**

In `packages/types/src/session.ts`, import the type and add a guard below `clearPrismSession`:

```ts
import type { PrismAuthenticatedSession } from "./event-ops";

export function isPrismAuthenticatedSession(value: unknown): value is PrismAuthenticatedSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<PrismAuthenticatedSession>;
  const user = session.user as Partial<PrismAuthenticatedSession["user"]> | undefined;
  return Boolean(
    user &&
      typeof user.id === "string" &&
      typeof user.name === "string" &&
      typeof user.email === "string" &&
      typeof user.role === "string" &&
      typeof session.accessToken === "string" &&
      session.accessToken.length > 20 &&
      typeof session.signedInAt === "string" &&
      typeof session.expiresAt === "string",
  );
}
```

If the existing import order conflicts with lint/typecheck, place the import at the top of the file before the constants.

- [ ] **Step 3: Add session contract tests**

Append to `packages/types/src/session.test.ts`:

```ts
import { isPrismAuthenticatedSession } from "./session";

describe("authenticated Prism session shape", () => {
  it("accepts signed event sessions with a user and access token", () => {
    expect(
      isPrismAuthenticatedSession({
        user: {
          id: "user_pmcm",
          name: "Ms. Mys",
          email: "mys@pmcm.test",
          role: "pmcm-admin",
          organization: "PMCM",
          approvalStatus: "approved",
        },
        accessToken: "header.payload.signature",
        signedInAt: "2026-07-03T00:00:00.000Z",
        expiresAt: "2026-07-04T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("rejects legacy event sessions without access tokens", () => {
    expect(
      isPrismAuthenticatedSession({
        id: "user_pmcm",
        name: "Ms. Mys",
        email: "mys@pmcm.test",
        role: "pmcm-admin",
        organization: "PMCM",
        approvalStatus: "approved",
        signedInAt: "2026-07-03T00:00:00.000Z",
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 4: Run type package tests**

Run:

```powershell
npm --workspace @prism/types run test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/types/src/event-ops.ts packages/types/src/session.ts packages/types/src/session.test.ts
git commit -m "feat(types): define authenticated prism sessions"
```

---

### Task 2: API Signed Session Token Service

**Files:**
- Add: `apps/api/libs/modules/identity-ops/src/services/auth-session.service.ts`
- Add: `apps/api/libs/modules/identity-ops/src/services/auth-session.service.test.ts`
- Modify: `apps/api/libs/modules/identity-ops/src/identity-ops.module.ts`
- Modify: `apps/api/libs/modules/identity-ops/src/index.ts`

- [ ] **Step 1: Write the token service test**

Create `apps/api/libs/modules/identity-ops/src/services/auth-session.service.test.ts`:

```ts
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AuthSessionService } from './auth-session.service';

function createService() {
  return new AuthSessionService({
    get: (key: string) => {
      if (key === 'PRISM_AUTH_SECRET') return 'test-secret-with-enough-length';
      if (key === 'PRISM_AUTH_TTL_SECONDS') return '3600';
      return undefined;
    },
  } as any);
}

describe('AuthSessionService', () => {
  it('issues and verifies signed Prism auth tokens', () => {
    const service = createService();
    const issued = service.issue({
      id: 'user_pmcm',
      name: 'Ms. Mys',
      email: 'mys@pmcm.test',
      role: 'pmcm-admin',
      organization: 'PMCM',
    });

    expect(issued.accessToken.split('.')).toHaveLength(3);
    expect(issued.expiresAt).toMatch(/Z$/);
    expect(service.verify(issued.accessToken)).toMatchObject({
      id: 'user_pmcm',
      name: 'Ms. Mys',
      email: 'mys@pmcm.test',
      role: 'pmcm-admin',
      organization: 'PMCM',
    });
  });

  it('rejects tampered tokens', () => {
    const service = createService();
    const issued = service.issue({
      id: 'user_pmcm',
      name: 'Ms. Mys',
      email: 'mys@pmcm.test',
      role: 'pmcm-admin',
      organization: 'PMCM',
    });

    const tampered = issued.accessToken.replace('pmcm-admin', 'coordinator');

    expect(() => service.verify(tampered)).toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```powershell
npm --workspace prism-api run test -- libs/modules/identity-ops/src/services/auth-session.service.test.ts
```

Expected: FAIL because `auth-session.service.ts` does not exist.

- [ ] **Step 3: Implement the token service**

Create `apps/api/libs/modules/identity-ops/src/services/auth-session.service.ts`:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PrismEventOpsActorRole, PrismVerifiedEventActor } from '@prism/types';

type TokenPayload = PrismVerifiedEventActor & {
  iat: number;
  exp: number;
};

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString('base64url');
}

function parseJsonSegment<T>(segment: string): T {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T;
  } catch {
    throw new UnauthorizedException('Invalid auth token');
  }
}

@Injectable()
export class AuthSessionService {
  constructor(private readonly configService: ConfigService) {}

  issue(actor: Omit<PrismVerifiedEventActor, 'role'> & { role: PrismEventOpsActorRole | string }) {
    const now = Math.floor(Date.now() / 1000);
    const ttlSeconds = Number(this.configService.get<string>('PRISM_AUTH_TTL_SECONDS') ?? 60 * 60 * 8);
    const payload: TokenPayload = {
      id: actor.id,
      name: actor.name,
      email: actor.email,
      role: actor.role as PrismEventOpsActorRole,
      organization: actor.organization,
      iat: now,
      exp: now + ttlSeconds,
    };
    const header = { alg: 'HS256', typ: 'PRISM' };
    const encodedHeader = base64Url(JSON.stringify(header));
    const encodedPayload = base64Url(JSON.stringify(payload));
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`);

    return {
      accessToken: `${encodedHeader}.${encodedPayload}.${signature}`,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
  }

  verify(token: string): PrismVerifiedEventActor {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !signature) {
      throw new UnauthorizedException('Invalid auth token');
    }

    const expectedSignature = this.sign(`${encodedHeader}.${encodedPayload}`);
    if (!this.safeEqual(signature, expectedSignature)) {
      throw new UnauthorizedException('Invalid auth token');
    }

    const payload = parseJsonSegment<TokenPayload>(encodedPayload);
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Expired auth token');
    }

    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      organization: payload.organization,
    };
  }

  private sign(value: string) {
    return createHmac('sha256', this.secret()).update(value).digest('base64url');
  }

  private secret() {
    const configured = this.configService.get<string>('PRISM_AUTH_SECRET');
    return configured && configured.length >= 16 ? configured : 'prism-local-dev-auth-secret';
  }

  private safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }
}
```

- [ ] **Step 4: Register and export the service**

In `apps/api/libs/modules/identity-ops/src/identity-ops.module.ts`, add `ConfigModule` to imports if needed and register the service:

```ts
import { ConfigModule } from '@nestjs/config';
import { AuthSessionService } from './services/auth-session.service';

@Module({
  imports: [ConfigModule, DatabaseModule, TrustOpsModule, InquiryOnboardingModule],
  controllers: [OpsAuthController],
  providers: [AuthOperationsService, AuthSessionService],
  exports: [AuthOperationsService, AuthSessionService],
})
export class IdentityOpsModule {}
```

In `apps/api/libs/modules/identity-ops/src/index.ts`, export:

```ts
export * from './services/auth-session.service';
```

- [ ] **Step 5: Run the focused test**

Run:

```powershell
npm --workspace prism-api run test -- libs/modules/identity-ops/src/services/auth-session.service.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/api/libs/modules/identity-ops/src/services/auth-session.service.ts apps/api/libs/modules/identity-ops/src/services/auth-session.service.test.ts apps/api/libs/modules/identity-ops/src/identity-ops.module.ts apps/api/libs/modules/identity-ops/src/index.ts
git commit -m "feat(api): issue signed auth sessions"
```

---

### Task 3: Return Signed Sessions From Login

**Files:**
- Modify: `apps/api/libs/modules/identity-ops/src/services/auth-operations.service.ts`
- Add or modify: `apps/api/libs/modules/identity-ops/src/services/auth-operations.service.test.ts`
- Modify: `apps/api/libs/modules/identity-ops/src/controllers/auth.controller.test.ts`

- [ ] **Step 1: Add service test coverage**

Create `apps/api/libs/modules/identity-ops/src/services/auth-operations.service.test.ts` if it does not exist, or append:

```ts
import { describe, expect, it, vi } from 'vitest';
import { AuthOperationsService } from './auth-operations.service';
import { AuthSecurityService } from './auth-security.service';

describe('AuthOperationsService signed sessions', () => {
  it('returns a signed session wrapper after successful login', async () => {
    const user = {
      id: 'user_pmcm',
      name: 'Ms. Mys',
      email: 'mys@pmcm.test',
      role: 'pmcm-admin',
      organization: 'PMCM',
      approvalStatus: 'approved',
      password: AuthSecurityService.hashPassword('prism-admin', 'login_test_salt'),
      failedLoginCount: 0,
      lockedUntil: null,
      permanentLockout: false,
      lastLoginAt: null,
    };
    const prisma = {
      opsUser: {
        findUnique: vi.fn(async () => user),
        update: vi.fn(async () => ({ ...user, lastLoginAt: new Date('2026-07-03T00:00:00.000Z') })),
      },
    };
    const auditService = {
      recordLoginHistory: vi.fn(async () => undefined),
      audit: vi.fn(async () => undefined),
    };
    const inquiriesService = { markPortalInvitationOpenedByEmail: vi.fn(async () => undefined) };
    const authSessionService = {
      issue: vi.fn(() => ({
        accessToken: 'header.payload.signature',
        expiresAt: '2026-07-04T00:00:00.000Z',
      })),
    };
    const service = new AuthOperationsService(prisma as any, auditService as any, inquiriesService as any, authSessionService as any);

    await expect(service.login('mys@pmcm.test', 'prism-admin')).resolves.toMatchObject({
      user: {
        id: 'user_pmcm',
        role: 'pmcm-admin',
        email: 'mys@pmcm.test',
      },
      accessToken: 'header.payload.signature',
      expiresAt: '2026-07-04T00:00:00.000Z',
    });
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run:

```powershell
npm --workspace prism-api run test -- libs/modules/identity-ops/src/services/auth-operations.service.test.ts
```

Expected: FAIL because the constructor and return shape have not been updated.

- [ ] **Step 3: Inject the session service and change login return shape**

In `apps/api/libs/modules/identity-ops/src/services/auth-operations.service.ts`, import and inject `AuthSessionService`:

```ts
import { AuthSessionService } from './auth-session.service';
```

Update constructor:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly auditService: AuditService,
  private readonly inquiriesService: InquiriesService,
  private readonly authSessionService: AuthSessionService,
) {}
```

Replace the existing login return:

```ts
const mappedUser = this.mapUser(updated);
const issued = this.authSessionService.issue({
  id: mappedUser.id,
  name: mappedUser.name,
  email: mappedUser.email,
  role: mappedUser.role,
  organization: mappedUser.organization,
});

return {
  user: mappedUser,
  accessToken: issued.accessToken,
  expiresAt: issued.expiresAt,
  signedInAt: new Date().toISOString(),
};
```

- [ ] **Step 4: Update controller tests for the new shape**

In `apps/api/libs/modules/identity-ops/src/controllers/auth.controller.test.ts`, change the mocked login response from a plain user to:

```ts
login: vi.fn(async () => ({
  user: { id: 'user_pmcm', role: 'pmcm-admin' },
  accessToken: 'header.payload.signature',
  signedInAt: '2026-07-03T00:00:00.000Z',
  expiresAt: '2026-07-04T00:00:00.000Z',
})),
```

Update the assertion to match the wrapper:

```ts
await expect(controller.login({ email: 'maxine@pmcm.test', password: 'secret' })).resolves.toMatchObject({
  user: { id: 'user_pmcm', role: 'pmcm-admin' },
  accessToken: 'header.payload.signature',
});
```

- [ ] **Step 5: Run focused identity tests**

Run:

```powershell
npm --workspace prism-api run test -- libs/modules/identity-ops/src
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/api/libs/modules/identity-ops/src/services/auth-operations.service.ts apps/api/libs/modules/identity-ops/src/services/auth-operations.service.test.ts apps/api/libs/modules/identity-ops/src/controllers/auth.controller.test.ts
git commit -m "feat(api): return signed login sessions"
```

---

### Task 4: Verified Actor Guard And Policy Boundary

**Files:**
- Add: `apps/api/libs/modules/identity-ops/src/guards/event-session.guard.ts`
- Add: `apps/api/libs/modules/identity-ops/src/decorators/current-event-actor.decorator.ts`
- Modify: `apps/api/libs/modules/identity-ops/src/index.ts`
- Modify: `apps/api/libs/modules/access-control/src/services/event-access-policy.service.ts`
- Modify: `apps/api/libs/modules/access-control/src/services/event-access-policy.service.test.ts`

- [ ] **Step 1: Add policy tests for verified actor precedence**

Append to `apps/api/libs/modules/access-control/src/services/event-access-policy.service.test.ts`:

```ts
  it('uses verified actor identity instead of client-supplied role fields', () => {
    const { policy } = createPolicy();
    const actor = policy.resolveActor(
      {
        actorRole: OpsUserRole.PmcmAdmin,
        actorName: 'Forged Admin',
        actorEmail: 'forged@example.com',
      },
      {
        id: 'user_coord',
        role: OpsUserRole.Coordinator,
        name: 'Marco Santos',
        email: 'marco@pmcm.test',
        organization: 'PMCM',
      },
    );

    expect(actor).toMatchObject({
      id: 'user_coord',
      role: OpsUserRole.Coordinator,
      name: 'Marco Santos',
      email: 'marco@pmcm.test',
      explicit: true,
    });
  });

  it('does not default protected actor resolution to PMCM admin', () => {
    const { policy } = createPolicy();

    expect(policy.resolveActor()).toMatchObject({
      role: OpsUserRole.Unknown,
      explicit: false,
    });
  });
```

- [ ] **Step 2: Run policy tests and confirm failure**

Run:

```powershell
npm --workspace prism-api run test -- libs/modules/access-control/src/services/event-access-policy.service.test.ts
```

Expected: FAIL until `resolveActor` accepts verified actors and stops defaulting to PMCM.

- [ ] **Step 3: Add current actor request type and guard**

Create `apps/api/libs/modules/identity-ops/src/guards/event-session.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { PrismVerifiedEventActor } from '@prism/types';
import { AuthSessionService } from '../services/auth-session.service';

export type PrismAuthenticatedRequest = Request & {
  prismActor?: PrismVerifiedEventActor;
};

@Injectable()
export class EventSessionGuard implements CanActivate {
  constructor(private readonly authSessionService: AuthSessionService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PrismAuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing auth token');
    }

    request.prismActor = this.authSessionService.verify(header.slice('Bearer '.length).trim());
    return true;
  }
}
```

Create `apps/api/libs/modules/identity-ops/src/decorators/current-event-actor.decorator.ts`:

```ts
import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { PrismVerifiedEventActor } from '@prism/types';
import type { PrismAuthenticatedRequest } from '../guards/event-session.guard';

export const CurrentEventActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PrismVerifiedEventActor => {
    const request = context.switchToHttp().getRequest<PrismAuthenticatedRequest>();
    if (!request.prismActor) throw new UnauthorizedException('Missing verified actor');
    return request.prismActor;
  },
);
```

Export both in `apps/api/libs/modules/identity-ops/src/index.ts`:

```ts
export * from './guards/event-session.guard';
export * from './decorators/current-event-actor.decorator';
```

- [ ] **Step 4: Update access policy resolution**

In `apps/api/libs/modules/access-control/src/services/event-access-policy.service.ts`, import the verified actor type:

```ts
import type { PrismEventOpsActorContext, PrismVerifiedEventActor } from '@prism/types';
```

Change `resolveActor` to:

```ts
resolveActor(input: EventOpsActorInput = {}, verifiedActor?: PrismVerifiedEventActor): ResolvedEventOpsActor {
  if (verifiedActor) {
    return {
      id: verifiedActor.id,
      role: verifiedActor.role as OpsUserRoleValue,
      email: verifiedActor.email,
      name: verifiedActor.name,
      clientName: verifiedActor.role === OpsUserRole.Client ? verifiedActor.name : undefined,
      supplierId: input.supplierId,
      coordinatorId: input.coordinatorId,
      eventId: input.eventId,
      accessCode: input.accessCode,
      explicit: true,
    };
  }

  const requestedRole = (input.actorRole ?? input.role ?? OpsUserRole.Unknown).trim().toLowerCase();
  const knownRoles = Object.values(OpsUserRole) as OpsUserRoleValue[];
  const role = knownRoles.includes(requestedRole as OpsUserRoleValue)
    ? (requestedRole as OpsUserRoleValue)
    : OpsUserRole.Unknown;
  const name =
    input.actorName ??
    input.name ??
    input.clientName ??
    (role === OpsUserRole.PmcmAdmin ? 'PMCM Admin' : role);

  return {
    id: input.actorId ?? input.id,
    role,
    email: input.actorEmail ?? input.email,
    name,
    clientName: input.clientName ?? (role === OpsUserRole.Client ? name : undefined),
    supplierId: input.supplierId,
    coordinatorId: input.coordinatorId,
    eventId: input.eventId,
    accessCode: input.accessCode,
    explicit: Boolean(input.actorRole ?? input.role),
  };
}
```

- [ ] **Step 5: Run policy tests**

Run:

```powershell
npm --workspace prism-api run test -- libs/modules/access-control/src/services/event-access-policy.service.test.ts
```

Expected: PASS after updating any tests that depended on the old PMCM default to pass `{ actorRole: OpsUserRole.PmcmAdmin }` explicitly.

- [ ] **Step 6: Commit**

```powershell
git add apps/api/libs/modules/identity-ops/src/guards/event-session.guard.ts apps/api/libs/modules/identity-ops/src/decorators/current-event-actor.decorator.ts apps/api/libs/modules/identity-ops/src/index.ts apps/api/libs/modules/access-control/src/services/event-access-policy.service.ts apps/api/libs/modules/access-control/src/services/event-access-policy.service.test.ts
git commit -m "feat(api): add verified event actor guard"
```

---

### Task 5: Protect Event Command API Routes

**Files:**
- Modify: `apps/api/libs/modules/event-read-models/src/controllers/pmcm-dashboard.controller.ts`
- Modify: `apps/api/libs/modules/staffing-ops/src/controllers/coordinator-workspace.controller.ts`
- Modify: `apps/api/libs/modules/live-ops/src/controllers/coordinator-live-ops.controller.ts`
- Modify: `apps/api/libs/modules/floorplan/src/controllers/event-floorplans.controller.ts`
- Modify: `apps/api/libs/modules/plans/src/plans.controller.ts`
- Modify associated controller tests.

- [ ] **Step 1: Update PMCM dashboard controller to require verified actor**

In `apps/api/libs/modules/event-read-models/src/controllers/pmcm-dashboard.controller.ts`, add imports:

```ts
import { UseGuards } from '@nestjs/common';
import { CurrentEventActor, EventSessionGuard } from '@prism/modules/identity-ops';
import type { PrismVerifiedEventActor } from '@prism/types';
```

Update both route methods:

```ts
@UseGuards(EventSessionGuard)
@Get('dashboard')
dashboard(@CurrentEventActor() verifiedActor: PrismVerifiedEventActor) {
  const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
  return this.eventReadModelsService.pmcmDashboard(actor, this.mappers());
}

@UseGuards(EventSessionGuard)
@Get('events/:eventId/workspace')
eventWorkspace(@Param('eventId') eventId: string, @CurrentEventActor() verifiedActor: PrismVerifiedEventActor) {
  const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
  return this.eventReadModelsService.pmcmEventWorkspace(actor, eventId, this.mappers());
}
```

Update the PMCM controller test to call:

```ts
const verifiedPmcm = {
  id: 'user_pmcm',
  role: 'pmcm-admin',
  name: 'Maxine',
  email: 'maxine@pmcm.test',
  organization: 'PMCM',
};

await expect(controller.dashboard(verifiedPmcm as any)).resolves.toEqual({ events: [] });
expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, verifiedPmcm);
```

- [ ] **Step 2: Update coordinator controllers**

In `apps/api/libs/modules/staffing-ops/src/controllers/coordinator-workspace.controller.ts`, add the guard/decorator imports and update:

```ts
@UseGuards(EventSessionGuard)
@Get('workspace')
getCoordinatorWorkspace(@CurrentEventActor() verifiedActor: PrismVerifiedEventActor) {
  const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
  return this.coordinatorWorkspaceReadService.listCoordinatorWorkspace(actor);
}
```

In `apps/api/libs/modules/live-ops/src/controllers/coordinator-live-ops.controller.ts`, add the guard/decorator imports and update:

```ts
@UseGuards(EventSessionGuard)
@Get('events/:eventId/role-view')
roleView(@Param('eventId') eventId: string, @CurrentEventActor() verifiedActor: PrismVerifiedEventActor) {
  return this.readService.getCoordinatorRoleView(eventId, {
    actorRole: verifiedActor.role,
    actorName: verifiedActor.name,
    actorEmail: verifiedActor.email,
    actorId: verifiedActor.id,
  });
}
```

- [ ] **Step 3: Update floorplan routes**

In `apps/api/libs/modules/floorplan/src/controllers/event-floorplans.controller.ts`, guard create/submit/approve/snapshot and resolve the actor from the verified token:

```ts
@UseGuards(EventSessionGuard)
@Post(':eventId/floorplans')
@HttpCode(HttpStatus.CREATED)
async createFloorPlanDraft(
  @Param('eventId') eventId: string,
  @Body() dto: CreateFloorPlanDraftDto,
  @CurrentEventActor() verifiedActor: PrismVerifiedEventActor,
) {
  const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
  await this.eventAccessPolicyService.requireCanMutateOfficialFloorplan(actor, eventId, 'official floorplan draft');
  return this.floorPlanWorkflowService.createFloorPlanDraft(eventId, dto, { name: actor.name, role: actor.role });
}
```

Apply the same pattern to `submitFloorPlanDraft`, `approveFloorPlanDraft`, and `getFloorPlanSnapshot`. For `getFloorPlanSnapshot`, keep the `type` query value but do not consume actor fields from query:

```ts
const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
```

- [ ] **Step 4: Update plans controller and service default**

In `apps/api/libs/modules/plans/src/plans.controller.ts`, guard `GET :planId` and `PUT :planId`:

```ts
@UseGuards(EventSessionGuard)
@Get(':planId')
getOne(@Param('planId') planId: string, @CurrentEventActor() actor: PrismVerifiedEventActor) {
  return this.plansService.getPlan(planId, actor);
}

@UseGuards(EventSessionGuard)
@Put(':planId')
update(@Param('planId') planId: string, @Body() dto: UpdatePlanDto, @CurrentEventActor() actor: PrismVerifiedEventActor) {
  return this.plansService.updatePlan(planId, dto, actor);
}
```

In `apps/api/libs/modules/plans/src/plans.service.ts`, replace:

```ts
const role = (actor.actorRole ?? actor.role ?? 'pmcm-admin').trim().toLowerCase();
if (role !== 'client') return;
```

with:

```ts
const role = (actor.actorRole ?? actor.role ?? '').trim().toLowerCase();
if (role === 'pmcm-admin' || role === 'system') return;
if (role !== 'client') {
  throw new ForbiddenException('Only PMCM can edit official floorplans');
}
```

- [ ] **Step 5: Run route-focused API tests**

Run:

```powershell
npm --workspace prism-api run test -- libs/modules/event-read-models/src/controllers/pmcm-dashboard.controller.test.ts libs/modules/staffing-ops/src/controllers/coordinator-workspace.controller.test.ts libs/modules/live-ops/src/controllers/coordinator-live-ops.controller.test.ts libs/modules/floorplan/src/controllers/event-floorplans.controller.test.ts libs/modules/plans/src/plans.service.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/api/libs/modules/event-read-models/src/controllers/pmcm-dashboard.controller.ts apps/api/libs/modules/staffing-ops/src/controllers/coordinator-workspace.controller.ts apps/api/libs/modules/live-ops/src/controllers/coordinator-live-ops.controller.ts apps/api/libs/modules/floorplan/src/controllers/event-floorplans.controller.ts apps/api/libs/modules/plans/src/plans.controller.ts apps/api/libs/modules/plans/src/plans.service.ts
git add apps/api/libs/modules/event-read-models/src/controllers/pmcm-dashboard.controller.test.ts apps/api/libs/modules/staffing-ops/src/controllers/coordinator-workspace.controller.test.ts apps/api/libs/modules/live-ops/src/controllers/coordinator-live-ops.controller.test.ts apps/api/libs/modules/floorplan/src/controllers/event-floorplans.controller.test.ts apps/api/libs/modules/plans/src/plans.service.test.ts
git commit -m "fix(api): authorize event command routes from signed sessions"
```

---

### Task 6: Event App Authenticated Requests

**Files:**
- Modify: `packages/api-client/src/http.ts`
- Modify: `packages/api-client/src/event-ops-client.ts`
- Modify: `packages/api-client/src/event-ops-client.test.ts`
- Modify: `apps/event/src/app/lib/session.ts`
- Modify: `apps/event/src/lib/prism-api.ts`
- Modify: `apps/event/src/app/components/public/event-command-landing.tsx`
- Modify: `apps/event/src/app/sign-in/page.tsx`
- Modify: `apps/event/src/app/dashboard/EventDashboardClient.tsx`

- [ ] **Step 1: Update event session shape**

In `apps/event/src/app/lib/session.ts`, replace the current type with:

```ts
import type { PrismAuthenticatedSession } from "@prism/types";

export type EventSession = PrismAuthenticatedSession;
```

Update `readStoredEventSession`:

```ts
import { isPrismAuthenticatedSession } from "@prism/types";

export function readStoredEventSession(): EventSession | null {
  const session = readPrismSession<EventSession>(EVENT_SESSION_KEY);
  return isPrismAuthenticatedSession(session) ? session : null;
}
```

- [ ] **Step 2: Add auth-token support to API client**

In `packages/api-client/src/http.ts`, add to `PrismRequestInit`:

```ts
authToken?: string | null;
```

In `prismRequest`, extract `authToken` and add the header:

```ts
const { baseUrl, body, headers, authToken, ...requestInit } = init;
const request: RequestInit = {
  ...requestInit,
  headers: {
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(headers ?? {}),
  },
};
```

In `packages/api-client/src/event-ops-client.ts`, add:

```ts
export interface EventOpsClientOptions {
  baseUrl?: string;
  getAuthToken?: () => string | null;
}

function withBase(options: EventOpsClientOptions, init: PrismRequestInit = {}): PrismRequestInit {
  return {
    ...init,
    baseUrl: init.baseUrl ?? options.baseUrl,
    authToken: init.authToken ?? options.getAuthToken?.() ?? null,
  };
}
```

- [ ] **Step 3: Remove authenticated PMCM/coordinator actor queries from the event app API client**

In `apps/event/src/lib/prism-api.ts`, create:

```ts
function eventAccessToken() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("prism:event-command-session");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accessToken?: string };
    return typeof parsed.accessToken === "string" ? parsed.accessToken : null;
  } catch {
    return null;
  }
}

const eventOpsClient = createEventOpsClient({
  baseUrl: `${API_URL}/api`,
  getAuthToken: eventAccessToken,
});
```

Update local `request<T>` to include the token:

```ts
const token = eventAccessToken();
response = await fetch(`${API_URL}${path}`, {
  ...init,
  headers: {
    "content-type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers ?? {}),
  },
});
```

Then change authenticated calls:

```ts
pmcmState: () => eventOpsClient.pmcmDashboard.detail(),
pmcmCommandInbox: () => eventOpsClient.pmcm.commandInbox(),
pmcmEventWorkspace: (eventId: string) => eventOpsClient.pmcm.eventWorkspace(eventId),
createFloorPlanDraft: (eventId, input) => request(`/api/events/${eventId}/floorplans`, ...),
submitFloorPlanDraft: (eventId, draftId) => request(`/api/events/${eventId}/floorplans/${draftId}/submit`, ...),
approveFloorPlanDraft: (eventId, draftId) => request(`/api/events/${eventId}/floorplans/${draftId}/approve`, ...),
loadPlan: (planId) => request<ApiFloorPlan>(`/api/plans/${planId}`).then(apiPlanToProject),
savePlan: (project) => request<ApiFloorPlan>(`/api/plans/${project.id}`, ...).then(apiPlanToProject),
coordinatorWorkspace: () => request<PrismCoordinatorWorkspace>("/api/coordinator/workspace"),
coordinatorRoleView: (_session, eventId) => request<PrismCoordinatorRoleView>(`/api/coordinator/events/${eventId}/role-view`),
```

Keep tokenless public/client/supplier/guest routes unchanged until Task 8.

- [ ] **Step 4: Update sign-in consumers**

In `apps/event/src/app/components/public/event-command-landing.tsx`, login now returns `{ user, accessToken, signedInAt, expiresAt }`. Replace role reads:

```ts
const session = await prismApi.login({ email, password });
if (session.user.role !== "pmcm-admin" && session.user.role !== "coordinator") {
  setError(session.user.role === "client" ? "Client accounts belong in prism-client at http://localhost:3001." : "Supplier accounts belong in prism-supplier at http://localhost:3002.");
  return;
}
saveEventSession(session);
onSignedIn(session);
```

In `apps/event/src/app/sign-in/page.tsx`, make the same role check and remove the old flattening:

```ts
const session = await prismApi.login({ email, password });
if (session.user.role !== "pmcm-admin" && session.user.role !== "coordinator") {
  setError(
    session.user.role === "client"
      ? "Client accounts sign in through the client portal at http://localhost:3001."
      : "Supplier accounts sign in through the supplier portal at http://localhost:3002.",
  );
  return;
}
saveEventSession(session);
```

- [ ] **Step 5: Update dashboard session references**

In `apps/event/src/app/dashboard/EventDashboardClient.tsx`, use `session.user` wherever UI needs identity:

```ts
if (current.user.role === "coordinator") { ... }
if (current.user.role !== "pmcm-admin") return;
```

For display:

```ts
user={{ name: session.user.name, detail: lbl(session.user.role), initials: session.user.name.slice(0, 2).toUpperCase() }}
```

When passing the session to `CoordinatorView`, either pass `session.user` plus `signedInAt`, or update `CoordinatorView` props to accept `EventSession` and read `session.user`. Keep this as a mechanical update; do not add new role logic.

- [ ] **Step 6: Run frontend/API-client tests and typechecks**

Run:

```powershell
npm --workspace @prism/api-client run test
npm --workspace @prism/event run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add packages/api-client/src/http.ts packages/api-client/src/event-ops-client.ts packages/api-client/src/event-ops-client.test.ts apps/event/src/app/lib/session.ts apps/event/src/lib/prism-api.ts apps/event/src/app/components/public/event-command-landing.tsx apps/event/src/app/sign-in/page.tsx apps/event/src/app/dashboard/EventDashboardClient.tsx
git commit -m "fix(event): authenticate API requests with signed sessions"
```

---

### Task 7: Security Regression Matrix

**Files:**
- Modify: `apps/api/libs/modules/floorplan/src/controllers/event-floorplans.controller.test.ts`
- Modify: `apps/api/libs/modules/plans/src/plans.service.test.ts`
- Modify: `apps/api/libs/modules/event-read-models/src/controllers/pmcm-dashboard.controller.test.ts`
- Modify: `apps/api/scripts/smoke-api.mjs`

- [ ] **Step 1: Add controller regression for forged PMCM actor query**

In `apps/api/libs/modules/floorplan/src/controllers/event-floorplans.controller.test.ts`, add:

```ts
it('does not let a verified coordinator mutate official floorplans with forged query actor fields', async () => {
  eventAccessPolicyService.resolveActor.mockReturnValueOnce({
    role: OpsUserRole.Coordinator,
    name: 'Marco Santos',
    email: 'marco@pmcm.test',
    explicit: true,
  });
  eventAccessPolicyService.requireCanMutateOfficialFloorplan.mockRejectedValueOnce(
    new ForbiddenException('coordinator cannot mutate official floorplans'),
  );

  await expect(
    controller.createFloorPlanDraft(
      'evt_sample',
      { name: 'Forged draft', sourceType: 'blank' } as any,
      {
        id: 'user_coord',
        role: OpsUserRole.Coordinator,
        name: 'Marco Santos',
        email: 'marco@pmcm.test',
        organization: 'PMCM',
      } as any,
    ),
  ).rejects.toBeInstanceOf(ForbiddenException);
});
```

- [ ] **Step 2: Add plan update missing-actor denial**

In `apps/api/libs/modules/plans/src/plans.service.test.ts`, add:

```ts
it('blocks plan updates when no verified actor role is supplied', async () => {
  const { service } = createService(draft('in_review', 'Ana Reyes'));

  await expect(service.updatePlan('plan_event_1', { objects: [] }, {})).rejects.toBeInstanceOf(ForbiddenException);
});
```

- [ ] **Step 3: Update smoke script login contract**

In `apps/api/scripts/smoke-api.mjs`, update login expectations from plain user role to wrapped session role:

```js
const adminSession = await expectOk('event ops auth login', '/api/auth/login', {
  method: 'POST',
  body: {
    email: 'mys@pmcm.test',
    password: 'prism-admin',
  },
});

if (adminSession.user?.role !== 'pmcm-admin' || !adminSession.accessToken) {
  throw new Error(`admin login returned wrong signed session: ${JSON.stringify(adminSession)}`);
}
```

When smoke calls authenticated PMCM routes, add:

```js
headers: { Authorization: `Bearer ${adminSession.accessToken}` }
```

- [ ] **Step 4: Run regression tests**

Run:

```powershell
npm --workspace prism-api run test -- libs/modules/floorplan/src/controllers/event-floorplans.controller.test.ts libs/modules/plans/src/plans.service.test.ts libs/modules/event-read-models/src/controllers/pmcm-dashboard.controller.test.ts
npm --workspace prism-api run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/api/libs/modules/floorplan/src/controllers/event-floorplans.controller.test.ts apps/api/libs/modules/plans/src/plans.service.test.ts apps/api/libs/modules/event-read-models/src/controllers/pmcm-dashboard.controller.test.ts apps/api/scripts/smoke-api.mjs
git commit -m "test(api): lock event auth role-boundary regressions"
```

---

### Task 8: Remaining Actor-Param Endpoint Sweep

**Files:**
- Create: `docs/prism-v4/event-auth-rbac-endpoint-sweep.md`
- Modify selected controllers after the sweep, likely including:
  - `apps/api/libs/modules/finance-ops/src/controllers/event-billing.controller.ts`
  - `apps/api/libs/modules/commercial-ops/src/controllers/event-commercial.controller.ts`
  - `apps/api/libs/modules/supplier-ops/src/controllers/*.ts`
  - `apps/api/libs/modules/inquiry-onboarding/src/controllers/*.ts`
  - `apps/api/libs/modules/trust-ops/src/controllers/audit-privacy.controller.ts`
  - `apps/api/libs/modules/compliance-ops/src/controllers/*.ts`
  - `apps/api/libs/modules/file-ops/src/controllers/event-file-requirements.controller.ts`

- [ ] **Step 1: Create the endpoint sweep document**

Create `docs/prism-v4/event-auth-rbac-endpoint-sweep.md`:

```md
# Event Auth RBAC Endpoint Sweep

This document tracks routes that still accept `actorRole`, `role`, `actorName`, `actorEmail`, `clientName`, `supplierId`, or `coordinatorId` from request query/body fields.

## Rules

- PMCM/coordinator routes used by `apps/event` must use `EventSessionGuard` and `CurrentEventActor`.
- Client/supplier/guest routes may keep actor params only when they are explicitly demo/sample compatibility routes or token/access-code routes.
- Any endpoint that mutates official PMCM-owned state must derive role from a verified actor or system context.

## Initial Event-App Protected Routes

| Route | Controller | Status | Notes |
| --- | --- | --- | --- |
| `GET /api/pmcm/dashboard` | `OpsPmcmDashboardController` | protected | signed session required |
| `GET /api/pmcm/events/:eventId/workspace` | `OpsPmcmDashboardController` | protected | signed session required |
| `GET /api/coordinator/workspace` | `OpsCoordinatorWorkspaceController` | protected | signed session required |
| `GET /api/coordinator/events/:eventId/role-view` | `CoordinatorLiveOpsController` | protected | signed session required |
| `POST /api/events/:eventId/floorplans` | `OpsEventFloorplansController` | protected | PMCM/system only |
| `POST /api/events/:eventId/floorplans/:draftId/submit` | `OpsEventFloorplansController` | protected | PMCM/system only |
| `POST /api/events/:eventId/floorplans/:draftId/approve` | `OpsEventFloorplansController` | protected | PMCM/system only |
| `GET /api/events/:eventId/floorplans/:draftId/snapshot` | `OpsEventFloorplansController` | protected | verified event read policy |
| `GET /api/plans/:planId` | `PlansController` | protected | signed session required |
| `PUT /api/plans/:planId` | `PlansController` | protected | verified actor required |
```

- [ ] **Step 2: Generate the route candidate list**

Run:

```powershell
rg -n "actorRole|actorName|actorEmail|clientName|supplierId|coordinatorId|resolveActor\\(" apps/api/libs/modules -S
```

Paste only route/controller findings into the sweep document; do not include tests, DTO-only types, or docs.

- [ ] **Step 3: Classify each remaining route**

For each route, assign exactly one status:

```md
- protected: already uses signed session actor.
- migrate: should use signed session actor in this hardening line.
- sample-compatible: still intentionally accepts actor params for local demo compatibility.
- token-route: uses a separate token/access-code boundary.
- public: no signed actor expected.
```

- [ ] **Step 4: Open follow-up implementation plans if needed**

If more than six non-event-app routes are classified `migrate`, split follow-up plans by app boundary:

```md
- PMCM internal routes: finance, compliance, audit/privacy, suppliers directory, inquiry log-on-behalf.
- External portal routes: client, supplier, guest.
- Sample compatibility routes: `/api/sample/*` only.
```

- [ ] **Step 5: Commit**

```powershell
git add docs/prism-v4/event-auth-rbac-endpoint-sweep.md
git commit -m "docs: inventory remaining actor-param auth routes"
```

---

### Task 9: Documentation And Governance Updates

**Files:**
- Modify: `docs/prism-v4/11-feature-ledger.md`
- Modify: `docs/prism-v4/17-current-state-2026-06-20.md`
- Modify: `docs/prism-v4/18-future-state.md`

- [ ] **Step 1: Update the feature ledger**

Add an entry to `docs/prism-v4/11-feature-ledger.md`:

```md
| AUTH-RBAC-001 | Server-verified event command sessions | Implemented | Owner D | `apps/event` PMCM/coordinator role gating now requires a signed API-issued session token. UI role checks remain UX-only; API authorization derives actor role from verified session claims. |
```

If the file uses another table shape, preserve the local columns and include the same facts.

- [ ] **Step 2: Update current-state security notes**

In `docs/prism-v4/17-current-state-2026-06-20.md`, add:

```md
### Event Command Auth Boundary

The event command app no longer treats browser-stored role values as the API authorization boundary. Login returns an API-signed session token, event-command requests send that token as a bearer credential, and protected PMCM/coordinator/floorplan routes resolve the actor from the verified token. Browser storage remains a UX cache only.
```

- [ ] **Step 3: Update future-state notes**

In `docs/prism-v4/18-future-state.md`, add:

```md
### Remaining Auth Maturity

The signed local session model is the minimum event-command hardening layer. Future production auth work should decide whether to replace it with an external provider, httpOnly cookie sessions, refresh-token rotation, SSO, password reset, and centralized logout/session revocation.
```

- [ ] **Step 4: Commit**

```powershell
git add docs/prism-v4/11-feature-ledger.md docs/prism-v4/17-current-state-2026-06-20.md docs/prism-v4/18-future-state.md
git commit -m "docs: record event auth rbac hardening"
```

---

### Task 10: Full Verification

**Files:**
- No source edits unless verification exposes a concrete regression.

- [ ] **Step 1: Run focused test matrix**

Run:

```powershell
npm --workspace @prism/types run test
npm --workspace @prism/api-client run test
npm --workspace prism-api run test -- libs/modules/identity-ops/src libs/modules/access-control/src libs/modules/event-read-models/src/controllers/pmcm-dashboard.controller.test.ts libs/modules/staffing-ops/src/controllers/coordinator-workspace.controller.test.ts libs/modules/live-ops/src/controllers/coordinator-live-ops.controller.test.ts libs/modules/floorplan/src/controllers/event-floorplans.controller.test.ts libs/modules/plans/src/plans.service.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typechecks**

Run:

```powershell
npm --workspace prism-api run typecheck
npm --workspace @prism/event run typecheck
npm --workspace @prism/api-client run typecheck
npm --workspace @prism/types run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run API build**

Run:

```powershell
npm --workspace prism-api run build
```

Expected: PASS.

- [ ] **Step 4: Manual browser verification**

Start the API and event app:

```powershell
npm run dev:api
npm run dev:event
```

Verify in the browser:

```text
1. Sign in as mys@pmcm.test / prism-admin.
2. Open /dashboard.
3. Open a selected event floorplans tab.
4. Open a draft in the editor.
5. Save the draft.
6. Submit or approve a draft.
7. Sign out.
8. Sign in as marco@pmcm.test / prism-coordinator.
9. Confirm the coordinator view loads.
10. Confirm direct PMCM dashboard API calls with the coordinator token return 403.
```

- [ ] **Step 5: Security sanity check**

In browser devtools, edit `prism:event-command-session` and change `user.role` from `coordinator` to `pmcm-admin` while keeping Marco's token. Refresh `/dashboard`.

Expected:

```text
The UI may briefly attempt PMCM paths depending on cached client state, but PMCM API calls fail because the bearer token still verifies as coordinator. No floorplan create/submit/approve/update succeeds.
```

- [ ] **Step 6: Final commit if verification fixes were needed**

```powershell
git status --short
git add <changed-files>
git commit -m "fix: resolve auth hardening verification issues"
```

Skip this step if verification produced no new edits.

---

## Self-Review

- Spec coverage: The plan covers the supplied finding's core proof points: client-writable event session role, PMCM/coordinator top-level routing, official floorplan/editor entry points, and backend actor role derivation from request-supplied fields.
- Scope boundary: The first landing patch hardens `apps/event` and its API routes. External portal and sample-compatibility routes are inventoried in Task 8 instead of mixed into the event-command patch.
- No placeholder scan: Every task has concrete files, code snippets, commands, and expected results. Follow-up work is explicitly routed through a sweep document with fixed classification labels.
- Type consistency: The shared session type is `PrismAuthenticatedSession`; the verified actor type is `PrismVerifiedEventActor`; the backend guard attaches `request.prismActor`; controllers receive that through `CurrentEventActor`.
