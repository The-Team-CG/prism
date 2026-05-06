/**
 * PARE Test Seed — seeds suppliers, events, quotes, and reviews
 * for testing the P.R.I.S.M Agentic Response Engine (FR-AI-04).
 *
 * Run from apps/api:
 *   node --env-file=.env prisma/seed-pare.mjs
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { randomUUID } from 'crypto';

const { Pool } = pg;

// Prisma 7 requires a driver adapter (same pattern as PrismaService in the app).
const connectionString =
  process.env.SUPABASE_DB_URL ??
  process.env.DATABASE_URL ??
  process.env.PRISMA_DATABASE_URL ??
  process.env.DIRECT_URL;

if (!connectionString) {
  console.error('ERROR: Set SUPABASE_DB_URL or DATABASE_URL in apps/api/.env');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ─── IDs ──────────────────────────────────────────────────────────────────────

const CATEGORY_IDS = {
  catering:       randomUUID(),
  photography:    randomUUID(),
  videoProduction:randomUUID(),
  flowerDecor:    randomUUID(),
  soundLighting:  randomUUID(),
  hostEmcee:      randomUUID(),
  hairMakeup:     randomUUID(),
  transportation: randomUUID(),
};

const PMCM_ADMIN_ID = randomUUID();
const EVENT_IDS     = Array.from({ length: 5 }, () => randomUUID());
const INQUIRY_IDS   = Array.from({ length: 5 }, () => randomUUID());
const SUPPLIER_IDS  = Array.from({ length: 25 }, () => randomUUID());

function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

async function seedCategories() {
  const categories = [
    { id: CATEGORY_IDS.catering,        slug: 'catering',        name: 'Catering',        sortOrder: 1, acceptableMin: 40000,  acceptableMax: 120000 },
    { id: CATEGORY_IDS.photography,     slug: 'photography',     name: 'Photography',     sortOrder: 2, acceptableMin: 15000,  acceptableMax: 60000  },
    { id: CATEGORY_IDS.videoProduction, slug: 'video-production',name: 'Video Production',sortOrder: 3, acceptableMin: 12000,  acceptableMax: 55000  },
    { id: CATEGORY_IDS.flowerDecor,     slug: 'flower-decor',    name: 'Flower & Decor',  sortOrder: 4, acceptableMin: 20000,  acceptableMax: 80000  },
    { id: CATEGORY_IDS.soundLighting,   slug: 'sound-lighting',  name: 'Sound & Lighting',sortOrder: 5, acceptableMin: 18000,  acceptableMax: 70000  },
    { id: CATEGORY_IDS.hostEmcee,       slug: 'host-emcee',      name: 'Host / Emcee',    sortOrder: 6, acceptableMin: 8000,   acceptableMax: 25000  },
    { id: CATEGORY_IDS.hairMakeup,      slug: 'hair-makeup',     name: 'Hair & Makeup',   sortOrder: 7, acceptableMin: 6000,   acceptableMax: 20000  },
    { id: CATEGORY_IDS.transportation,  slug: 'transportation',  name: 'Transportation',  sortOrder: 8, acceptableMin: 5000,   acceptableMax: 18000  },
  ];
  for (const cat of categories) {
    await prisma.opsSupplierCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log('✓ Categories seeded');
}

// ─── PMCM ADMIN USER ─────────────────────────────────────────────────────────

async function seedUser() {
  await prisma.opsUser.upsert({
    where: { email: 'admin@pmcm.ph' },
    update: {},
    create: {
      id: PMCM_ADMIN_ID,
      name: 'Ms. Mys',
      email: 'admin@pmcm.ph',
      password: 'pmcm2024!',
      role: 'pmcm_admin',
      organization: 'PMCM Events',
      approvalStatus: 'approved',
    },
  });
  console.log('✓ PMCM Admin user seeded  →  admin@pmcm.ph / pmcm2024!');
}

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────

async function seedSuppliers() {
  const suppliers = [
    // ── CATERING (5) ────────────────────────────────────────────────────────
    {
      id: SUPPLIER_IDS[0],
      categoryId: CATEGORY_IDS.catering,
      name: 'Goldleaf Catering Co.',
      contactName: 'Marco Tan',
      email: 'marco@goldleafcatering.ph',
      phone: '09171234001',
      tier: 'tier_1',
      bniMember: true,
      serviceInclusions: 'Full-service buffet, Filipino and international cuisine, halal options, on-site chef',
      performanceNotes: 'Consistent Tier 1 partner since 2022. Zero complaints. Halal-certified. PRIMARY — mark Unavailable to trigger PARE.',
    },
    {
      id: SUPPLIER_IDS[1],
      categoryId: CATEGORY_IDS.catering,
      name: 'Kusina ni Lola Events',
      contactName: 'Liza Domingo',
      email: 'liza@kusinanilola.ph',
      phone: '09181234002',
      tier: 'tier_2',
      bniMember: false,
      serviceInclusions: 'Filipino comfort food, lechon station, merienda spreads, halal menu available',
      performanceNotes: 'Reliable Tier 2. 1 minor complaint resolved. Halal-certified. REPLACEMENT candidate for Reyes Wedding.',
    },
    {
      id: SUPPLIER_IDS[2],
      categoryId: CATEGORY_IDS.catering,
      name: 'Palate Prime Catering',
      contactName: 'Nathan Reyes',
      email: 'nathan@palateprime.ph',
      phone: '09191234003',
      tier: 'tier_2',
      bniMember: true,
      serviceInclusions: 'Plated dinners, cocktail spreads, dietary accommodations',
      performanceNotes: 'Good track record. No complaints. Worked with PMCM 3 times.',
    },
    {
      id: SUPPLIER_IDS[3],
      categoryId: CATEGORY_IDS.catering,
      name: 'Fiesta Feast Catering',
      contactName: 'Rosario Magtibay',
      email: 'rosario@fiestafeast.ph',
      phone: '09201234004',
      tier: 'tier_3',
      bniMember: false,
      serviceInclusions: 'Budget-friendly buffet, standard Filipino menu',
      performanceNotes: 'First event with PMCM. Pending reliability assessment.',
    },
    {
      id: SUPPLIER_IDS[4],
      categoryId: CATEGORY_IDS.catering,
      name: 'Sage & Salt Catering',
      contactName: 'Carlos Villanueva',
      email: 'carlos@sageandsalt.ph',
      phone: '09211234005',
      tier: 'tier_1',
      bniMember: true,
      serviceInclusions: 'Western and fusion cuisine, vegan options, dessert stations',
      performanceNotes: 'Premium Tier 1. Preferred for corporate and high-end events.',
    },
    // ── PHOTOGRAPHY (4) ─────────────────────────────────────────────────────
    {
      id: SUPPLIER_IDS[5],
      categoryId: CATEGORY_IDS.photography,
      name: 'Studio Lumin PH',
      contactName: 'Diane Ocampo',
      email: 'diane@studiolumin.ph',
      phone: '09221234006',
      tier: 'tier_1',
      bniMember: true,
      serviceInclusions: 'Full-day coverage, 2 shooters, same-day slideshow, online gallery',
      performanceNotes: 'Top-rated photographer. Consistent 5-star reviews.',
    },
    {
      id: SUPPLIER_IDS[6],
      categoryId: CATEGORY_IDS.photography,
      name: 'Bright Frames Photography',
      contactName: 'Paolo Cruz',
      email: 'paolo@brightframes.ph',
      phone: '09231234007',
      tier: 'tier_2',
      bniMember: false,
      serviceInclusions: 'Coverage up to 10 hours, 1 shooter, edited photos in 2 weeks',
      performanceNotes: 'Reliable. 1 late delivery incident, resolved.',
    },
    {
      id: SUPPLIER_IDS[7],
      categoryId: CATEGORY_IDS.photography,
      name: 'Captured Moments PH',
      contactName: 'Angela Santos',
      email: 'angela@capturedmoments.ph',
      phone: '09241234008',
      tier: 'tier_2',
      bniMember: true,
      serviceInclusions: 'Wedding and event photography, prenup sessions available',
      performanceNotes: 'Good portfolio. 2 successful PMCM events.',
    },
    {
      id: SUPPLIER_IDS[8],
      categoryId: CATEGORY_IDS.photography,
      name: 'Golden Hour Shoots',
      contactName: 'Mark Bautista',
      email: 'mark@goldenhour.ph',
      phone: '09251234009',
      tier: 'tier_3',
      bniMember: false,
      serviceInclusions: 'Standard coverage, 1 shooter',
      performanceNotes: 'New to PMCM. First booking pending.',
    },
    // ── VIDEO PRODUCTION (3) ─────────────────────────────────────────────────
    {
      id: SUPPLIER_IDS[9],
      categoryId: CATEGORY_IDS.videoProduction,
      name: 'Reel Stories PH',
      contactName: 'Jerome Gutierrez',
      email: 'jerome@reelstories.ph',
      phone: '09261234010',
      tier: 'tier_1',
      bniMember: true,
      serviceInclusions: 'Cinematic SDE, full event film, drone footage, color grade',
      performanceNotes: 'Award-winning videography team. Zero complaints.',
    },
    {
      id: SUPPLIER_IDS[10],
      categoryId: CATEGORY_IDS.videoProduction,
      name: 'Frame & Flow Films',
      contactName: 'Sheena Chua',
      email: 'sheena@frameandflow.ph',
      phone: '09271234011',
      tier: 'tier_2',
      bniMember: false,
      serviceInclusions: 'Event highlights, same-day edit, 2 videographers',
      performanceNotes: '3 PMCM events. One SDE delay, rectified.',
    },
    {
      id: SUPPLIER_IDS[11],
      categoryId: CATEGORY_IDS.videoProduction,
      name: 'Motion & Memories',
      contactName: 'Victor Lim',
      email: 'victor@motionmemories.ph',
      phone: '09281234012',
      tier: 'tier_2',
      bniMember: false,
      serviceInclusions: 'Event film, teaser video, 1 videographer',
      performanceNotes: 'Decent quality. Needs closer coordination on timelines.',
    },
    // ── FLOWER & DECOR (3) ──────────────────────────────────────────────────
    {
      id: SUPPLIER_IDS[12],
      categoryId: CATEGORY_IDS.flowerDecor,
      name: 'Bloom & Petal Events',
      contactName: 'Patricia Flores',
      email: 'patricia@bloomandpetal.ph',
      phone: '09291234013',
      tier: 'tier_1',
      bniMember: true,
      serviceInclusions: 'Full venue styling, floral arrangements, centerpieces, arch design',
      performanceNotes: 'Premium decorator. Preferred for luxury events.',
    },
    {
      id: SUPPLIER_IDS[13],
      categoryId: CATEGORY_IDS.flowerDecor,
      name: 'Garden & Grace Decor',
      contactName: 'Irene Pasqual',
      email: 'irene@gardenandgrace.ph',
      phone: '09301234014',
      tier: 'tier_2',
      bniMember: false,
      serviceInclusions: 'Table centerpieces, entrance decor, photo backdrop',
      performanceNotes: 'Reliable Tier 2. 4 events with PMCM. Clean track record.',
    },
    {
      id: SUPPLIER_IDS[14],
      categoryId: CATEGORY_IDS.flowerDecor,
      name: 'Petal & Twine Studio',
      contactName: 'Mona Reyes',
      email: 'mona@petalandtwine.ph',
      phone: '09311234015',
      tier: 'tier_2',
      bniMember: true,
      serviceInclusions: 'Rustic and garden themed styling, DIY florals',
      performanceNotes: 'Good for themed events. 2 PMCM bookings.',
    },
    // ── SOUND & LIGHTING (3) ────────────────────────────────────────────────
    {
      id: SUPPLIER_IDS[15],
      categoryId: CATEGORY_IDS.soundLighting,
      name: 'Resonance AV Solutions',
      contactName: 'Bobby Tan',
      email: 'bobby@resonanceav.ph',
      phone: '09321234016',
      tier: 'tier_1',
      bniMember: true,
      serviceInclusions: 'Full PA system, stage lighting, LED walls, technician on-site',
      performanceNotes: 'Preferred AV partner. Handles large-scale events.',
    },
    {
      id: SUPPLIER_IDS[16],
      categoryId: CATEGORY_IDS.soundLighting,
      name: 'Lumina Events AV',
      contactName: 'Chester Uy',
      email: 'chester@luminaav.ph',
      phone: '09331234017',
      tier: 'tier_2',
      bniMember: false,
      serviceInclusions: 'Sound system, mood lighting, basic LED setup',
      performanceNotes: '2 successful PMCM events. No issues.',
    },
    {
      id: SUPPLIER_IDS[17],
      categoryId: CATEGORY_IDS.soundLighting,
      name: 'Pulse Pro Audio',
      contactName: 'Roland Garcia',
      email: 'roland@pulsepro.ph',
      phone: '09341234018',
      tier: 'tier_2',
      bniMember: false,
      serviceInclusions: 'Mid-range PA, DJ booth optional, gobo lights',
      performanceNotes: 'First PMCM event. Vetted by BNI referral.',
    },
    // ── HOST / EMCEE (3) ────────────────────────────────────────────────────
    {
      id: SUPPLIER_IDS[18],
      categoryId: CATEGORY_IDS.hostEmcee,
      name: 'Joana Mercado Events Host',
      contactName: 'Joana Mercado',
      email: 'joana@joanamercado.ph',
      phone: '09351234019',
      tier: 'tier_1',
      bniMember: true,
      serviceInclusions: 'Bilingual hosting (English/Filipino), script preparation, rehearsal',
      performanceNotes: 'Top-ranked emcee. 10+ PMCM events. Zero issues.',
    },
    {
      id: SUPPLIER_IDS[19],
      categoryId: CATEGORY_IDS.hostEmcee,
      name: 'RJ Events Hosting',
      contactName: 'RJ Pascual',
      email: 'rj@rjevents.ph',
      phone: '09361234020',
      tier: 'tier_2',
      bniMember: false,
      serviceInclusions: 'English hosting, basic script coordination',
      performanceNotes: '3 PMCM events. Positive client feedback.',
    },
    {
      id: SUPPLIER_IDS[20],
      categoryId: CATEGORY_IDS.hostEmcee,
      name: 'Mikael Sy Hosting Services',
      contactName: 'Mikael Sy',
      email: 'mikael@mikaelsy.ph',
      phone: '09371234021',
      tier: 'tier_2',
      bniMember: false,
      serviceInclusions: 'Trilingual hosting, comedian MC option',
      performanceNotes: 'New partner. Vetted via referral.',
    },
    // ── HAIR & MAKEUP (2) ───────────────────────────────────────────────────
    {
      id: SUPPLIER_IDS[21],
      categoryId: CATEGORY_IDS.hairMakeup,
      name: 'Glow Studio by Carla',
      contactName: 'Carla Mendoza',
      email: 'carla@glowstudio.ph',
      phone: '09381234022',
      tier: 'tier_1',
      bniMember: true,
      serviceInclusions: 'Bridal HMUA, touch-up kit, airbrush makeup, hair styling',
      performanceNotes: 'Premium HMUA. Works well under pressure. No complaints.',
    },
    {
      id: SUPPLIER_IDS[22],
      categoryId: CATEGORY_IDS.hairMakeup,
      name: 'Bloom Beauty Team',
      contactName: 'Trina Aquino',
      email: 'trina@bloombeauty.ph',
      phone: '09391234023',
      tier: 'tier_2',
      bniMember: false,
      serviceInclusions: 'Makeup and hair for bride and entourage',
      performanceNotes: '2 PMCM events. Consistent quality.',
    },
    // ── TRANSPORTATION (2) ──────────────────────────────────────────────────
    {
      id: SUPPLIER_IDS[23],
      categoryId: CATEGORY_IDS.transportation,
      name: 'Premier Wheels Events',
      contactName: 'Arnel Dela Cruz',
      email: 'arnel@premierwheels.ph',
      phone: '09401234024',
      tier: 'tier_1',
      bniMember: true,
      serviceInclusions: 'Bridal car, shuttle fleet, coordination with venue',
      performanceNotes: 'Tier 1 transport partner. Always on-time. 8 PMCM events.',
    },
    {
      id: SUPPLIER_IDS[24],
      categoryId: CATEGORY_IDS.transportation,
      name: 'Go Event Transport',
      contactName: 'Dennis Uy',
      email: 'dennis@goeventtransport.ph',
      phone: '09411234025',
      tier: 'tier_2',
      bniMember: false,
      serviceInclusions: 'Van and bus rentals, airport transfers',
      performanceNotes: '1 PMCM event. On-time. No complaints.',
    },
  ];

  for (const s of suppliers) {
    await prisma.opsSupplier.upsert({
      where: { id: s.id },
      update: {},
      create: s,
    });
  }
  console.log(`✓ ${suppliers.length} suppliers seeded`);
}

// ─── REVIEWS ─────────────────────────────────────────────────────────────────

async function seedReviews() {
  const reviews = [
    { supplierId: SUPPLIER_IDS[0],  rating: 5, notes: 'Flawless service, arrived 2 hours early for setup.' },
    { supplierId: SUPPLIER_IDS[0],  rating: 5, notes: 'Food quality excellent. All 200 pax served on time.' },
    { supplierId: SUPPLIER_IDS[0],  rating: 4, notes: 'Minor delay on dessert station but handled gracefully.' },
    { supplierId: SUPPLIER_IDS[1],  rating: 4, notes: 'Good food, setup was clean, client happy.' },
    { supplierId: SUPPLIER_IDS[1],  rating: 4, notes: 'Halal menu well-executed. No complaints from guests.' },
    { supplierId: SUPPLIER_IDS[1],  rating: 3, notes: 'One menu item substituted without prior notice.' },
    { supplierId: SUPPLIER_IDS[2],  rating: 5, notes: 'Excellent plating and service.' },
    { supplierId: SUPPLIER_IDS[2],  rating: 4, notes: 'Corporate client very satisfied.' },
    { supplierId: SUPPLIER_IDS[5],  rating: 5, notes: 'Best photos we have seen. On time, professional.' },
    { supplierId: SUPPLIER_IDS[5],  rating: 5, notes: 'Couple loved the gallery delivery.' },
    { supplierId: SUPPLIER_IDS[9],  rating: 5, notes: 'Cinematic output. Client cried watching SDE.' },
    { supplierId: SUPPLIER_IDS[12], rating: 5, notes: 'Venue looked breathtaking. Setup finished 1 hour early.' },
    { supplierId: SUPPLIER_IDS[12], rating: 5, notes: 'Arch design exceeded client expectations.' },
    { supplierId: SUPPLIER_IDS[15], rating: 5, notes: 'Perfect audio, zero feedback issues.' },
    { supplierId: SUPPLIER_IDS[18], rating: 5, notes: 'Crowd loved her energy. Flawless transitions.' },
    { supplierId: SUPPLIER_IDS[18], rating: 5, notes: 'Clients specifically requested her for next event.' },
    { supplierId: SUPPLIER_IDS[23], rating: 5, notes: 'All vehicles arrived 30 min early. Spotless.' },
  ];
  for (const r of reviews) {
    await prisma.opsSupplierReview.create({
      data: { id: randomUUID(), supplierId: r.supplierId, rating: r.rating, notes: r.notes, reviewedBy: 'PMCM Admin' },
    });
  }
  console.log(`✓ ${reviews.length} supplier reviews seeded`);
}

// ─── RELIABILITY NOTES ────────────────────────────────────────────────────────

async function seedReliabilityNotes() {
  const notes = [
    { supplierId: SUPPLIER_IDS[0],  note: 'Consistently early for setup. Excellent communication.' },
    { supplierId: SUPPLIER_IDS[0],  note: 'Client specifically requested them for next event.' },
    { supplierId: SUPPLIER_IDS[1],  note: 'Substituted one menu item without notice — resolved with apology.' },
    { supplierId: SUPPLIER_IDS[1],  note: 'Halal certification verified and up to date.' },
    { supplierId: SUPPLIER_IDS[5],  note: 'Delivered gallery 2 days ahead of SLA.' },
    { supplierId: SUPPLIER_IDS[9],  note: 'SDE played at reception — couple was emotional. Excellent execution.' },
    { supplierId: SUPPLIER_IDS[18], note: 'Crowd management skills exceptional. Handled technical delay gracefully.' },
  ];
  for (const n of notes) {
    await prisma.opsSupplierReliabilityNote.create({
      data: { id: randomUUID(), supplierId: n.supplierId, note: n.note },
    });
  }
  console.log('✓ Reliability notes seeded');
}

// ─── INQUIRIES ────────────────────────────────────────────────────────────────

const INQUIRY_DATA = [
  { clientName: 'Reyes Family',       eventName: 'Reyes Grand Wedding',    eventDate: futureDate(45), clientType: 'returning', email: 'reyes@example.com' },
  { clientName: 'Santos Family',      eventName: 'Santos 18th Debut',      eventDate: futureDate(60), clientType: 'new',       email: 'santos@example.com' },
  { clientName: 'Cruz Corporation',   eventName: 'Cruz Corp Annual Gala',  eventDate: futureDate(30), clientType: 'corporate', email: 'events@cruzcorp.com' },
  { clientName: 'Lim Family',         eventName: 'Lim Silver Anniversary', eventDate: futureDate(90), clientType: 'returning', email: 'lim@example.com' },
  { clientName: 'Garcia Family',      eventName: 'Garcia Baby Christening',eventDate: futureDate(21), clientType: 'new',       email: 'garcia@example.com' },
];

async function seedInquiries() {
  for (let i = 0; i < INQUIRY_DATA.length; i++) {
    const d = INQUIRY_DATA[i];
    await prisma.opsInquiry.upsert({
      where: { id: INQUIRY_IDS[i] },
      update: {},
      create: {
        id: INQUIRY_IDS[i],
        clientName: d.clientName,
        email: d.email,
        eventName: d.eventName,
        eventDate: d.eventDate,
        clientType: d.clientType,
        status: 'accepted',
        conformeSentAt: new Date(),
        conformeSignedAt: new Date(),
        acceptedAt: new Date(),
        privacyConsentAccepted: true,
        privacyNoticeVersion: '1.0',
      },
    });
  }
  console.log('✓ Inquiries seeded');
}

// ─── EVENTS ──────────────────────────────────────────────────────────────────

async function seedEvents() {
  const events = [
    { i: 0, clientName: 'Reyes Family',      status: 'planning', readiness: 'Suppliers being confirmed' },
    { i: 1, clientName: 'Santos Family',     status: 'planning', readiness: 'Planning in progress' },
    { i: 2, clientName: 'Cruz Corporation',  status: 'planning', readiness: 'Suppliers being confirmed' },
    { i: 3, clientName: 'Lim Family',        status: 'planning', readiness: 'Planning in progress' },
    { i: 4, clientName: 'Garcia Family',     status: 'planning', readiness: 'Suppliers being confirmed' },
  ];
  for (const e of events) {
    await prisma.opsEvent.upsert({
      where: { id: EVENT_IDS[e.i] },
      update: {},
      create: {
        id: EVENT_IDS[e.i],
        inquiryId: INQUIRY_IDS[e.i],
        clientName: e.clientName,
        eventName: INQUIRY_DATA[e.i].eventName,
        eventDate: INQUIRY_DATA[e.i].eventDate,
        status: e.status,
        readiness: e.readiness,
        clientPortalStatus: 'active',
      },
    });
  }
  console.log('✓ Events seeded');
}

// ─── QUOTE REQUESTS + QUOTES ─────────────────────────────────────────────────

async function seedQuotes() {
  const now = new Date();

  async function makeAssignment(eventId, supplierId, catId, supplierName, category, message, amount, inclusions, status = 'selected') {
    const reqId = randomUUID();
    await prisma.opsSupplierQuoteRequest.create({
      data: {
        id: reqId,
        eventId,
        supplierId,
        categoryId: catId,
        supplierName,
        category,
        message,
        dueDate: futureDate(14),
        accessToken: randomUUID(),
        status: 'open',
        assignmentStatus: status === 'selected' ? 'confirmed' : 'pending_confirmation',
        assignmentConfirmedAt: status === 'selected' ? now : null,
        readinessStatus: status === 'selected' ? 'confirmed' : 'not_requested',
      },
    });
    await prisma.opsSupplierQuote.create({
      data: {
        id: randomUUID(),
        eventId,
        requestId: reqId,
        supplierId,
        categoryId: catId,
        supplierName,
        category,
        amount,
        inclusions,
        paymentTerms: '50% upon booking, 50% on event day',
        status,
        selectedAt: status === 'selected' ? now : null,
      },
    });
  }

  // ── REYES GRAND WEDDING (EVENT_IDS[0]) ──────────────────────────────────
  // Goldleaf = primary (ASSIGNED, will be marked Unavailable to trigger PARE)
  await makeAssignment(EVENT_IDS[0], SUPPLIER_IDS[0], CATEGORY_IDS.catering,
    'Goldleaf Catering Co.', 'Catering',
    'Full buffet for 200 pax. Halal menu required. Dessert station included.',
    72000, ['Buffet setup', 'On-site chef', 'Halal menu', 'Dessert station', 'Waitstaff x6']);

  // Kusina ni Lola = backup (quote submitted, available — PARE Agent 2 finds this)
  await makeAssignment(EVENT_IDS[0], SUPPLIER_IDS[1], CATEGORY_IDS.catering,
    'Kusina ni Lola Events', 'Catering',
    'Backup quote. Full buffet for 200 pax. Halal required.',
    65000, ['Buffet setup', 'Halal menu', 'Lechon station', 'Dessert spread', 'Waitstaff x5'], 'submitted');

  await makeAssignment(EVENT_IDS[0], SUPPLIER_IDS[5], CATEGORY_IDS.photography,
    'Studio Lumin PH', 'Photography',
    'Full day coverage, 2 shooters, same-day slideshow.',
    38000, ['Full-day coverage', '2 photographers', 'Same-day slideshow', 'Online gallery']);

  await makeAssignment(EVENT_IDS[0], SUPPLIER_IDS[12], CATEGORY_IDS.flowerDecor,
    'Bloom & Petal Events', 'Flower & Decor',
    'Full venue styling. White and gold theme.',
    55000, ['Full venue styling', 'Floral arch', 'Centerpieces x20', 'Entrance decor']);

  await makeAssignment(EVENT_IDS[0], SUPPLIER_IDS[15], CATEGORY_IDS.soundLighting,
    'Resonance AV Solutions', 'Sound & Lighting',
    'Full PA and stage lighting. Reception hall capacity 200.',
    32000, ['Full PA system', 'Stage lighting', 'LED uplights', 'Wireless mics x4']);

  await makeAssignment(EVENT_IDS[0], SUPPLIER_IDS[18], CATEGORY_IDS.hostEmcee,
    'Joana Mercado Events Host', 'Host / Emcee',
    'Bilingual hosting for 6-hour reception.',
    18000, ['Bilingual hosting', 'Script prep', 'Rehearsal session']);

  // ── SANTOS DEBUT (EVENT_IDS[1]) ─────────────────────────────────────────
  await makeAssignment(EVENT_IDS[1], SUPPLIER_IDS[2], CATEGORY_IDS.catering,
    'Palate Prime Catering', 'Catering', 'Buffet for 120 pax.', 42000, ['Buffet setup', 'Waitstaff x4']);
  await makeAssignment(EVENT_IDS[1], SUPPLIER_IDS[6], CATEGORY_IDS.photography,
    'Bright Frames Photography', 'Photography', '10 hours coverage.', 22000, ['Full-day coverage', '1 photographer']);
  await makeAssignment(EVENT_IDS[1], SUPPLIER_IDS[13], CATEGORY_IDS.flowerDecor,
    'Garden & Grace Decor', 'Flower & Decor', 'Pastel theme decor.', 28000, ['Centerpieces x15', 'Entrance decor']);
  await makeAssignment(EVENT_IDS[1], SUPPLIER_IDS[19], CATEGORY_IDS.hostEmcee,
    'RJ Events Hosting', 'Host / Emcee', 'English hosting.', 12000, ['English hosting', 'Script coordination']);

  // ── CRUZ CORPORATE GALA (EVENT_IDS[2]) ─────────────────────────────────
  await makeAssignment(EVENT_IDS[2], SUPPLIER_IDS[4], CATEGORY_IDS.catering,
    'Sage & Salt Catering', 'Catering', 'Western plated dinner for 300 pax.', 110000, ['Plated dinner x300', 'Waitstaff x10', 'Vegan options']);
  await makeAssignment(EVENT_IDS[2], SUPPLIER_IDS[9], CATEGORY_IDS.videoProduction,
    'Reel Stories PH', 'Video Production', 'Corporate event film + highlights.', 45000, ['Event film', 'Highlights reel', 'Drone footage']);
  await makeAssignment(EVENT_IDS[2], SUPPLIER_IDS[15], CATEGORY_IDS.soundLighting,
    'Resonance AV Solutions', 'Sound & Lighting', 'Full stage AV for 300 pax ballroom.', 55000, ['Full PA system', 'LED wall', 'Stage lighting', 'AV tech x3']);
  await makeAssignment(EVENT_IDS[2], SUPPLIER_IDS[18], CATEGORY_IDS.hostEmcee,
    'Joana Mercado Events Host', 'Host / Emcee', 'Corporate emcee, English only.', 20000, ['Corporate hosting', 'Script prep']);

  // ── LIM ANNIVERSARY (EVENT_IDS[3]) ─────────────────────────────────────
  await makeAssignment(EVENT_IDS[3], SUPPLIER_IDS[1], CATEGORY_IDS.catering,
    'Kusina ni Lola Events', 'Catering', 'Filipino buffet for 80 pax.', 48000, ['Buffet setup', 'Lechon station', 'Waitstaff x4']);
  await makeAssignment(EVENT_IDS[3], SUPPLIER_IDS[7], CATEGORY_IDS.photography,
    'Captured Moments PH', 'Photography', 'Full day coverage.', 25000, ['Full-day coverage', '1 photographer', 'Edited photos']);
  await makeAssignment(EVENT_IDS[3], SUPPLIER_IDS[14], CATEGORY_IDS.flowerDecor,
    'Petal & Twine Studio', 'Flower & Decor', 'Rustic garden theme.', 22000, ['Rustic centerpieces x10', 'Entrance decor']);

  // ── GARCIA CHRISTENING (EVENT_IDS[4]) ───────────────────────────────────
  await makeAssignment(EVENT_IDS[4], SUPPLIER_IDS[3], CATEGORY_IDS.catering,
    'Fiesta Feast Catering', 'Catering', 'Budget buffet for 60 pax.', 28000, ['Buffet setup', 'Standard Filipino menu']);
  await makeAssignment(EVENT_IDS[4], SUPPLIER_IDS[8], CATEGORY_IDS.photography,
    'Golden Hour Shoots', 'Photography', '4 hours coverage.', 15000, ['4-hour coverage', '1 photographer']);

  console.log('✓ Quote requests and quotes seeded');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 PARE Seed — starting...\n');
  await seedCategories();
  await seedUser();
  await seedSuppliers();
  await seedReviews();
  await seedReliabilityNotes();
  await seedInquiries();
  await seedEvents();
  await seedQuotes();

  console.log(`
✅ PARE seed complete!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PMCM Admin login:  admin@pmcm.ph / pmcm2024!
  Portal:            http://localhost:3004
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  5 events seeded:
    • Reyes Grand Wedding       (45 days)  ← PARE demo event
    • Santos 18th Debut         (60 days)
    • Cruz Corp Annual Gala     (30 days)
    • Lim Silver Anniversary    (90 days)
    • Garcia Baby Christening   (21 days)

  25 suppliers seeded across 8 categories.

  TO TRIGGER PARE:
    1. Open Reyes Grand Wedding in apps/event
    2. Find Goldleaf Catering Co. (Tier 1, assigned, ₱72,000)
    3. Mark them as Unavailable or Withdrawn
    4. PARE activates → finds Kusina ni Lola (₱65,000, halal, available)
    5. Recommendation package appears for PMCM Admin approval
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
