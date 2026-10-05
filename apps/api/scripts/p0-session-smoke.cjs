/* Runs the built API on an ephemeral loopback port against the isolated P0 database. */
const { randomBytes, randomUUID } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const url = new URL(process.env.P0_TEST_DATABASE_URL || 'invalid:');
if (url.hostname !== '127.0.0.1' || url.port !== '55437' || url.pathname !== '/prism_p0') {
  throw new Error('Set P0_TEST_DATABASE_URL to the isolated 127.0.0.1:55437/prism_p0 database');
}
for (const key of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) process.env[key] = url.href;
Object.assign(process.env, {
  DB_SSL: 'false', NODE_ENV: 'production', PARE_MODE: 'mock',
  PRISM_DISABLE_CONFORME_REMINDER_JOB: '1',
  PRISM_SESSION_SECRET: randomBytes(48).toString('hex'),
  PRISM_SESSION_TTL_SECONDS: '28800',
});

require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe, RequestMethod } = require('@nestjs/common');
const { PATH_METADATA, METHOD_METADATA, GUARDS_METADATA } = require('@nestjs/common/constants');
const compiled = resolve(__dirname, '../dist/apps/api/src');
const { AppModule } = require(resolve(compiled, 'app.module.js'));
const { AuthSessionService, EventSessionGuard } = require(resolve(compiled, 'kernel/event-session/index.js'));
const { PrismaExceptionFilter } = require(resolve(compiled, 'common/prisma-exception.filter.js'));
const { PrismaService } = require(resolve(compiled, 'kernel/database/index.js'));

// Every route without EventSessionGuard needs an explicit alternative trust boundary.
const publicExceptions = new Map([
  ['POST /api/auth/login', 'password challenge'],
  ['POST /api/auth/2fa/setup', 'signed enrollment token'],
  ['POST /api/auth/2fa/verify', 'signed challenge token and TOTP'],
  ['POST /api/auth/approval-requests', 'public account request'],
  ['POST /api/inquiries', 'public intake'],
  ['POST /api/supplier-applications', 'public intake'],
  ['GET /api/supplier-applications/categories', 'public intake categories'],
  ['GET /api/health', 'health probe'],
  ['GET /api/guest/events/:accessCode', 'event access code'],
  ['POST /api/guest/events/:accessCode/check-ins', 'event access code and consent'],
  ['POST /api/guest/events/:accessCode/feedback', 'event access code and moderation'],
  ['GET /api/quote-requests/:token', 'unique expiring quote capability'],
  ['POST /api/quote-requests/:token/quote', 'unique expiring quote capability'],
  ['PATCH /api/quote-requests/:token/quote', 'unique expiring quote capability and revision policy'],
]);

function registeredRoutes(app) {
  const routes = new Map();
  for (const module of app.container.getModules().values()) {
    for (const controller of module.controllers.values()) {
      const type = controller.metatype;
      if (!type?.prototype) continue;
      const prefix = Reflect.getMetadata(PATH_METADATA, type);
      const classGuards = Reflect.getMetadata(GUARDS_METADATA, type) || [];
      for (const name of Object.getOwnPropertyNames(type.prototype)) {
        const handler = type.prototype[name];
        const method = Reflect.getMetadata(METHOD_METADATA, handler);
        if (method === undefined) continue;
        const guards = [...classGuards, ...(Reflect.getMetadata(GUARDS_METADATA, handler) || [])];
        for (const path of [Reflect.getMetadata(PATH_METADATA, handler)].flat()) {
          const route = `/api/${prefix}/${path || ''}`.replaceAll(/\/+/g, '/').replace(/\/$/, '');
          const key = `${RequestMethod[method]} ${route}`;
          routes.set(key, { method: RequestMethod[method], route, controller: type.name, sessionGuarded: guards.includes(EventSessionGuard) });
        }
      }
    }
  }
  return [...routes.values()].sort((left, right) => left.route.localeCompare(right.route));
}

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'], abortOnError: false });
  const fixtureIds = [0, 1].map(() => `p0_http_${randomUUID()}`);
  const primaryAccountId = `p0_http_primary_client_${randomUUID()}`;
  const secondaryAccountId = `p0_http_secondary_client_${randomUUID()}`;
  const primaryEmail = `${primaryAccountId}@example.test`;
  const secondaryEmail = `${secondaryAccountId}@example.test`;
  const officialPlanId = `p0_http_official_plan_${randomUUID()}`;
  const officialDraftId = `p0_http_official_draft_${randomUUID()}`;
  const supplierId = `p0_http_supplier_${randomUUID()}`;
  const supplierCategoryId = `p0_http_supplier_category_${randomUUID()}`;
  const supplierRequestId = `p0_http_supplier_request_${randomUUID()}`;
  let prisma;
  try {
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    prisma = app.get(PrismaService);
    const sessions = app.get(AuthSessionService);
    const client = { id: 'p0_http_client', name: 'P0 HTTP Client', email: primaryEmail, role: 'client', organization: 'P0 test' };
    const secondaryClient = {
      id: secondaryAccountId,
      name: 'P0 HTTP Secondary Client',
      email: secondaryEmail,
      role: 'client',
      organization: 'P0 test',
      approvalStatus: 'approved',
    };
    await prisma.opsUser.create({ data: {
      id: primaryAccountId,
      name: client.name,
      email: primaryEmail,
      password: 'p0-smoke-fixture',
      role: 'client',
      organization: client.organization,
      approvalStatus: 'approved',
    } });
    await prisma.opsUser.create({ data: {
      id: secondaryAccountId,
      name: secondaryClient.name,
      email: secondaryEmail,
      password: 'p0-smoke-fixture',
      role: 'client',
      organization: secondaryClient.organization,
      approvalStatus: 'approved',
    } });
    const expired = sessions.issueSession(client, new Date(Date.now() - 86_400_000)).accessToken;
    const clientToken = sessions.issueSession(client).accessToken;
    const secondaryClientToken = sessions.issueSession(secondaryClient).accessToken;
    const pmcmToken = sessions.issueSession({ ...client, id: 'p0_http_pmcm', role: 'pmcm-admin' }).accessToken;
    const results = [];
    async function check(method, path, token, expected, label, body, validateBody) {
      const headers = { 'content-type': 'application/json' };
      if (token) headers.authorization = `Bearer ${token}`;
      const response = await fetch(`${base}${path}`, {
        method,
        headers,
        ...(method === 'GET' || method === 'HEAD' ? {} : { body: JSON.stringify(body ?? {}) }),
      });
      let responseBody;
      try {
        responseBody = await response.json();
      } catch {
        responseBody = null;
      }
      const bodyPassed = validateBody ? Boolean(validateBody(responseBody)) : true;
      const passed = response.status === expected && bodyPassed;
      results.push({
        method,
        path,
        label,
        expected,
        status: response.status,
        ...(validateBody ? { bodyValidated: bodyPassed } : {}),
        passed,
      });
      return responseBody;
    }
    const inventory = registeredRoutes(app);
    const routes = inventory.filter((route) => route.sessionGuarded);
    const publicRoutes = inventory.filter((route) => !route.sessionGuarded);
    const unexpectedPublicRoutes = publicRoutes.filter(({ method, route }) => !publicExceptions.has(`${method} ${route}`));
    for (const { method, route } of routes) {
      const path = route.replace(/:[A-Za-z0-9_]+/g, 'p0_missing') + '?actorRole=pmcm-admin&actorName=Spoofed';
      await check(method, path, null, 401, 'no session with spoofed actor');
      await check(method, path, 'invalid-token', 401, 'malformed session');
      await check(method, path, expired, 401, 'expired signed session');
    }
    for (const path of ['/api/privacy/requests', '/api/audit/logs']) {
      await check('GET', `${path}?actorRole=pmcm-admin`, clientToken, 403, 'client cannot spoof trust operator');
      await check('GET', path, pmcmToken, 200, 'verified PMCM read');
    }
    for (const [index, id] of fixtureIds.entries()) {
      const email = index === 0 ? client.email : 'p0-http-other@example.test';
      await prisma.opsInquiry.create({ data: {
        id, clientName: client.name, email, normalizedEmail: email,
        eventName: `HTTP ownership ${index}`, eventDate: new Date('2031-04-18'), clientType: 'Individual',
        events: { create: {
          id,
          clientName: client.name,
          eventName: `HTTP ownership ${index}`,
          eventDate: new Date('2031-04-18'),
          clientPortalStatus: index === 0 ? 'unlocked' : 'locked',
        } },
      } });
      await prisma.floorPlan.create({ data: { id, name: 'HTTP snapshot', ownerId: 'p0_http_pmcm' } });
      await prisma.opsFloorPlanDraft.create({ data: {
        id,
        eventId: id,
        floorPlanId: id,
        name: 'HTTP approved snapshot',
        status: 'approved',
        approvedSnapshot: { objects: [] },
        submittedSnapshot: { objects: [] },
      } });
      const expected = index === 0 ? 200 : 403;
      for (const suffix of ['', '/file-requirements', `/floorplans/${id}/snapshot`]) {
        await check('GET', `/api/events/${id}${suffix}?actorRole=pmcm-admin&actorName=Spoofed`, clientToken, expected, index === 0 ? 'verified owner read' : 'namesake foreign event denied');
      }
    }

    await prisma.floorPlan.create({
      data: { id: officialPlanId, name: 'HTTP PMCM official in-review plan', ownerId: 'p0_http_pmcm' },
    });
    await prisma.opsFloorPlanDraft.create({
      data: {
        id: officialDraftId,
        eventId: fixtureIds[0],
        floorPlanId: officialPlanId,
        name: 'HTTP PMCM official in-review plan',
        status: 'in_review',
        sourceType: 'blank',
        createdByRole: 'pmcm-admin',
        submittedSnapshot: { objects: [] },
        approvedSnapshot: { objects: [] },
        submittedSnapshotAt: new Date(),
        approvedSnapshotAt: new Date(),
      },
    });

    const supplierEmail = `${supplierId}@example.test`;
    const supplierToken = sessions.issueSession({
      ...client,
      id: supplierId,
      role: 'supplier',
      email: supplierEmail,
    }).accessToken;
    await prisma.opsSupplierCategory.create({
      data: { id: supplierCategoryId, slug: supplierCategoryId, name: 'P0 HTTP Supplier category' },
    });
    await prisma.opsSupplier.create({
      data: {
        id: supplierId,
        categoryId: supplierCategoryId,
        name: 'P0 HTTP Supplier',
        email: supplierEmail,
      },
    });
    await prisma.opsSupplierQuoteRequest.create({
      data: {
        id: supplierRequestId,
        eventId: fixtureIds[0],
        supplierId,
        categoryId: supplierCategoryId,
        supplierName: 'P0 HTTP Supplier',
        category: 'P0 HTTP Supplier category',
        accessToken: `${supplierRequestId}-token`,
        status: 'selected',
        assignmentStatus: 'confirmed',
      },
    });
    for (const type of ['approved', 'submitted']) {
      await check(
        'GET',
        `/api/events/${fixtureIds[0]}/floorplans/${fixtureIds[0]}/snapshot?type=${type}`,
        supplierToken,
        403,
        `event-scoped supplier denied ${type} floorplan snapshot`,
      );
    }
    await check('GET', `/api/plans/${officialPlanId}`, clientToken, 403, 'client denied PMCM in-review raw plan read');
    await check('PUT', `/api/plans/${officialPlanId}`, clientToken, 403, 'client denied PMCM in-review raw plan update');
    await check('GET', `/api/plans/${officialPlanId}/export`, clientToken, 403, 'client denied PMCM in-review raw plan export');

    const eventId = fixtureIds[0];
    const lockedEventId = fixtureIds[1];
    const candidatesPath = `/api/events/${eventId}/client-floorplan-access/candidates?query=${encodeURIComponent('P0 HTTP')}`;
    await check(
      'GET',
      candidatesPath,
      pmcmToken,
      200,
      'PMCM finds approved secondary candidates and excludes the primary contact',
      undefined,
      (body) => Array.isArray(body)
        && body.some((account) => account.id === secondaryAccountId)
        && !body.some((account) => account.id === primaryAccountId),
    );
    await check(
      'POST',
      `/api/events/${eventId}/client-floorplan-access`,
      pmcmToken,
      200,
      'PMCM grants an existing approved secondary Client',
      { userId: secondaryAccountId },
    );
    await check(
      'POST',
      `/api/events/${eventId}/client-floorplan-access`,
      pmcmToken,
      200,
      'repeated secondary grant remains idempotent',
      { userId: secondaryAccountId },
    );
    await check(
      'GET',
      `/api/events/${eventId}/client-floorplan-access`,
      pmcmToken,
      200,
      'PMCM access list shows primary and one secondary contact',
      undefined,
      (body) => body?.primaryContact?.email === primaryEmail
        && body.secondaryContacts?.length === 1
        && body.secondaryContacts[0]?.id === secondaryAccountId,
    );
    await check(
      'GET',
      candidatesPath,
      pmcmToken,
      200,
      'candidate search excludes primary and active secondary contacts',
      undefined,
      (body) => Array.isArray(body)
        && !body.some((account) => account.id === primaryAccountId || account.id === secondaryAccountId),
    );
    await check(
      'GET',
      '/api/client/shared-floorplans',
      secondaryClientToken,
      200,
      'secondary Client receives the minimal shared-floorplan list',
      undefined,
      (body) => Array.isArray(body)
        && body.some((entry) => entry.eventId === eventId && entry.draftId === officialDraftId
          && entry.availableSnapshots.includes('submitted')
          && entry.availableSnapshots.includes('approved')),
    );
    for (const type of ['submitted', 'approved']) {
      await check(
        'GET',
        `/api/events/${eventId}/floorplans/${officialDraftId}/snapshot?type=${type}`,
        secondaryClientToken,
        200,
        `active secondary Client can read ${type} snapshot`,
      );
    }
    await check(
      'PATCH',
      `/api/events/${eventId}/floorplans/${officialDraftId}/review`,
      secondaryClientToken,
      403,
      'secondary Client cannot submit a revision comment',
      { revisionNote: 'P0 secondary comment must be denied' },
    );
    await check(
      'POST',
      `/api/events/${lockedEventId}/client-floorplan-access`,
      pmcmToken,
      200,
      'PMCM can grant the locked event without unlocking client access',
      { userId: secondaryAccountId },
    );
    await check(
      'GET',
      `/api/events/${lockedEventId}/floorplans/${lockedEventId}/snapshot?type=approved`,
      secondaryClientToken,
      403,
      'active secondary grant remains denied while the event client portal is locked',
    );
    await check(
      'DELETE',
      `/api/events/${eventId}/client-floorplan-access/${secondaryAccountId}`,
      pmcmToken,
      200,
      'PMCM revokes secondary floorplan access',
    );
    await check(
      'DELETE',
      `/api/events/${eventId}/client-floorplan-access/${secondaryAccountId}`,
      pmcmToken,
      200,
      'repeated secondary revoke remains idempotent',
    );
    for (const type of ['submitted', 'approved']) {
      await check(
        'GET',
        `/api/events/${eventId}/floorplans/${officialDraftId}/snapshot?type=${type}`,
        secondaryClientToken,
        403,
        `revoked secondary Client cannot read ${type} snapshot`,
      );
    }
    const coordinator = { ...client, id: fixtureIds[0], role: 'coordinator', email: 'p0-http-coordinator@example.test' };
    const coordinatorToken = sessions.issueSession(coordinator).accessToken;
    await prisma.opsCoordinator.create({ data: { id: fixtureIds[0], name: coordinator.name, email: coordinator.email } });
    await prisma.opsCoordinatorAssignment.create({ data: {
      id: fixtureIds[0], eventId: fixtureIds[0], coordinatorId: fixtureIds[0], coordinatorName: coordinator.name, role: 'floor', status: 'acknowledged',
    } });
    for (const [status, active, expected] of [['acknowledged', true, 200], ['cancelled', true, 403], ['replaced', true, 403], ['acknowledged', false, 403]]) {
      await prisma.opsCoordinatorAssignment.update({ where: { id: fixtureIds[0] }, data: { status } });
      await prisma.opsCoordinator.update({ where: { id: fixtureIds[0] }, data: { active } });
      for (const suffix of ['/file-requirements', `/floorplans/${fixtureIds[0]}/snapshot`]) {
        await check('GET', `/api/events/${fixtureIds[0]}${suffix}`, coordinatorToken, expected, `coordinator assignment ${status}; active profile ${active}`);
      }
    }
    await check('GET', '/api/publish/p0_missing?actorRole=pmcm-admin', clientToken, 403, 'client denied raw published layout');
    await check('GET', '/api/health', null, 200, 'public health remains available');
    await check('GET', '/api/quote-requests/p0_missing', null, 404, 'invalid quote capability denied');
    await check('GET', '/api/sample/state', null, 404, 'retired sample aggregate route is not registered');
    await check('POST', '/api/sample/reset', null, 404, 'retired sample reset route is not registered');
    const failures = results.filter((result) => !result.passed);
    const report = { checkedAt: new Date().toISOString(), guardedRouteCount: routes.length, checkCount: results.length, failures, unexpectedPublicRoutes, publicRoutes, routes, results };
    if (process.env.P0_SMOKE_REPORT) writeFileSync(process.env.P0_SMOKE_REPORT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ guardedRouteCount: routes.length, checks: results.length, failures, unexpectedPublicRoutes, publicRoutes }, null, 2));
    if (failures.length || unexpectedPublicRoutes.length) process.exitCode = 1;
  } finally {
    if (prisma) {
      await prisma.opsEvent.deleteMany({ where: { id: { in: fixtureIds } } });
      await prisma.opsInquiry.deleteMany({ where: { id: { in: fixtureIds } } });
      await prisma.opsSupplierQuoteRequest.deleteMany({ where: { id: supplierRequestId } });
      await prisma.opsSupplier.deleteMany({ where: { id: supplierId } });
      await prisma.opsSupplierCategory.deleteMany({ where: { id: supplierCategoryId } });
      await prisma.floorPlan.deleteMany({ where: { id: { in: [...fixtureIds, officialPlanId] } } });
      await prisma.opsCoordinator.deleteMany({ where: { id: { in: fixtureIds } } });
      await prisma.opsUser.deleteMany({ where: { id: { in: [primaryAccountId, secondaryAccountId] } } });
    }
    await app.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
