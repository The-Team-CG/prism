/**
 * PARE Test Seed — seeds suppliers, events, quotes, and reviews
 * for testing the P.R.I.S.M Agentic Response Engine (FR-AI-04).
 *
 * Run: cd apps/api && npx ts-node prisma/seed-pare.ts
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// ─── IDs ──────────────────────────────────────────────────────────────────────

const CATEGORY_IDS = {
  catering: randomUUID(),
  photography: randomUUID(),
  videoProduction: randomUUID(),
  flowerDecor: randomUUID(),
  soundLighting: randomUUID(),
  hostEmcee: randomUUID(),
  hairMakeup: randomUUID(),
  transportation: randomUUID(),
};

const PMCM_ADMIN_ID = randomUUID();
const COORDINATOR_ID = randomUUID();

// 5 events — mix of planning and active
const EVENT_IDS = [
  randomUUID(), // Reyes Wedding       ← PRIMARY test event (supplier goes unavailable)
  randomUUID(), // Santos Debut
  randomUUID(), // Cruz Corporate Gala
  randomUUID(), // Lim Anniversary
  randomUUID(), // Garcia Christening
];

const INQUIRY_IDS = EVENT_IDS.map(() => randomUUID());

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function futureDate(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

async function seedCategories() {
  const categories = [
    { id: CATEGORY_IDS.catering,       slug: 'catering',        name: 'Catering',           sortOrder: 1, acceptableMin: 40000,  acceptableMax: 120000 },
    { id: CATEGORY_IDS.photography,    slug: 'photography',     name: 'Photography',         sortOrder: 2, acceptableMin: 15000,  acceptableMax: 60000  },
    { id: CATEGORY_IDS.videoProduction,slug: 'video-production',name: 'Video Production',    sortOrder: 3, acceptableMin: 12000,  acceptableMax: 55000  },
    { id: CATEGORY_IDS.flowerDecor,    slug: 'flower-decor',    name: 'Flower & Decor',      sortOrder: 4, acceptableMin: 20000,  acceptableMax: 80000  },
    { id: CATEGORY_IDS.soundLighting,  slug: 'sound-lighting',  name: 'Sound & Lighting',    sortOrder: 5, acceptableMin: 18000,  acceptableMax: 70000  },
    { id: CATEGORY_IDS.hostEmcee,      slug: 'host-emcee',      name: 'Host / Emcee',        sortOrder: 6, acceptableMin: 8000,   acceptableMax: 25000  },
    { id: CATEGORY_IDS.hairMakeup,     slug: 'hair-makeup',     name: 'Hair & Makeup',       sortOrder: 7, acceptableMin: 6000,   acceptableMax: 20000  },
    { id: CATEGORY_IDS.transportation, slug: 'transportation',  name: 'Transportation',      sortOrder: 8, acceptableMin: 5000,   acceptableMax: 18000  },
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

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────
// 25 suppliers across 8 categories. Supplier[0] (Tier 1 Catering) is the one
// that will go "unavailable" to trigger PARE in the sample.

const SUPPLIER_IDS = Array.from({ length: 25 }, () => randomUUID());

async function seedSuppliers() {
  const suppliers = [
    // ── CATERING (5 suppliers) ──────────────────────────────────────────────
    {
      id: SUPPLIER_IDS[0],
      categoryId: CATEGORY_IDS.catering,
      name: 'Goldleaf Catering Co.',         // Tier 1 — PRIMARY (will go unavailable)
      contactName: 'Marco Tan',
      email: 'marco@goldleafcatering.ph',
      phone: '09171234001',
      tier: 'tier_1',
      bniMember: true,
      serviceInclusions: 'Full-service buffet, Filipino and international cuisine, halal options, on-site chef',
      performanceNotes: 'Consistent Tier 1 partner since 2022. Zero complaints. Halal-certified.',
    },
    {
      id: SUPPLIER_IDS[1],
      categoryId: CATEGORY_IDS.catering,
      name: 'Kusina ni Lola Events',          // Tier 2 — REPLACEMENT candidate
      contactName: 'Liza Domingo',
      email: 'liza@kusinanilola.ph',
      phone: '09181234002',
      tier: 'tier_2',
      bniMember: false,
      serviceInclusions: 'Filipino comfort food, lechon station, merienda spreads, halal menu available',
      performanceNotes: 'Reliable Tier 2. 1 minor complaint resolved. Halal-certified.',
    },
    {
      id: SUPPLIER_IDS[2],
      categoryId: CATEGORY_IDS.catering,
      name: 'Palate Prime Catering',          // Tier 2
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
      name: 'Fiesta Feast Catering',          // Tier 3
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
      name: 'Sage & Salt Catering',           // Tier 1
      contactName: 'Carlos Villanueva',
      email: 'carlos@sageandsalt.ph',
      phone: '09211234005',
      tier: 'tier_1',
      bniMember: true,
      serviceInclusions: 'Western and fusion cuisine, vegan options, dessert stations',
      performanceNotes: 'Premium Tier 1. Preferred for corporate and high-end events.',
    },

    // ── PHOTOGRAPHY (4 suppliers) ───────────────────────────────────────────
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

    // ── VIDEO PRODUCTION (3 suppliers) ─────────────────────────────────────
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

    // ── FLOWER & DECOR (3 suppliers) ────────────────────────────────────────
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

    // ── SOUND & LIGHTING (3 suppliers) ─────────────────────────────────────
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

    // ── HOST / EMCEE (3 suppliers) ──────────────────────────────────────────
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

    // ── HAIR & MAKEUP (2 suppliers) ─────────────────────────────────────────
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

    // ── TRANSPORTATION (2 suppliers) ────────────────────────────────────────
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
      create: {
        id: s.id,
        categoryId: s.categoryId,
        name: s.name,
        contactName: s.contactName,
        email: s.email,
        phone: s.phone,
        tier: s.tier,
        bniMember: s.bniMember,
        serviceInclusions: s.serviceInclusions,
        performanceNotes: s.performanceNotes,
      },
    });
  }
  console.log(`✓ ${suppliers.length} suppliers seeded`);
}

// ─── SUPPLIER REVIEWS (reliability data) ─────────────────────────────────────

async function seedReviews() {
  const reviews = [
    // Goldleaf (SUPPLIER_IDS[0]) — high reliability
    { supplierId: SUPPLIER_IDS[0], rating: 5, notes: 'Flawless service, arrived 2 hours early for setup', reviewedBy: 'PMCM Admin' },
    { supplierId: SUPPLIER_IDS[0], rating: 5, notes: 'Food quality excellent. All 200 pax served on time.', reviewedBy: 'PMCM Admin' },
    { supplierId: SUPPLIER_IDS[0], rating: 4, notes: 'Minor delay on dessert station but handled gracefully.', reviewedBy: 'PMCM Admin' },
    // Kusina ni Lola (SUPPLIER_IDS[1]) — solid Tier 2
    { supplierId: SUPPLIER_IDS[1], rating: 4, notes: 'Good food, setup was clean, client happy.', reviewedBy: 'PMCM Admin' },
    { supplierId: SUPPLIER_IDS[1], rating: 4, notes: 'Halal menu well-executed. No complaints from guests.', reviewedBy: 'PMCM Admin' },
    { supplierId: SUPPLIER_IDS[1], rating: 3, notes: 'One menu item substituted without prior notice.', reviewedBy: 'PMCM Admin' },
    // Palate Prime (SUPPLIER_IDS[2])
    { supplierId: SUPPLIER_IDS[2], rating: 5, notes: 'Excellent plating and service.', reviewedBy: 'PMCM Admin' },
    { supplierId: SUPPLIER_IDS[2], rating: 4, notes: 'Corporate client very satisfied.', reviewedBy: 'PMCM Admin' },
    // Studio Lumin (SUPPLIER_IDS[5])
    { supplierId: SUPPLIER_IDS[5], rating: 5, notes: 'Best photos we have seen. On time, professional.', reviewedBy: 'PMCM Admin' },
    { supplierId: SUPPLIER_IDS[5], rating: 5, notes: 'Couple loved the gallery delivery.', reviewedBy: 'PMCM Admin' },
    // Reel Stories (SUPPLIER_IDS[9])
    { supplierId: SUPPLIER_IDS[9], rating: 5, notes: 'Cinematic output. Client cried watching SDE.', reviewedBy: 'PMCM Admin' },
    // Bloom & Petal (SUPPLIER_IDS[12])
    { supplierId: SUPPLIER_IDS[12], rating: 5, notes: 'Venue looked breathtaking. Setup finished 1 hour early.', reviewedBy: 'PMCM Admin' },
    { supplierId: SUPPLIER_IDS[12], rating: 5, notes: 'Arch design exceeded client expectations.', reviewedBy: 'PMCM Admin' },
    // Resonance AV (SUPPLIER_IDS[15])
    { supplierId: SUPPLIER_IDS[15], rating: 5, notes: 'Perfect audio, zero feedback issues.', reviewedBy: 'PMCM Admin' },
    // Joana Mercado (SUPPLIER_IDS[18])
    { supplierId: SUPPLIER_IDS[18], rating: 5, notes: 'Crowd loved her energy. Flawless transitions.', reviewedBy: 'PMCM Admin' },
    { supplierId: SUPPLIER_IDS[18], rating: 5, notes: 'Clients specifically requested her for next event.', reviewedBy: 'PMCM Admin' },
    // Premier Wheels (SUPPLIER_IDS[23])
    { supplierId: SUPPLIER_IDS[23], rating: 5, notes: 'All vehicles arrived 30 min early. Spotless.', reviewedBy: 'PMCM Admin' },
  ];

  for (const r of reviews) {
    await prisma.opsSupplierReview.create({
      data: {
        id: randomUUID(),
        supplierId: r.supplierId,
        rating: r.rating,
        notes: r.notes,
        reviewedBy: r.reviewedBy,
      },
    });
  }
  console.log(`✓ ${reviews.length} supplier reviews seeded`);
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
      password: 'pmcm2024!',  // sample only — not production
      role: 'pmcm_admin',
      organization: 'PMCM Events',
      approvalStatus: 'approved',
    },
  });
  console.log('✓ PMCM Admin user seeded (admin@pmcm.ph)');
}

// ─── INQUIRIES ────────────────────────────────────────────────────────────────

const INQUIRY_DATA = [
  { clientName: 'Reyes Family',       eventName: 'Reyes Grand Wedding',      eventDate: futureDate(45), clientType: 'returning', email: 'reyes@example.com' },
  { clientName: 'Santos Family',      eventName: 'Santos 18th Debut',         eventDate: futureDate(60), clientType: 'new',       email: 'santos@example.com' },
  { clientName: 'Cruz Corporation',   eventName: 'Cruz Corp Annual Gala',     eventDate: futureDate(30), clientType: 'corporate', email: 'events@cruzcorp.com' },
  { clientName: 'Lim Family',         eventName: 'Lim Silver Anniversary',    eventDate: futureDate(90), clientType: 'returning', email: 'lim@example.com' },
  { clientName: 'Garcia Family',      eventName: 'Garcia Baby Christening',   eventDate: futureDate(21), clientType: 'new',       email: 'garcia@example.com' },
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

const EVENT_DATA = [
  // Index 0: Reyes Wedding — PRIMARY PARE test event
  { clientName: 'Reyes Family',     eventName: 'Reyes Grand Wedding',    status: 'planning', readiness: 'Planning in progress', budget: 350000 },
  // Index 1: Santos Debut
  { clientName: 'Santos Family',    eventName: 'Santos 18th Debut',      status: 'planning', readiness: 'Planning in progress', budget: 180000 },
  // Index 2: Cruz Corporate Gala — urgent, event is 30 days away
  { clientName: 'Cruz Corporation', eventName: 'Cruz Corp Annual Gala',  status: 'planning', readiness: 'Suppliers being confirmed', budget: 500000 },
  // Index 3: Lim Anniversary
  { clientName: 'Lim Family',       eventName: 'Lim Silver Anniversary', status: 'planning', readiness: 'Planning in progress', budget: 220000 },
  // Index 4: Garcia Christening — small event, close date
  { clientName: 'Garcia Family',    eventName: 'Garcia Baby Christening',status: 'planning', readiness: 'Suppliers being confirmed', budget: 80000 },
];

async function seedEvents() {
  for (let i = 0; i < EVENT_DATA.length; i++) {
    const d = EVENT_DATA[i];
    await prisma.opsEvent.upsert({
      where: { id: EVENT_IDS[i] },
      update: {},
      create: {
        id: EVENT_IDS[i],
        inquiryId: INQUIRY_IDS[i],
        clientName: d.clientName,
        eventName: d.eventName,
        eventDate: INQUIRY_DATA[i].eventDate,
        status: d.status,
        readiness: d.readiness,
        clientPortalStatus: 'active',
      },
    });
  }
  console.log('✓ Events seeded');
}

// ─── QUOTE REQUESTS + QUOTES ─────────────────────────────────────────────────
// For PARE to work, the primary supplier needs an assigned quote request
// and the replacement supplier needs a submitted quote so Agent 3 (budget)
// has numbers to compare.

async function seedQuotesAndRequests() {
  const now = new Date();

  // ── REYES WEDDING (EVENT_IDS[0]) ────────────────────────────────────────
  // Primary: Goldleaf Catering (SUPPLIER_IDS[0]) — assigned, will go unavailable
  const reyesCateringRequestId = randomUUID();
  await prisma.opsSupplierQuoteRequest.create({
    data: {
      id: reyesCateringRequestId,
      eventId: EVENT_IDS[0],
      supplierId: SUPPLIER_IDS[0],
      categoryId: CATEGORY_IDS.catering,
      supplierName: 'Goldleaf Catering Co.',
      category: 'Catering',
      message: 'Full buffet for 200 pax. Halal menu required. Please include dessert station.',
      dueDate: futureDate(10),
      accessToken: randomUUID(),
      status: 'open',
      assignmentStatus: 'confirmed',    // ← ASSIGNED — this is the one PARE replaces
      assignmentConfirmedAt: now,
      readinessStatus: 'confirmed',
    },
  });
  await prisma.opsSupplierQuote.create({
    data: {
      id: randomUUID(),
      eventId: EVENT_IDS[0],
      requestId: reyesCateringRequestId,
      supplierId: SUPPLIER_IDS[0],
      categoryId: CATEGORY_IDS.catering,
      supplierName: 'Goldleaf Catering Co.',
      category: 'Catering',
      amount: 72000,
      inclusions: ['Buffet setup', 'On-site chef', 'Halal menu', 'Dessert station', 'Waitstaff x6'],
      paymentTerms: '50% upon booking, 50% on event day',
      notes: 'Menu finalized. Headcount confirmed at 200.',
      status: 'selected',
      selectedAt: now,
    },
  });

  // Replacement candidate: Kusina ni Lola (SUPPLIER_IDS[1]) — has a quote ready
  const reyesCateringBackupRequestId = randomUUID();
  await prisma.opsSupplierQuoteRequest.create({
    data: {
      id: reyesCateringBackupRequestId,
      eventId: EVENT_IDS[0],
      supplierId: SUPPLIER_IDS[1],
      categoryId: CATEGORY_IDS.catering,
      supplierName: 'Kusina ni Lola Events',
      category: 'Catering',
      message: 'Backup quote request. Full buffet for 200 pax. Halal required.',
      dueDate: futureDate(10),
      accessToken: randomUUID(),
      status: 'open',
      assignmentStatus: 'pending_confirmation',
    },
  });
  await prisma.opsSupplierQuote.create({
    data: {
      id: randomUUID(),
      eventId: EVENT_IDS[0],
      requestId: reyesCateringBackupRequestId,
      supplierId: SUPPLIER_IDS[1],
      categoryId: CATEGORY_IDS.catering,
      supplierName: 'Kusina ni Lola Events',
      category: 'Catering',
      amount: 65000,       // ₱7,000 cheaper than primary — Agent 3 will note this
      inclusions: ['Buffet setup', 'Halal menu', 'Lechon station', 'Dessert spread', 'Waitstaff x5'],
      paymentTerms: '30% booking, 70% on event day',
      notes: 'Available on event date. Halal-certified. Can confirm within 24 hours.',
      status: 'submitted',
    },
  });

  // Photography for Reyes
  const reyesPhotoRequestId = randomUUID();
  await prisma.opsSupplierQuoteRequest.create({
    data: {
      id: reyesPhotoRequestId,
      eventId: EVENT_IDS[0],
      supplierId: SUPPLIER_IDS[5],
      categoryId: CATEGORY_IDS.photography,
      supplierName: 'Studio Lumin PH',
      category: 'Photography',
      message: 'Full day coverage, 2 shooters, SDS.',
      dueDate: futureDate(10),
      accessToken: randomUUID(),
      status: 'open',
      assignmentStatus: 'confirmed',
      assignmentConfirmedAt: now,
      readinessStatus: 'confirmed',
    },
  });
  await prisma.opsSupplierQuote.create({
    data: {
      id: randomUUID(),
      eventId: EVENT_IDS[0],
      requestId: reyesPhotoRequestId,
      supplierId: SUPPLIER_IDS[5],
      categoryId: CATEGORY_IDS.photography,
      supplierName: 'Studio Lumin PH',
      category: 'Photography',
      amount: 38000,
      inclusions: ['Full-day coverage', '2 photographers', 'Same-day slideshow', 'Online gallery', '300 edited photos'],
      paymentTerms: '50% upon booking, 50% event day',
      status: 'selected',
      selectedAt: now,
    },
  });

  // Decor for Reyes
  const reyesDecorRequestId = randomUUID();
  await prisma.opsSupplierQuoteRequest.create({
    data: {
      id: reyesDecorRequestId,
      eventId: EVENT_IDS[0],
      supplierId: SUPPLIER_IDS[12],
      categoryId: CATEGORY_IDS.flowerDecor,
      supplierName: 'Bloom & Petal Events',
      category: 'Flower & Decor',
      message: 'Full venue styling. White and gold theme.',
      dueDate: futureDate(10),
      accessToken: randomUUID(),
      status: 'open',
      assignmentStatus: 'confirmed',
      assignmentConfirmedAt: now,
    },
  });
  await prisma.opsSupplierQuote.create({
    data: {
      id: randomUUID(),
      eventId: EVENT_IDS[0],
      requestId: reyesDecorRequestId,
      supplierId: SUPPLIER_IDS[12],
      categoryId: CATEGORY_IDS.flowerDecor,
      supplierName: 'Bloom & Petal Events',
      category: 'Flower & Decor',
      amount: 55000,
      inclusions: ['Full venue styling', 'Floral arch', 'Centerpieces x20', 'Entrance decor', 'Bridal table arrangement'],
      paymentTerms: '50% upon booking, 50% event day',
      status: 'selected',
      selectedAt: now,
    },
  });

  // Sound for Reyes
  const reyesSoundRequestId = randomUUID();
  await prisma.opsSupplierQuoteRequest.create({
    data: {
      id: reyesSoundRequestId,
      eventId: EVENT_IDS[0],
      supplierId: SUPPLIER_IDS[15],
      categoryId: CATEGORY_IDS.soundLighting,
      supplierName: 'Resonance AV Solutions',
      category: 'Sound & Lighting',
      message: 'Full PA and stage lighting. Reception hall capacity 200.',
      dueDate: futureDate(10),
      accessToken: randomUUID(),
      status: 'open',
      assignmentStatus: 'confirmed',
      assignmentConfirmedAt: now,
    },
  });
  await prisma.opsSupplierQuote.create({
    data: {
      id: randomUUID(),
      eventId: EVENT_IDS[0],
      requestId: reyesSoundRequestId,
      supplierId: SUPPLIER_IDS[15],
      categoryId: CATEGORY_IDS.soundLighting,
      supplierName: 'Resonance AV Solutions',
      category: 'Sound & Lighting',
      amount: 32000,
      inclusions: ['Full PA system', 'Stage lighting', 'LED uplights', 'AV technician x2', 'Wireless mics x4'],
      paymentTerms: '50% upon booking, 50% event day',
      status: 'selected',
      selectedAt: now,
    },
  });

  // ── SANTOS DEBUT (EVENT_IDS[1]) ─────────────────────────────────────────
  const santosDebut = [
    { supplierId: SUPPLIER_IDS[2], catId: CATEGORY_IDS.catering, name: 'Palate Prime Catering', cat: 'Catering', amount: 42000 },
    { supplierId: SUPPLIER_IDS[6], catId: CATEGORY_IDS.photography, name: 'Bright Frames Photography', cat: 'Photography', amount: 22000 },
    { supplierId: SUPPLIER_IDS[13], catId: CATEGORY_IDS.flowerDecor, name: 'Garden & Grace Decor', cat: 'Flower & Decor', amount: 28000 },
    { supplierId: SUPPLIER_IDS[19], catId: CATEGORY_IDS.hostEmcee, name: 'RJ Events Hosting', cat: 'Host / Emcee', amount: 12000 },
  ];
  for (const s of santosDebut) {
    const reqId = randomUUID();
    await prisma.opsSupplierQuoteRequest.create({
      data: {
        id: reqId, eventId: EVENT_IDS[1], supplierId: s.supplierId,
        categoryId: s.catId, supplierName: s.name, category: s.cat,
        message: `Quote request for ${s.cat}.`, dueDate: futureDate(15),
        accessToken: randomUUID(), status: 'open',
        assignmentStatus: 'confirmed', assignmentConfirmedAt: now,
      },
    });
    await prisma.opsSupplierQuote.create({
      data: {
        id: randomUUID(), eventId: EVENT_IDS[1], requestId: reqId,
        supplierId: s.supplierId, categoryId: s.catId,
        supplierName: s.name, category: s.cat, amount: s.amount,
        inclusions: ['Standard package'], paymentTerms: '50/50',
        status: 'selected', selectedAt: now,
      },
    });
  }

  // ── CRUZ CORPORATE GALA (EVENT_IDS[2]) ─────────────────────────────────
  const cruzGala = [
    { supplierId: SUPPLIER_IDS[4], catId: CATEGORY_IDS.catering, name: 'Sage & Salt Catering', cat: 'Catering', amount: 110000 },
    { supplierId: SUPPLIER_IDS[9], catId: CATEGORY_IDS.videoProduction, name: 'Reel Stories PH', cat: 'Video Production', amount: 45000 },
    { supplierId: SUPPLIER_IDS[15], catId: CATEGORY_IDS.soundLighting, name: 'Resonance AV Solutions', cat: 'Sound & Lighting', amount: 55000 },
    { supplierId: SUPPLIER_IDS[18], catId: CATEGORY_IDS.hostEmcee, name: 'Joana Mercado Events Host', cat: 'Host / Emcee', amount: 20000 },
  ];
  for (const s of cruzGala) {
    const reqId = randomUUID();
    await prisma.opsSupplierQuoteRequest.create({
      data: {
        id: reqId, eventId: EVENT_IDS[2], supplierId: s.supplierId,
        categoryId: s.catId, supplierName: s.name, category: s.cat,
        message: `Corporate event quote for ${s.cat}.`, dueDate: futureDate(8),
        accessToken: randomUUID(), status: 'open',
        assignmentStatus: 'confirmed', assignmentConfirmedAt: now,
      },
    });
    await prisma.opsSupplierQuote.create({
      data: {
        id: randomUUID(), eventId: EVENT_IDS[2], requestId: reqId,
        supplierId: s.supplierId, categoryId: s.catId,
        supplierName: s.name, category: s.cat, amount: s.amount,
        inclusions: ['Corporate package'], paymentTerms: '50/50',
        status: 'selected', selectedAt: now,
      },
    });
  }

  // ── LIM ANNIVERSARY (EVENT_IDS[3]) ─────────────────────────────────────
  const limAnniv = [
    { supplierId: SUPPLIER_IDS[1], catId: CATEGORY_IDS.catering, name: 'Kusina ni Lola Events', cat: 'Catering', amount: 48000 },
    { supplierId: SUPPLIER_IDS[7], catId: CATEGORY_IDS.photography, name: 'Captured Moments PH', cat: 'Photography', amount: 25000 },
    { supplierId: SUPPLIER_IDS[14], catId: CATEGORY_IDS.flowerDecor, name: 'Petal & Twine Studio', cat: 'Flower & Decor', amount: 22000 },
  ];
  for (const s of limAnniv) {
    const reqId = randomUUID();
    await prisma.opsSupplierQuoteRequest.create({
      data: {
        id: reqId, eventId: EVENT_IDS[3], supplierId: s.supplierId,
        categoryId: s.catId, supplierName: s.name, category: s.cat,
        message: `Quote for ${s.cat}.`, dueDate: futureDate(20),
        accessToken: randomUUID(), status: 'open',
        assignmentStatus: 'confirmed', assignmentConfirmedAt: now,
      },
    });
    await prisma.opsSupplierQuote.create({
      data: {
        id: randomUUID(), eventId: EVENT_IDS[3], requestId: reqId,
        supplierId: s.supplierId, categoryId: s.catId,
        supplierName: s.name, category: s.cat, amount: s.amount,
        inclusions: ['Standard package'], paymentTerms: '50/50',
        status: 'selected', selectedAt: now,
      },
    });
  }

  // ── GARCIA CHRISTENING (EVENT_IDS[4]) ───────────────────────────────────
  const garciaChristening = [
    { supplierId: SUPPLIER_IDS[3], catId: CATEGORY_IDS.catering, name: 'Fiesta Feast Catering', cat: 'Catering', amount: 28000 },
    { supplierId: SUPPLIER_IDS[8], catId: CATEGORY_IDS.photography, name: 'Golden Hour Shoots', cat: 'Photography', amount: 15000 },
  ];
  for (const s of garciaChristening) {
    const reqId = randomUUID();
    await prisma.opsSupplierQuoteRequest.create({
      data: {
        id: reqId, eventId: EVENT_IDS[4], supplierId: s.supplierId,
        categoryId: s.catId, supplierName: s.name, category: s.cat,
        message: `Quote for ${s.cat}.`, dueDate: futureDate(5),
        accessToken: randomUUID(), status: 'open',
        assignmentStatus: 'confirmed', assignmentConfirmedAt: now,
      },
    });
    await prisma.opsSupplierQuote.create({
      data: {
        id: randomUUID(), eventId: EVENT_IDS[4], requestId: reqId,
        supplierId: s.supplierId, categoryId: s.catId,
        supplierName: s.name, category: s.cat, amount: s.amount,
        inclusions: ['Basic package'], paymentTerms: '50/50',
        status: 'selected', selectedAt: now,
      },
    });
  }

  console.log('✓ Quote requests and quotes seeded');
}

// ─── RELIABILITY NOTES ────────────────────────────────────────────────────────

async function seedReliabilityNotes() {
  const notes = [
    { supplierId: SUPPLIER_IDS[0], note: 'Consistently early for setup. Excellent communication.' },
    { supplierId: SUPPLIER_IDS[0], note: 'Client specifically requested them for next event.' },
    { supplierId: SUPPLIER_IDS[1], note: 'Substituted one menu item without notice — resolved with apology.' },
    { supplierId: SUPPLIER_IDS[1], note: 'Halal certification verified and up to date.' },
    { supplierId: SUPPLIER_IDS[5], note: 'Delivered gallery 2 days ahead of SLA.' },
    { supplierId: SUPPLIER_IDS[9], note: 'SDE played at reception — couple was emotional. Excellent execution.' },
    { supplierId: SUPPLIER_IDS[18], note: 'Crowd management skills exceptional. Handled technical delay gracefully.' },
  ];

  for (const n of notes) {
    await prisma.opsSupplierReliabilityNote.create({
      data: {
        id: randomUUID(),
        supplierId: n.supplierId,
        note: n.note,
      },
    });
  }
  console.log('✓ Reliability notes seeded');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 PARE Seed — starting...\n');

  await seedCategories();
  await seedUser();
  await seedSuppliers();
  await seedReviews();
  await seedInquiries();
  await seedEvents();
  await seedQuotesAndRequests();
  await seedReliabilityNotes();

  console.log(`
✅ PARE seed complete!

PARE TEST SCENARIO:
  Event:            Reyes Grand Wedding (45 days away)
  Primary supplier: Goldleaf Catering Co. (Tier 1, ₱72,000, assigned)
  Replacement:      Kusina ni Lola Events (Tier 2, ₱65,000, halal-certified, quote submitted)
  Budget remaining: ₱350,000 - ₱197,000 (other suppliers) = ₱153,000

TO TRIGGER PARE:
  In apps/event (port 3004), open the Reyes Grand Wedding.
  Find Goldleaf Catering Co. in the supplier assignments.
  Mark them as Unavailable or Withdrawn.
  PARE should activate and assemble a recommendation package.

PMCM Admin login: admin@pmcm.ph / pmcm2024!
`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
