import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { AuthSecurityService } from '@prism/contexts/identity-access';
import { AuditService } from '@prism/contexts/platform-ops';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { OpsUserRole } from '@prism/kernel/event-core';
import { defaultSeatCategories } from '@prism/kernel/shared';
import { PRISM_PRIVACY_NOTICE_VERSION } from '@prism/types';

const LOCAL_FIXTURE_OWNER_ID = 'owner-sample';

const SUPPLIER_CATEGORIES = [
  { id: 'supcat_production', slug: 'production', name: 'Production', acceptableMin: 180000, acceptableMax: 280000 },
  { id: 'supcat_technicals', slug: 'technicals', name: 'Technicals', acceptableMin: 120000, acceptableMax: 180000 },
  {
    id: 'supcat_digital_registration',
    slug: 'digital-registration',
    name: 'Digital Registration',
    acceptableMin: 45000,
    acceptableMax: 90000,
  },
  { id: 'supcat_documentation', slug: 'documentation', name: 'Documentation', acceptableMin: 65000, acceptableMax: 120000 },
  {
    id: 'supcat_food_beverages',
    slug: 'food-and-beverages',
    name: 'Food and Beverages',
    acceptableMin: 140000,
    acceptableMax: 220000,
  },
  { id: 'supcat_talents', slug: 'talents', name: 'Talents', acceptableMin: 50000, acceptableMax: 120000 },
  { id: 'supcat_logistics', slug: 'logistics', name: 'Logistics', acceptableMin: 30000, acceptableMax: 70000 },
  {
    id: 'supcat_program_manpower',
    slug: 'program-and-manpower',
    name: 'Program and Manpower',
    acceptableMin: 45000,
    acceptableMax: 95000,
  },
].map((category, index) => ({ ...category, sortOrder: index + 1 }));

const LOGIN_LOCKOUT_THRESHOLD = 5;
const LOGIN_LOCKOUT_MINUTES = 10;
const PERMANENT_LOCKOUT_THRESHOLD = 5;
const BULK_EXPORT_ALERT_THRESHOLD = 25;

const SEEDED_SUPPLIERS = [
  {
    id: 'sup_brightstage',
    categoryId: 'supcat_production',
    name: 'BrightStage Production',
    contactName: 'Ramon Cruz',
    email: 'ops@brightstage.test',
    phone: '+63 917 555 0101',
    tier: 'tier_1',
    bniMember: true,
    serviceInclusions: 'Stage fabrication, truss, production crew, ingress and egress supervision.',
    performanceNotes: 'Preferred production team for corporate ballrooms and controlled ingress windows.',
    certifications: ['DTI registration.pdf', 'Electrical safety clearance.pdf'],
  },
  {
    id: 'sup_northbay',
    categoryId: 'supcat_production',
    name: 'Northbay Builds',
    contactName: 'Paolo Reyes',
    email: 'hello@northbay.test',
    phone: '+63 917 555 0102',
    tier: 'tier_2',
    bniMember: false,
    serviceInclusions: 'Backup stage risers, scenic walls, carpentry support, and overnight setup crew.',
    performanceNotes: 'Reliable backup for smaller venue builds.',
    certifications: ['Warehouse safety checklist.pdf'],
  },
  {
    id: 'sup_sonicline',
    categoryId: 'supcat_technicals',
    name: 'SonicLine Technicals',
    contactName: 'Dane Villanueva',
    email: 'dane@sonicline.test',
    phone: '+63 917 555 0103',
    tier: 'tier_1',
    bniMember: false,
    serviceInclusions: 'Audio system, lights, LED wall, livestream feed, and technical director.',
    performanceNotes: 'Strong for keynote-heavy corporate programs.',
    certifications: ['AV crew roster.xlsx'],
  },
  {
    id: 'sup_stagepulse',
    categoryId: 'supcat_technicals',
    name: 'StagePulse AV',
    contactName: 'Mina Navarro',
    email: 'quotes@stagepulse.test',
    phone: '+63 917 555 0112',
    tier: 'tier_1',
    bniMember: false,
    serviceInclusions: 'Audio reinforcement, lighting board, LED wall operator, and technical standby.',
    performanceNotes: 'Competitive Tier 1 option for AV-heavy corporate programs.',
    certifications: ['Technical crew list.xlsx'],
  },
  {
    id: 'sup_xperto',
    categoryId: 'supcat_digital_registration',
    name: 'XPERTO Registration',
    contactName: 'Grace Lim',
    email: 'ops@xperto.test',
    phone: '+63 917 555 0104',
    tier: 'tier_1',
    bniMember: true,
    serviceInclusions: 'QR and name-search registration, device rental, registration staff briefing.',
    performanceNotes: 'Confirmed Tier 1 for digital registration.',
    certifications: ['Data privacy undertaking.pdf'],
  },
  {
    id: 'sup_clickpass',
    categoryId: 'supcat_digital_registration',
    name: 'Click Pass',
    contactName: 'Nico Uy',
    email: 'support@clickpass.test',
    phone: '+63 917 555 0105',
    tier: 'tier_2',
    bniMember: false,
    serviceInclusions: 'QR list import, on-site check-in laptop, and post-event attendance export.',
    performanceNotes: 'Confirmed Tier 2 backup for registration.',
    certifications: ['Local attendance export.xlsx'],
  },
  {
    id: 'sup_lenscraft',
    categoryId: 'supcat_documentation',
    name: 'LensCraft Studios',
    contactName: 'Mika Santos',
    email: 'bookings@lenscraft.test',
    phone: '+63 917 555 0106',
    tier: 'tier_1',
    bniMember: false,
    serviceInclusions: 'Photo, video, same-day edit, highlight reel, and raw file turnover.',
    performanceNotes: 'Best fit for executive events with fast post-event deliverables.',
    certifications: ['Drone permit fixture.pdf'],
  },
  {
    id: 'sup_harvesttable',
    categoryId: 'supcat_food_beverages',
    name: 'Harvest Table Catering',
    contactName: 'Lara Mendoza',
    email: 'events@harvesttable.test',
    phone: '+63 917 555 0107',
    tier: 'tier_1',
    bniMember: true,
    serviceInclusions: 'Buffet menu, VIP plated service, packed crew meals, and dietary tagging.',
    performanceNotes: 'Consistent client-facing service standards.',
    certifications: ['Sanitation permit.pdf'],
  },
  {
    id: 'sup_spotlight',
    categoryId: 'supcat_talents',
    name: 'Spotlight Talent Network',
    contactName: 'Iris Tan',
    email: 'talents@spotlight.test',
    phone: '+63 917 555 0108',
    tier: 'tier_1',
    bniMember: false,
    serviceInclusions: 'Hosts, performers, briefing coordination, call time reminders.',
    performanceNotes: 'Reliable for formal hosts and multilingual program needs.',
    certifications: ['Talent rate card.pdf'],
  },
  {
    id: 'sup_movefast',
    categoryId: 'supcat_logistics',
    name: 'MoveFast Logistics',
    contactName: 'Jun Ortiz',
    email: 'dispatch@movefast.test',
    phone: '+63 917 555 0109',
    tier: 'tier_1',
    bniMember: false,
    serviceInclusions: 'Transport booking, equipment pickup, egress dispatch, and delivery tracking.',
    performanceNotes: 'Strong for multi-stop equipment movement.',
    certifications: ['Vehicle list.xlsx'],
  },
  {
    id: 'sup_eventcore',
    categoryId: 'supcat_program_manpower',
    name: 'EventCore Manpower',
    contactName: 'Bea Garcia',
    email: 'team@eventcore.test',
    phone: '+63 917 555 0110',
    tier: 'tier_1',
    bniMember: false,
    serviceInclusions: 'Ushers, registration assistants, ingress runners, and program manpower.',
    performanceNotes: 'Dependable for medium-scale staffing grids.',
    certifications: ['Manpower briefing template.pdf'],
  },
  {
    id: 'sup_newwave',
    categoryId: 'supcat_documentation',
    name: 'New Wave Content',
    contactName: 'Toni Cruz',
    email: 'apply@newwave.test',
    phone: '+63 917 555 0111',
    tier: 'pending_first_event',
    bniMember: false,
    serviceInclusions: 'Short-form video capture, reels edit, and moderated content turnover.',
    performanceNotes: 'Approved application awaiting first PMCM event.',
    certifications: ['Portfolio links.pdf'],
  },
  {
    id: 'sup_bloom',
    categoryId: 'supcat_production',
    name: 'Bloom Florals',
    contactName: 'Patricia Flores',
    email: 'flowers@bloom.test',
    phone: '+63 917 555 0113',
    tier: 'tier_2',
    bniMember: false,
    serviceInclusions: 'Floral arrangements, entrance decor, centerpieces, and styling crew.',
    performanceNotes: 'Tier 2 floral supplier fixture for local portal sign-in.',
    certifications: ['Floral design portfolio.pdf'],
  },
];

const COORDINATOR_ROLE_REQUIREMENTS = [
  { role: 'Floor Director', required: 1 },
  { role: 'Stage Director', required: 1 },
  { role: 'Registration Staff', required: 2 },
  { role: 'Ingress and Egress Assistant', required: 1 },
  { role: 'Event Day System Operator', required: 1 },
  { role: 'Usher', required: 2 },
  { role: 'General Coordinator', required: 1 },
];

const SEEDED_COORDINATORS = [
  {
    id: 'coord_marco',
    userId: 'usr_coord',
    name: 'Marco Santos',
    email: 'marco@pmcm.test',
    roleTags: ['Floor Director', 'Event Day System Operator', 'General Coordinator'],
    skillsTags: ['supplier coordination', 'client walkthrough', 'floorplan execution'],
  },
  {
    id: 'coord_bianca',
    name: 'Bianca Lim',
    email: 'bianca@pmcm.test',
    roleTags: ['Stage Director', 'Event Day System Operator'],
    skillsTags: ['program flow', 'AV cues', 'show calling'],
  },
  {
    id: 'coord_carla',
    name: 'Carla Dela Cruz',
    email: 'carla@pmcm.test',
    roleTags: ['Registration Staff', 'Usher'],
    skillsTags: ['guest verification', 'VIP handling', 'walk-in queue'],
  },
  {
    id: 'coord_juan',
    name: 'Juan Pascual',
    email: 'juan@pmcm.test',
    roleTags: ['Ingress and Egress Assistant', 'General Coordinator'],
    skillsTags: ['supplier ingress', 'logistics', 'vehicle dispatch'],
  },
  {
    id: 'coord_ana',
    name: 'Ana Macaraeg',
    email: 'ana.macaraeg@pmcm.test',
    roleTags: ['Registration Staff', 'Usher'],
    skillsTags: ['guest flow', 'name search', 'front desk'],
  },
  {
    id: 'coord_mark',
    name: 'Mark Reyes',
    email: 'mark.reyes@pmcm.test',
    roleTags: ['Floor Director', 'Stage Director'],
    skillsTags: ['venue layout', 'technical bridge', 'backstage'],
  },
];

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

const PRISMA_MODEL_COUNT_BATCH_SIZE = 8;

function prismaDelegateName(modelName: Prisma.ModelName): Uncapitalize<Prisma.ModelName> {
  return `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}` as Uncapitalize<Prisma.ModelName>;
}

function hasCountMethod(delegate: unknown): delegate is { count: () => unknown } {
  return (
    typeof delegate === 'object' &&
    delegate !== null &&
    'count' in delegate &&
    typeof delegate.count === 'function'
  );
}

async function countPrismaModelRows(prisma: PrismaService, modelName: Prisma.ModelName): Promise<number> {
  const delegate: unknown = prisma[prismaDelegateName(modelName)];
  if (!hasCountMethod(delegate)) {
    throw new Error(`Fixture seeding could not verify model ${modelName}.`);
  }

  const rowCount = await delegate.count();
  if (typeof rowCount !== 'number' || !Number.isSafeInteger(rowCount) || rowCount < 0) {
    throw new Error(`Fixture seeding received an invalid row count for model ${modelName}.`);
  }
  return rowCount;
}

@Injectable()
export class LocalFixtureSeeder {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async seedFixtures() {
    const models = Object.values(Prisma.ModelName);
    for (let offset = 0; offset < models.length; offset += PRISMA_MODEL_COUNT_BATCH_SIZE) {
      const modelBatch = models.slice(offset, offset + PRISMA_MODEL_COUNT_BATCH_SIZE);
      const existingRows = await Promise.all(
        modelBatch.map((modelName) => countPrismaModelRows(this.prisma, modelName)),
      );
      if (existingRows.some((count) => count > 0)) {
        throw new Error(
          'Fixture seeding requires an empty database. Recreate prism_sample_disposable with migrations first.',
        );
      }
    }

    const createdAt = new Date();
    await this.seedFixtureData(createdAt);
    await this.ensureSupportingFixtures();
  }
  private async ensureSupportingFixtures() {
    await this.ensureSupplierDirectorySeeded();
    await this.ensureComplianceRulesSeeded();
    await this.ensureSupplierQuoteFixtures();
    await this.ensurePareAssignedSuppliersSeeded();
    await this.ensureCoordinatorPoolSeeded();
    await this.ensureUnassignedScopingEventSeeded();
    await this.ensureAyalaCoordinatorAssignmentSeeded();
    await this.ensureInquiryOnboardingBackfilled();
    await this.ensureSecurityAuditSeeded();
  }

  private async ensureComplianceRulesSeeded() {
    const ruleCount = await this.prisma.opsComplianceRule.count();
    if (ruleCount > 0) return;

    await this.prisma.opsComplianceRule.createMany({
      data: [
        {
          id: 'crule_seed_supplier_contracts',
          eventType: '',
          phase: 'planning',
          severity: 'must_fix',
          layer: 'Must-Fix',
          conditionKey: 'supplier_contracts_ready',
          title: 'Supplier contracts ready',
          note: 'Attach final signed supplier quotations before event lock.',
          active: true,
        },
        {
          id: 'crule_seed_ingress_timing',
          eventType: '',
          phase: 'planning',
          severity: 'watch_out',
          layer: 'Should-Fix',
          conditionKey: 'ingress_timing_ready',
          title: 'Ingress timing ready',
          note: 'Confirm guest arrival and ingress window with assigned suppliers.',
          active: true,
        },
        {
          id: 'crule_seed_floorplan_approved',
          eventType: '',
          phase: 'pre_event',
          severity: 'must_fix',
          layer: 'Must-Fix',
          conditionKey: 'floorplan_approved',
          title: 'Official floorplan approved',
          note: 'PMCM must approve the official layout before final event lock.',
          active: true,
        },
      ],
      skipDuplicates: true,
    });
  }

  private async ensureSupplierQuoteFixtures() {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: 'evt_sample_ayala' } });
    if (!event) return;

    const existingQuoteCount = await this.prisma.opsSupplierQuote.count({
      where: { eventId: event.id, category: 'Technicals' },
    });
    if (existingQuoteCount > 0) return;

    const category = await this.prisma.opsSupplierCategory.findUnique({ where: { id: 'supcat_technicals' } });
    if (!category) return;

    const suppliers = await this.prisma.opsSupplier.findMany({
      where: { id: { in: ['sup_sonicline', 'sup_stagepulse'] } },
      orderBy: { name: 'asc' },
    });
    if (suppliers.length < 2) return;

    const dueDate = addDays(new Date(), 7);
    await this.prisma.$transaction(async (tx) => {
      const quoteRequests = suppliers.map((supplier) => {
        const isStagePulse = supplier.id === 'sup_stagepulse';
        const requestId = `qr_sample_${supplier.id}`;
        return {
          request: {
            id: requestId,
            eventId: event.id,
            supplierId: supplier.id,
            categoryId: category.id,
            supplierName: supplier.name,
            category: category.name,
            dueDate,
            accessToken: `sample-token-${supplier.id}`,
            confidentialBid: true,
            message: 'Local fixture quote request.',
            status: 'submitted',
          },
          quote: {
            id: `quote_sample_${supplier.id}`,
            eventId: event.id,
            requestId,
            supplierId: supplier.id,
            categoryId: category.id,
            supplierName: supplier.name,
            category: category.name,
            amount: isStagePulse ? 205000 : 168000,
            inclusions: toPrismaJson(
              isStagePulse
                ? ['Premium LED wall package', 'Lighting board operator', 'Two technical standbys']
                : ['Audio system', 'Basic LED wall', 'Technical director'],
            ),
            paymentTerms: '50% reservation, 50% before ingress',
            notes: isStagePulse ? 'Includes extended LED wall package.' : 'Within standard technical scope.',
            acceptableMin: category.acceptableMin,
            acceptableMax: category.acceptableMax,
            outsideAcceptableRange: isStagePulse,
            status: 'received',
          },
        };
      });
      await tx.opsSupplierQuoteRequest.createMany({ data: quoteRequests.map(({ request }) => request) });
      await tx.opsSupplierQuote.createMany({ data: quoteRequests.map(({ quote }) => quote) });
    });
  }

  private async ensurePareAssignedSuppliersSeeded() {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: 'evt_sample_ayala' } });
    if (!event) return;

    const existing = await this.prisma.opsSupplierQuoteRequest.findFirst({
      where: { eventId: 'evt_sample_ayala', id: 'qr_pare_harvesttable' },
    });
    if (existing) return;

    const now = new Date();
    const dueDate = addDays(now, 14);

    await this.prisma.$transaction(async (tx) => {
      // Harvest Table assigned; this is the one PARE will replace when withdrawn.
      await tx.opsSupplierQuoteRequest.create({
        data: {
          id: 'qr_pare_harvesttable',
          eventId: 'evt_sample_ayala',
          supplierId: 'sup_harvesttable',
          categoryId: 'supcat_food_beverages',
          supplierName: 'Harvest Table Catering',
          category: 'Food and Beverages',
          message: 'Full buffet service for 300 pax. VIP plated section required. Include crew meals.',
          dueDate,
          accessToken: 'sample-pare-token-harvesttable',
          status: 'open',
          assignmentStatus: 'confirmed',
          assignmentConfirmedAt: now,
          readinessStatus: 'confirmed',
        },
      });
      await tx.opsSupplierQuote.create({
        data: {
          id: 'quote_pare_harvesttable',
          eventId: 'evt_sample_ayala',
          requestId: 'qr_pare_harvesttable',
          supplierId: 'sup_harvesttable',
          categoryId: 'supcat_food_beverages',
          supplierName: 'Harvest Table Catering',
          category: 'Food and Beverages',
          amount: 185000,
          inclusions: toPrismaJson(['Buffet for 300 pax', 'VIP plated section x30', 'Crew meals x20', 'On-site chef', 'Waitstaff x8']),
          paymentTerms: '50% upon booking, 50% on event day',
          notes: 'Menu finalized. Headcount confirmed at 300.',
          status: 'selected',
          selectedAt: now,
        },
      });

      // LensCraft assigned as the second supplier to provide another fixture option.
      await tx.opsSupplierQuoteRequest.create({
        data: {
          id: 'qr_pare_lenscraft',
          eventId: 'evt_sample_ayala',
          supplierId: 'sup_lenscraft',
          categoryId: 'supcat_documentation',
          supplierName: 'LensCraft Studios',
          category: 'Documentation',
          message: 'Full event documentation: photo, video, same-day edit, raw file turnover.',
          dueDate,
          accessToken: 'sample-pare-token-lenscraft',
          status: 'open',
          assignmentStatus: 'confirmed',
          assignmentConfirmedAt: now,
          readinessStatus: 'confirmed',
        },
      });
      await tx.opsSupplierQuote.create({
        data: {
          id: 'quote_pare_lenscraft',
          eventId: 'evt_sample_ayala',
          requestId: 'qr_pare_lenscraft',
          supplierId: 'sup_lenscraft',
          categoryId: 'supcat_documentation',
          supplierName: 'LensCraft Studios',
          category: 'Documentation',
          amount: 95000,
          inclusions: toPrismaJson(['Full event photo coverage', 'Highlight video', 'Same-day edit', 'Raw file turnover']),
          paymentTerms: '50% upon booking, 50% on event day',
          notes: 'Run-of-show received. All outputs confirmed.',
          status: 'selected',
          selectedAt: now,
        },
      });
    });
  }

  private async ensureCoordinatorPoolSeeded() {
    const coordinatorCount = await this.prisma.opsCoordinator.count();
    if (coordinatorCount > 0) return;

    await this.prisma.opsCoordinator.createMany({
      data: SEEDED_COORDINATORS.map((coordinator) => ({
        id: coordinator.id,
        userId: coordinator.userId ?? null,
        name: coordinator.name,
        email: coordinator.email,
        roleTags: coordinator.roleTags,
        skillsTags: coordinator.skillsTags,
        active: true,
        createdAt: new Date(),
      })),
      skipDuplicates: true,
    });
  }

  private async ensureUnassignedScopingEventSeeded() {
    const createdAt = new Date();
    const existingInquiry = await this.prisma.opsInquiry.findUnique({ where: { id: 'inq_sample_unassigned' } });
    if (!existingInquiry) {
      await this.prisma.opsInquiry.create({
        data: {
          id: 'inq_sample_unassigned',
          clientName: 'Scope Fixture Client',
          companyName: 'PMCM Fixture',
          email: 'scope@pmcm.test',
          eventName: 'Coordinator Scope Check 2026',
          eventType: 'Corporate Summit',
          eventDate: new Date('2026-11-04'),
          clientType: 'Corporate',
          source: 'P.R.I.S.M Website',
          message: 'Fixture event with no coordinator assignment, used for negative event-scoping checks.',
          status: 'accepted',
          acceptedAt: createdAt,
          conformeSentAt: createdAt,
          conformeSignedAt: createdAt,
          portalActivatedAt: createdAt,
          portalInvitationStatus: 'opened',
          privacyConsentAccepted: true,
          privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
          createdAt,
        },
      });
    }

    const existingEvent = await this.prisma.opsEvent.findUnique({ where: { id: 'evt_sample_unassigned' } });
    if (existingEvent) return;

    await this.prisma.opsEvent.create({
      data: {
        id: 'evt_sample_unassigned',
        inquiryId: 'inq_sample_unassigned',
        clientName: 'Scope Fixture Client',
        eventName: 'Coordinator Scope Check 2026',
        eventDate: new Date('2026-11-04'),
        status: 'planning',
        clientPortalStatus: 'unlocked',
        readiness: 'Conforme signed',
        archived: false,
        createdAt,
        updatedAt: createdAt,
      },
    });
  }

  private async ensureAyalaCoordinatorAssignmentSeeded() {
    const marco = await this.prisma.opsCoordinator.findUnique({ where: { id: 'coord_marco' } });
    const ayala = await this.prisma.opsEvent.findUnique({ where: { id: 'evt_sample_ayala' } });
    if (!marco || !ayala) return;

    const existing = await this.prisma.opsCoordinatorAssignment.findFirst({
      where: { eventId: 'evt_sample_ayala', coordinatorId: 'coord_marco' },
    });
    if (existing) return;

    const createdAt = new Date();
    await this.prisma.opsCoordinatorAssignment.create({
      data: {
        id: 'coord_asg_ayala_marco',
        eventId: 'evt_sample_ayala',
        coordinatorId: 'coord_marco',
        coordinatorName: 'Marco Santos',
        role: 'Floor Director',
        status: 'acknowledged',
        eventDate: ayala.eventDate,
        acknowledgedAt: createdAt,
        createdAt,
      },
    });
  }

  private async ensureSecurityAuditSeeded() {
    const alertCount = await this.prisma.opsSecurityAlert.count();
    const loginCount = await this.prisma.opsLoginHistory.count();
    if (alertCount > 0 && loginCount > 0) return;

    const createdAt = new Date();
    const users = await this.prisma.opsUser.findMany({
      where: { email: { in: ['ana@ayala.test', 'mys@pmcm.test', 'ops@xperto.test'] } },
      select: { id: true, name: true, email: true, role: true },
    });
    const userByEmail = new Map(users.map((user) => [user.email, user]));

    await this.prisma.$transaction(async (tx) => {
      if ((await tx.opsSecurityAlert.count()) === 0) {
        await tx.opsSecurityAlert.createMany({
          data: [
            {
              id: 'seca_seed_lockout',
              type: 'account_lockout',
              title: 'Account lockout threshold reached',
              description: 'A supplier account triggered the failed-login lockout threshold.',
              severity: 'warning',
              status: 'open',
              triggeredBy: 'ops@xperto.test',
              metadata: toPrismaJson({ failedAttempts: LOGIN_LOCKOUT_THRESHOLD }),
              createdAt: addDays(createdAt, -1),
            },
            {
              id: 'seca_seed_bulk_export',
              type: 'bulk_export',
              title: 'Bulk audit export reviewed',
              description: 'PMCM exported more audit records than the configured test threshold.',
              severity: 'warning',
              status: 'open',
              triggeredBy: 'PMCM Admin',
              metadata: toPrismaJson({ threshold: BULK_EXPORT_ALERT_THRESHOLD, recordCount: 42 }),
              createdAt: addDays(createdAt, -2),
            },
          ],
          skipDuplicates: true,
        });
      }

      if ((await tx.opsLoginHistory.count()) === 0) {
        const ana = userByEmail.get('ana@ayala.test');
        const mys = userByEmail.get('mys@pmcm.test');
        const supplier = userByEmail.get('ops@xperto.test');
        await tx.opsLoginHistory.createMany({
          data: [
            {
              id: 'login_seed_mys_success_1',
              userId: mys?.id ?? null,
              userName: mys?.name ?? 'Ms. Mys',
              userRole: mys?.role ?? 'pmcm-admin',
              email: 'mys@pmcm.test',
              status: 'success',
              ipAddress: '192.168.1.5',
              device: 'Local fixture browser',
              createdAt,
            },
            {
              id: 'login_seed_client_blocked',
              userId: ana?.id ?? null,
              userName: ana?.name ?? 'Ana Reyes',
              userRole: ana?.role ?? 'client',
              email: 'ana@ayala.test',
              status: 'blocked',
              failureReason: 'Account waiting for approval',
              ipAddress: '192.168.1.9',
              device: 'Local fixture browser',
              createdAt: addDays(createdAt, -1),
            },
            {
              id: 'login_seed_supplier_failed',
              userId: supplier?.id ?? null,
              userName: supplier?.name ?? 'XPERTO Registration',
              userRole: supplier?.role ?? 'supplier',
              email: 'ops@xperto.test',
              status: 'failed',
              failureReason: 'Invalid password',
              ipAddress: '192.168.1.12',
              device: 'Local fixture browser',
              createdAt: addDays(createdAt, -2),
            },
          ],
          skipDuplicates: true,
        });
      }
    });
  }

  private async ensureSupplierDirectorySeeded() {
    const categoryCount = await this.prisma.opsSupplierCategory.count();
    const supplierCount = await this.prisma.opsSupplier.count();
    if (categoryCount > 0 && supplierCount > 0) return;

    await this.prisma.$transaction(async (tx) => {
      if ((await tx.opsSupplierCategory.count()) === 0) {
        await tx.opsSupplierCategory.createMany({
          data: SUPPLIER_CATEGORIES.map((category) => ({
            ...category,
            createdAt: new Date(),
          })),
          skipDuplicates: true,
        });
      }

      if ((await tx.opsSupplier.count()) === 0) {
        const seedEvent = await tx.opsEvent.findUnique({
          where: { id: 'evt_sample_ayala' },
          select: { id: true },
        });
        const seedEventId = seedEvent?.id ?? null;

        await tx.opsSupplier.createMany({
          data: SEEDED_SUPPLIERS.map((supplier) => ({
            id: supplier.id,
            categoryId: supplier.categoryId,
            name: supplier.name,
            contactName: supplier.contactName,
            email: supplier.email,
            phone: supplier.phone,
            tier: supplier.tier,
            bniMember: supplier.bniMember,
            serviceInclusions: supplier.serviceInclusions,
            performanceNotes: supplier.performanceNotes,
            applicationDate: new Date('2026-03-01'),
            createdAt: new Date(),
          })),
          skipDuplicates: true,
        });

        await tx.opsSupplierCertification.createMany({
          data: SEEDED_SUPPLIERS.flatMap((supplier) =>
            supplier.certifications.map((fileName, index) => ({
              id: `cert_${supplier.id}_${index + 1}`,
              supplierId: supplier.id,
              fileName,
            })),
          ),
          skipDuplicates: true,
        });

        await tx.opsSupplierReview.createMany({
          data: [
            {
              id: 'review_xperto_ayala',
              supplierId: 'sup_xperto',
              eventId: seedEventId,
              rating: 5,
              notes: 'Registration desk was ready before client walkthrough and exported clean attendance data.',
              reviewedBy: 'Ms. Mys',
              createdAt: new Date('2026-06-19'),
            },
            {
              id: 'review_brightstage_ayala',
              supplierId: 'sup_brightstage',
              eventId: seedEventId,
              rating: 4,
              notes: 'Production ingress was smooth; final cable dressing needed one PMCM reminder.',
              reviewedBy: 'Ms. Mys',
              createdAt: new Date('2026-06-19'),
            },
            {
              id: 'review_lenscraft_ayala',
              supplierId: 'sup_lenscraft',
              eventId: seedEventId,
              rating: 5,
              notes: 'Delivered same-day preview set and organized file turnover.',
              reviewedBy: 'EA',
              createdAt: new Date('2026-06-20'),
            },
          ],
          skipDuplicates: true,
        });

        await tx.opsSupplierReliabilityNote.createMany({
          data: [
            {
              id: 'rel_xperto_ayala',
              supplierId: 'sup_xperto',
              eventId: seedEventId,
              note: 'Arrived 45 minutes before registration desk setup call time.',
              createdAt: new Date('2026-06-19'),
            },
            {
              id: 'rel_brightstage_ayala',
              supplierId: 'sup_brightstage',
              eventId: seedEventId,
              note: 'Needs final cable dressing check before client walkthrough.',
              createdAt: new Date('2026-06-19'),
            },
            {
              id: 'rel_newwave_pending',
              supplierId: 'sup_newwave',
              eventId: null,
              note: 'Approved supplier application; do not auto-suggest until first event review.',
              createdAt: new Date('2026-04-15'),
            },
          ],
          skipDuplicates: true,
        });
      }
    });
  }

  private async ensureInquiryOnboardingBackfilled() {
    const acceptedInquiries = await this.prisma.opsInquiry.findMany({
      where: {
        status: 'accepted',
        OR: [{ acceptedAt: null }, { conformeSentAt: null }],
      },
    });

    for (const inquiry of acceptedInquiries) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: seed backfill only touches accepted inquiries missing onboarding dates.
      const event = await this.prisma.opsEvent.findFirst({ where: { inquiryId: inquiry.id } });
      const signedConforme = event
        ? await this.prisma.opsDocument.findFirst({
            where: { eventId: event.id, type: 'signed_conforme' },
            orderBy: { uploadedAt: 'desc' },
          })
        : null;
      const signedAt = signedConforme?.uploadedAt ?? null;

      await this.prisma.opsInquiry.update({
        where: { id: inquiry.id },
        data: {
          acceptedAt: inquiry.acceptedAt ?? inquiry.createdAt,
          conformeSentAt: inquiry.conformeSentAt ?? inquiry.createdAt,
          ...(signedAt
            ? {
                conformeSignedAt: inquiry.conformeSignedAt ?? signedAt,
                portalActivatedAt: inquiry.portalActivatedAt ?? event?.createdAt ?? signedAt,
                portalInvitationStatus:
                  inquiry.portalInvitationStatus === 'not_sent'
                    ? 'opened'
                    : inquiry.portalInvitationStatus,
                portalInvitationSentAt: inquiry.portalInvitationSentAt ?? event?.createdAt ?? signedAt,
                portalInvitationOpenedAt: inquiry.portalInvitationOpenedAt ?? signedAt,
                portalInvitationExpiresAt:
                  inquiry.portalInvitationExpiresAt ?? addDays(event?.createdAt ?? signedAt, 7),
              }
            : {}),
        },
      });
    }
  }

  private async seedFixtureData(createdAt = new Date()) {
    await this.prisma.$transaction(async (tx) => {
      await tx.opsUser.createMany({
        data: [
          {
            id: 'usr_pmcm',
            name: 'Ms. Mys',
            email: 'mys@pmcm.test',
            password: AuthSecurityService.hashPassword('prism-admin'),
            role: 'pmcm-admin',
            organization: 'PMCM Events',
            approvalStatus: 'approved',
            createdAt,
          },
          {
            id: 'usr_client',
            name: 'Ana Reyes',
            email: 'ana@ayala.test',
            password: AuthSecurityService.hashPassword('prism-client'),
            role: 'client',
            organization: 'Ayala Corp',
            approvalStatus: 'approved',
            createdAt,
          },
          {
            id: 'usr_coord',
            name: 'Marco Santos',
            email: 'marco@pmcm.test',
            password: AuthSecurityService.hashPassword('prism-coordinator'),
            role: 'coordinator',
            organization: 'PMCM Events',
            approvalStatus: 'approved',
            createdAt,
          },
          {
            id: 'usr_supplier',
            name: 'XPERTO Registration',
            email: 'ops@xperto.test',
            password: AuthSecurityService.hashPassword('prism-supplier'),
            role: 'supplier',
            organization: 'XPERTO Registration',
            approvalStatus: 'approved',
            createdAt,
          },
          {
            id: 'usr_supplier_bloom',
            name: 'Bloom Florals',
            email: 'flowers@bloom.test',
            password: AuthSecurityService.hashPassword('prism-supplier'),
            role: 'supplier',
            organization: 'Bloom Florals',
            approvalStatus: 'approved',
            createdAt,
          },
        ],
      });

      await tx.opsInquiry.create({
        data: {
          id: 'inq_sample_ayala',
          clientName: 'Ana Reyes',
          companyName: 'Ayala Corp',
          email: 'ana@ayala.test',
          eventName: 'Ayala Tech Summit 2026',
          eventType: 'Corporate Summit',
          eventDate: new Date('2026-06-18'),
          clientType: 'Corporate',
          source: 'P.R.I.S.M Website',
          message: 'End-to-end planning, registration, staging, and post-event documentation.',
          status: 'accepted',
          acceptedAt: createdAt,
          conformeSentAt: createdAt,
          conformeSignedAt: createdAt,
          portalActivatedAt: createdAt,
          portalInvitationStatus: 'opened',
          portalInvitationSentAt: createdAt,
          portalInvitationOpenedAt: createdAt,
          portalInvitationExpiresAt: addDays(createdAt, 7),
          privacyConsentAccepted: true,
          privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
          marketingConsentAccepted: false,
          createdAt,
        },
      });

      await tx.opsInquiry.createMany({
        data: [
          {
            id: 'inq_sample_facebook_new',
            clientName: 'Mika Tan',
            companyName: 'Northstar Retail',
            email: 'mika@northstar.test',
            eventName: 'Northstar Dealer Night',
            eventType: 'Dealer Night',
            eventDate: new Date('2026-08-12'),
            clientType: 'Corporate',
            source: 'PMCM Facebook',
            message: 'Initial inquiry from Facebook Messenger for a dealer appreciation night.',
            status: 'new',
            createdAt: addDays(createdAt, -1),
          },
          {
            id: 'inq_sample_bni_pending',
            clientName: 'Leo Garcia',
            companyName: 'Harbor Finance',
            email: 'leo@harbor.test',
            eventName: 'Harbor Leadership Forum',
            eventType: 'Leadership Forum',
            eventDate: new Date('2026-09-04'),
            clientType: 'Corporate',
            source: 'BNI Referral',
            message: 'PMCM waiting for budget confirmation before accepting.',
            status: 'pending',
            pendingAt: addDays(createdAt, -2),
            createdAt: addDays(createdAt, -2),
          },
          {
            id: 'inq_sample_walkin_declined',
            clientName: 'Ria Santos',
            companyName: '',
            email: 'ria@example.test',
            eventName: 'Private Birthday Celebration',
            eventType: 'Private Celebration',
            eventDate: new Date('2026-05-18'),
            clientType: 'Social',
            source: 'Colleague or Friend',
            message: 'Requested date is not available for the PMCM team.',
            status: 'declined',
            declineReason: 'Date Unavailable',
            declinedAt: addDays(createdAt, -3),
            createdAt: addDays(createdAt, -3),
          },
        ],
      });

      await tx.opsApprovalRequest.create({
        data: {
          id: 'approval_usr_client',
          userId: 'usr_client',
          name: 'Ana Reyes',
          email: 'ana@ayala.test',
          role: 'client',
          organization: 'Ayala Corp',
          status: 'approved',
          requestedAt: createdAt,
        },
      });

      await tx.opsEvent.create({
        data: {
          id: 'evt_sample_ayala',
          inquiryId: 'inq_sample_ayala',
          clientName: 'Ana Reyes',
          eventName: 'Ayala Tech Summit 2026',
          eventDate: new Date('2026-06-18'),
          walkInPolicy: 'open',
          walkInThreshold: 200,
          status: 'planning',
          clientPortalStatus: 'unlocked',
          readiness: 'Floorplan approved',
          archived: false,
          floorPlanStatus: 'approved',
          floorPlanId: 'plan_sample_ayala_main',
          floorPlanSubmittedAt: createdAt,
          floorPlanReviewedAt: createdAt,
          createdAt,
          updatedAt: createdAt,
        },
      });

      const fixtureFloorPlanObjects = [
        {
          id: 'stage_sample',
          name: 'Main stage',
          kind: 'rect',
          category: 'stage',
          x: 2,
          y: 1,
          w: 10,
          h: 3,
          rotation: 0,
          fill: '#263d32',
          stroke: '#17251f',
          strokeWidth: 0.05,
          label: 'Main stage',
          locked: false,
          hidden: false,
        },
      ];
      const fixtureFloorPlanSnapshot = {
        id: 'plan_sample_ayala_main',
        name: 'Ayala Tech Summit ballroom layout',
        venue: '',
        width: 1200,
        height: 800,
        gridSize: 20,
        pax: 0,
        objects: fixtureFloorPlanObjects,
        guests: [],
        suppliers: [],
        seats: [],
        seatCategories: defaultSeatCategories(),
        updatedAt: createdAt.toISOString(),
      };

      await tx.floorPlan.create({
        data: {
          id: 'plan_sample_ayala_main',
          name: 'Ayala Tech Summit ballroom layout',
          ownerId: LOCAL_FIXTURE_OWNER_ID,
          eventId: 'evt_sample_ayala',
          width: 1200,
          height: 800,
          gridSize: 20,
          objects: toPrismaJson(fixtureFloorPlanObjects),
          seats: toPrismaJson([]),
          seatCategories: toPrismaJson(defaultSeatCategories()),
          updatedAt: createdAt,
        },
      });

      await tx.opsFloorPlanDraft.createMany({
        data: [
          {
            id: 'fpd_sample_approved',
            eventId: 'evt_sample_ayala',
            floorPlanId: 'plan_sample_ayala_main',
            name: 'Approved ballroom layout',
            status: 'approved',
            isActive: true,
            sourceType: 'template',
            createdByRole: 'pmcm-admin',
            submittedAt: createdAt,
            reviewedAt: createdAt,
            approvedAt: createdAt,
            submittedSnapshot: toPrismaJson(fixtureFloorPlanSnapshot),
            approvedSnapshot: toPrismaJson(fixtureFloorPlanSnapshot),
            submittedSnapshotAt: createdAt,
            approvedSnapshotAt: createdAt,
            createdAt,
            updatedAt: createdAt,
          },
        ],
      });

      await tx.opsDocument.create({
        data: {
          id: 'doc_sample_conforme',
          eventId: 'evt_sample_ayala',
          type: 'signed_conforme',
          fileName: 'ayala-signed-conforme.pdf',
          status: 'approved',
          mimeType: 'application/pdf',
          sizeBytes: 128000,
          uploadedByRole: 'client',
          uploadedAt: createdAt,
        },
      });

      await tx.opsBillingStatement.create({
        data: {
          id: 'bill_sample_ayala',
          eventId: 'evt_sample_ayala',
          number: 'BS-2026-0001',
          clientName: 'Ana Reyes',
          clientContact: 'ana@ayala.test',
          eventName: 'Ayala Summit',
          eventDate: new Date('2026-06-18'),
          lineItems: toPrismaJson([{ label: 'Approved event package', amount: 520000 }]),
          paymentSchedule: toPrismaJson([
            { label: 'Downpayment', percentage: 50, amount: 260000, dueDate: '2026-04-29' },
            { label: 'Balance', percentage: 50, amount: 260000, dueDate: '2026-06-11' },
          ]),
          paymentMethods: toPrismaJson([
            { label: 'Bank Transfer', details: 'PMCM corporate bank account' },
            { label: 'GCash', details: 'PMCM finance GCash number' },
            { label: 'Cheque', details: 'Payable to PMCM Events Management' },
          ]),
          totalAmount: 520000,
          documentId: 'doc_sample_billing',
          pdfUrl: '/api/documents/doc_sample_billing/signed-url',
          storageKey: 'events/evt_sample_ayala/billing/BS-2026-0001.pdf',
          status: 'issued',
          generatedAt: createdAt,
        },
      });

      await tx.opsDocument.create({
        data: {
          id: 'doc_sample_billing',
          eventId: 'evt_sample_ayala',
          type: 'billing_statement',
          fileName: 'BS-2026-0001.pdf',
          status: 'generated',
          mimeType: 'application/pdf',
          sizeBytes: 0,
          storageBucket: 'document-vault',
          storageKey: 'events/evt_sample_ayala/billing/BS-2026-0001.pdf',
          uploadedByRole: 'system',
          uploadedAt: createdAt,
        },
      });

      await tx.opsPaymentMilestone.createMany({
        data: [
          {
            id: 'pay_sample_reservation',
            eventId: 'evt_sample_ayala',
            label: 'Downpayment',
            percentage: 50,
            amount: 260000,
            amountPaid: 260000,
            remainingBalance: 0,
            dueDate: createdAt,
            status: 'paid',
            createdAt,
          },
          {
            id: 'pay_sample_final',
            eventId: 'evt_sample_ayala',
            label: 'Balance',
            percentage: 50,
            amount: 260000,
            amountPaid: 0,
            remainingBalance: 260000,
            dueDate: new Date('2026-06-11'),
            status: 'pending',
            createdAt,
          },
        ],
      });

      await tx.opsPaymentRecord.create({
        data: {
          id: 'payrec_sample_downpayment',
          eventId: 'evt_sample_ayala',
          milestoneId: 'pay_sample_reservation',
          amountReceived: 260000,
          paymentDate: createdAt,
          paymentMethod: 'Bank Transfer',
          referenceNumber: 'BPI-SAMPLE-001',
          recordedAt: createdAt,
        },
      });

      await tx.opsPostEventDocument.createMany({
        data: [
          { id: 'ped_completion', eventId: 'evt_sample_ayala', title: 'Completion report', status: 'pending' },
          { id: 'ped_gallery', eventId: 'evt_sample_ayala', title: 'Photo and video turnover', status: 'pending' },
        ],
      });

    });

    // The audit trail is a hash chain, so it has exactly one writer. Seeding a
    // row directly used to insert an unhashed, unlinked record that became a
    // second chain root and failed every later authenticated append closed.
    await this.auditService.audit(
      'evt_sample_ayala',
      'Local Fixture Seed',
      'Seeded local event workspace',
      { actorRole: OpsUserRole.System },
    );

  }
}
