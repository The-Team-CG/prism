/**
 * PARE Test Seed - idempotent, safe to run multiple times.
 * Run from apps/api:  node --env-file=.env prisma/seed-pare.mjs
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

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

// ─── Stable IDs — never change these or the seed loses idempotency ────────────

const IDS = {
  // Categories (resolved from DB by slug after upsert)
  cat: {},

  // Suppliers
  sup: {
    goldleaf:    'pare-sup-goldleaf',
    kusina:      'pare-sup-kusina',
    palate:      'pare-sup-palate',
    fiesta:      'pare-sup-fiesta',
    sagesalt:    'pare-sup-sagesalt',
    studiolumin: 'pare-sup-studiolumin',
    brightframes:'pare-sup-brightframes',
    captured:    'pare-sup-captured',
    goldenhour:  'pare-sup-goldenhour',
    reelstories: 'pare-sup-reelstories',
    frameflow:   'pare-sup-frameflow',
    motion:      'pare-sup-motion',
    bloompetel:  'pare-sup-bloompetal',
    gardengrace: 'pare-sup-gardengrace',
    petaltwine:  'pare-sup-petaltwine',
    resonance:   'pare-sup-resonance',
    lumina:      'pare-sup-lumina',
    pulsepro:    'pare-sup-pulsepro',
    joana:       'pare-sup-joana',
    rjevents:    'pare-sup-rjevents',
    mikael:      'pare-sup-mikael',
    glowstudio:  'pare-sup-glowstudio',
    bloombeauty: 'pare-sup-bloombeauty',
    premier:     'pare-sup-premier',
    goevent:     'pare-sup-goevent',
  },

  // Users
  admin: 'pare-usr-admin',

  // Inquiries
  inq: {
    reyes:   'pare-inq-reyes',
    santos:  'pare-inq-santos',
    cruz:    'pare-inq-cruz',
    lim:     'pare-inq-lim',
    garcia:  'pare-inq-garcia',
  },

  // Events
  evt: {
    reyes:   'pare-evt-reyes',
    santos:  'pare-evt-santos',
    cruz:    'pare-evt-cruz',
    lim:     'pare-evt-lim',
    garcia:  'pare-evt-garcia',
  },

  // Quote requests (one per supplier-event assignment)
  qr: {
    reyes_goldleaf:    'pare-qr-reyes-goldleaf',
    reyes_kusina:      'pare-qr-reyes-kusina',
    reyes_lumin:       'pare-qr-reyes-lumin',
    reyes_bloom:       'pare-qr-reyes-bloom',
    reyes_resonance:   'pare-qr-reyes-resonance',
    reyes_joana:       'pare-qr-reyes-joana',
    santos_palate:     'pare-qr-santos-palate',
    santos_bright:     'pare-qr-santos-bright',
    santos_garden:     'pare-qr-santos-garden',
    santos_rj:         'pare-qr-santos-rj',
    cruz_sage:         'pare-qr-cruz-sage',
    cruz_reel:         'pare-qr-cruz-reel',
    cruz_resonance:    'pare-qr-cruz-resonance',
    cruz_joana:        'pare-qr-cruz-joana',
    lim_kusina:        'pare-qr-lim-kusina',
    lim_captured:      'pare-qr-lim-captured',
    lim_petal:         'pare-qr-lim-petal',
    garcia_fiesta:     'pare-qr-garcia-fiesta',
    garcia_golden:     'pare-qr-garcia-golden',
  },

  // Quotes
  quote: {
    reyes_goldleaf:    'pare-quote-reyes-goldleaf',
    reyes_kusina:      'pare-quote-reyes-kusina',
    reyes_lumin:       'pare-quote-reyes-lumin',
    reyes_bloom:       'pare-quote-reyes-bloom',
    reyes_resonance:   'pare-quote-reyes-resonance',
    reyes_joana:       'pare-quote-reyes-joana',
    santos_palate:     'pare-quote-santos-palate',
    santos_bright:     'pare-quote-santos-bright',
    santos_garden:     'pare-quote-santos-garden',
    santos_rj:         'pare-quote-santos-rj',
    cruz_sage:         'pare-quote-cruz-sage',
    cruz_reel:         'pare-quote-cruz-reel',
    cruz_resonance:    'pare-quote-cruz-resonance',
    cruz_joana:        'pare-quote-cruz-joana',
    lim_kusina:        'pare-quote-lim-kusina',
    lim_captured:      'pare-quote-lim-captured',
    lim_petal:         'pare-quote-lim-petal',
    garcia_fiesta:     'pare-quote-garcia-fiesta',
    garcia_golden:     'pare-quote-garcia-golden',
  },
};

function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// ─── CATEGORIES ───────────────────────────────────────────────────────────────

async function seedCategories() {
  const defs = [
    { slug: 'catering',        name: 'Catering',        sortOrder: 10, acceptableMin: 40000,  acceptableMax: 120000 },
    { slug: 'photography',     name: 'Photography',     sortOrder: 11, acceptableMin: 15000,  acceptableMax: 60000  },
    { slug: 'video-production',name: 'Video Production',sortOrder: 12, acceptableMin: 12000,  acceptableMax: 55000  },
    { slug: 'flower-decor',    name: 'Flower & Decor',  sortOrder: 13, acceptableMin: 20000,  acceptableMax: 80000  },
    { slug: 'sound-lighting',  name: 'Sound & Lighting',sortOrder: 14, acceptableMin: 18000,  acceptableMax: 70000  },
    { slug: 'host-emcee',      name: 'Host / Emcee',    sortOrder: 15, acceptableMin: 8000,   acceptableMax: 25000  },
    { slug: 'hair-makeup',     name: 'Hair & Makeup',   sortOrder: 16, acceptableMin: 6000,   acceptableMax: 20000  },
    { slug: 'transportation',  name: 'Transportation',  sortOrder: 17, acceptableMin: 5000,   acceptableMax: 18000  },
  ];

  for (const cat of defs) {
    await prisma.opsSupplierCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { id: `pare-cat-${cat.slug}`, ...cat },
    });
  }

  // Resolve actual IDs from DB (may differ from what we'd generate)
  const rows = await prisma.opsSupplierCategory.findMany({
    where: { slug: { in: defs.map(d => d.slug) } },
  });
  for (const row of rows) IDS.cat[row.slug] = row.id;

  console.log('✓ Categories seeded');
}

// ─── USER ─────────────────────────────────────────────────────────────────────

async function seedUser() {
  await prisma.opsUser.upsert({
    where: { email: 'admin@pmcm.ph' },
    update: {},
    create: {
      id: IDS.admin,
      name: 'Ms. Mys',
      email: 'admin@pmcm.ph',
      password: 'pmcm2024!',
      role: 'pmcm_admin',
      organization: 'PMCM Events',
      approvalStatus: 'approved',
    },
  });
  console.log('✓ User seeded  →  admin@pmcm.ph / pmcm2024!');
}

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────

async function seedSuppliers() {
  const s = IDS.sup;
  const c = IDS.cat;

  const suppliers = [
    { id: s.goldleaf,    categoryId: c['catering'],        name: 'Goldleaf Catering Co.',      contactName: 'Marco Tan',       email: 'marco@goldleafcatering.ph', phone: '09171234001', tier: 'tier_1', bniMember: true,  serviceInclusions: 'Full-service buffet, Filipino and international cuisine, halal options, on-site chef', performanceNotes: 'Consistent Tier 1 partner since 2022. Zero complaints. Halal-certified.' },
    { id: s.kusina,      categoryId: c['catering'],        name: 'Kusina ni Lola Events',      contactName: 'Liza Domingo',    email: 'liza@kusinanilola.ph',      phone: '09181234002', tier: 'tier_2', bniMember: false, serviceInclusions: 'Filipino comfort food, lechon station, merienda spreads, halal menu available',      performanceNotes: 'Reliable Tier 2. 1 minor complaint resolved. Halal-certified.' },
    { id: s.palate,      categoryId: c['catering'],        name: 'Palate Prime Catering',      contactName: 'Nathan Reyes',    email: 'nathan@palateprime.ph',     phone: '09191234003', tier: 'tier_2', bniMember: true,  serviceInclusions: 'Plated dinners, cocktail spreads, dietary accommodations',                              performanceNotes: 'Good track record. No complaints. Worked with PMCM 3 times.' },
    { id: s.fiesta,      categoryId: c['catering'],        name: 'Fiesta Feast Catering',      contactName: 'Rosario Magtibay',email: 'rosario@fiestafeast.ph',    phone: '09201234004', tier: 'tier_3', bniMember: false, serviceInclusions: 'Budget-friendly buffet, standard Filipino menu',                                           performanceNotes: 'First event with PMCM. Pending reliability assessment.' },
    { id: s.sagesalt,    categoryId: c['catering'],        name: 'Sage & Salt Catering',       contactName: 'Carlos Villanueva',email:'carlos@sageandsalt.ph',     phone: '09211234005', tier: 'tier_1', bniMember: true,  serviceInclusions: 'Western and fusion cuisine, vegan options, dessert stations',                              performanceNotes: 'Premium Tier 1. Preferred for corporate and high-end events.' },
    { id: s.studiolumin, categoryId: c['photography'],     name: 'Studio Lumin PH',            contactName: 'Diane Ocampo',    email: 'diane@studiolumin.ph',      phone: '09221234006', tier: 'tier_1', bniMember: true,  serviceInclusions: 'Full-day coverage, 2 shooters, same-day slideshow, online gallery',                        performanceNotes: 'Top-rated photographer. Consistent 5-star reviews.' },
    { id: s.brightframes,categoryId: c['photography'],     name: 'Bright Frames Photography',  contactName: 'Paolo Cruz',      email: 'paolo@brightframes.ph',     phone: '09231234007', tier: 'tier_2', bniMember: false, serviceInclusions: 'Coverage up to 10 hours, 1 shooter, edited photos in 2 weeks',                              performanceNotes: 'Reliable. 1 late delivery incident, resolved.' },
    { id: s.captured,    categoryId: c['photography'],     name: 'Captured Moments PH',        contactName: 'Angela Santos',   email: 'angela@capturedmoments.ph', phone: '09241234008', tier: 'tier_2', bniMember: true,  serviceInclusions: 'Wedding and event photography, prenup sessions available',                                  performanceNotes: 'Good portfolio. 2 successful PMCM events.' },
    { id: s.goldenhour,  categoryId: c['photography'],     name: 'Golden Hour Shoots',         contactName: 'Mark Bautista',   email: 'mark@goldenhour.ph',        phone: '09251234009', tier: 'tier_3', bniMember: false, serviceInclusions: 'Standard coverage, 1 shooter',                                                             performanceNotes: 'New to PMCM. First booking pending.' },
    { id: s.reelstories, categoryId: c['video-production'],name: 'Reel Stories PH',            contactName: 'Jerome Gutierrez',email: 'jerome@reelstories.ph',     phone: '09261234010', tier: 'tier_1', bniMember: true,  serviceInclusions: 'Cinematic SDE, full event film, drone footage, color grade',                                 performanceNotes: 'Award-winning videography team. Zero complaints.' },
    { id: s.frameflow,   categoryId: c['video-production'],name: 'Frame & Flow Films',         contactName: 'Sheena Chua',     email: 'sheena@frameandflow.ph',    phone: '09271234011', tier: 'tier_2', bniMember: false, serviceInclusions: 'Event highlights, same-day edit, 2 videographers',                                         performanceNotes: '3 PMCM events. One SDE delay, rectified.' },
    { id: s.motion,      categoryId: c['video-production'],name: 'Motion & Memories',          contactName: 'Victor Lim',      email: 'victor@motionmemories.ph',  phone: '09281234012', tier: 'tier_2', bniMember: false, serviceInclusions: 'Event film, teaser video, 1 videographer',                                                  performanceNotes: 'Decent quality. Needs closer coordination on timelines.' },
    { id: s.bloompetel,  categoryId: c['flower-decor'],    name: 'Bloom & Petal Events',       contactName: 'Patricia Flores', email: 'patricia@bloomandpetal.ph', phone: '09291234013', tier: 'tier_1', bniMember: true,  serviceInclusions: 'Full venue styling, floral arrangements, centerpieces, arch design',                         performanceNotes: 'Premium decorator. Preferred for luxury events.' },
    { id: s.gardengrace, categoryId: c['flower-decor'],    name: 'Garden & Grace Decor',       contactName: 'Irene Pasqual',   email: 'irene@gardenandgrace.ph',   phone: '09301234014', tier: 'tier_2', bniMember: false, serviceInclusions: 'Table centerpieces, entrance decor, photo backdrop',                                        performanceNotes: 'Reliable Tier 2. 4 events with PMCM. Clean track record.' },
    { id: s.petaltwine,  categoryId: c['flower-decor'],    name: 'Petal & Twine Studio',       contactName: 'Mona Reyes',      email: 'mona@petalandtwine.ph',     phone: '09311234015', tier: 'tier_2', bniMember: true,  serviceInclusions: 'Rustic and garden themed styling, DIY florals',                                             performanceNotes: 'Good for themed events. 2 PMCM bookings.' },
    { id: s.resonance,   categoryId: c['sound-lighting'],  name: 'Resonance AV Solutions',     contactName: 'Bobby Tan',       email: 'bobby@resonanceav.ph',      phone: '09321234016', tier: 'tier_1', bniMember: true,  serviceInclusions: 'Full PA system, stage lighting, LED walls, technician on-site',                              performanceNotes: 'Preferred AV partner. Handles large-scale events.' },
    { id: s.lumina,      categoryId: c['sound-lighting'],  name: 'Lumina Events AV',           contactName: 'Chester Uy',      email: 'chester@luminaav.ph',       phone: '09331234017', tier: 'tier_2', bniMember: false, serviceInclusions: 'Sound system, mood lighting, basic LED setup',                                              performanceNotes: '2 successful PMCM events. No issues.' },
    { id: s.pulsepro,    categoryId: c['sound-lighting'],  name: 'Pulse Pro Audio',            contactName: 'Roland Garcia',   email: 'roland@pulsepro.ph',        phone: '09341234018', tier: 'tier_2', bniMember: false, serviceInclusions: 'Mid-range PA, DJ booth optional, gobo lights',                                              performanceNotes: 'First PMCM event. Vetted by BNI referral.' },
    { id: s.joana,       categoryId: c['host-emcee'],      name: 'Joana Mercado Events Host',  contactName: 'Joana Mercado',   email: 'joana@joanamercado.ph',     phone: '09351234019', tier: 'tier_1', bniMember: true,  serviceInclusions: 'Bilingual hosting (English/Filipino), script preparation, rehearsal',                        performanceNotes: 'Top-ranked emcee. 10+ PMCM events. Zero issues.' },
    { id: s.rjevents,    categoryId: c['host-emcee'],      name: 'RJ Events Hosting',          contactName: 'RJ Pascual',      email: 'rj@rjevents.ph',            phone: '09361234020', tier: 'tier_2', bniMember: false, serviceInclusions: 'English hosting, basic script coordination',                                                performanceNotes: '3 PMCM events. Positive client feedback.' },
    { id: s.mikael,      categoryId: c['host-emcee'],      name: 'Mikael Sy Hosting Services', contactName: 'Mikael Sy',       email: 'mikael@mikaelsy.ph',        phone: '09371234021', tier: 'tier_2', bniMember: false, serviceInclusions: 'Trilingual hosting, comedian MC option',                                                    performanceNotes: 'New partner. Vetted via referral.' },
    { id: s.glowstudio,  categoryId: c['hair-makeup'],     name: 'Glow Studio by Carla',       contactName: 'Carla Mendoza',   email: 'carla@glowstudio.ph',       phone: '09381234022', tier: 'tier_1', bniMember: true,  serviceInclusions: 'Bridal HMUA, touch-up kit, airbrush makeup, hair styling',                                   performanceNotes: 'Premium HMUA. Works well under pressure. No complaints.' },
    { id: s.bloombeauty, categoryId: c['hair-makeup'],     name: 'Bloom Beauty Team',          contactName: 'Trina Aquino',    email: 'trina@bloombeauty.ph',      phone: '09391234023', tier: 'tier_2', bniMember: false, serviceInclusions: 'Makeup and hair for bride and entourage',                                                   performanceNotes: '2 PMCM events. Consistent quality.' },
    { id: s.premier,     categoryId: c['transportation'],  name: 'Premier Wheels Events',      contactName: 'Arnel Dela Cruz', email: 'arnel@premierwheels.ph',    phone: '09401234024', tier: 'tier_1', bniMember: true,  serviceInclusions: 'Bridal car, shuttle fleet, coordination with venue',                                         performanceNotes: 'Tier 1 transport partner. Always on-time. 8 PMCM events.' },
    { id: s.goevent,     categoryId: c['transportation'],  name: 'Go Event Transport',         contactName: 'Dennis Uy',       email: 'dennis@goeventtransport.ph',phone: '09411234025', tier: 'tier_2', bniMember: false, serviceInclusions: 'Van and bus rentals, airport transfers',                                                    performanceNotes: '1 PMCM event. On-time. No complaints.' },
  ];

  for (const sup of suppliers) {
    await prisma.opsSupplier.upsert({ where: { id: sup.id }, update: {}, create: sup });
  }
  console.log(`✓ ${suppliers.length} suppliers seeded`);
}

// ─── REVIEWS ─────────────────────────────────────────────────────────────────

async function seedReviews() {
  const s = IDS.sup;
  const reviews = [
    { id: 'pare-rev-goldleaf-1',    supplierId: s.goldleaf,    rating: 5, notes: 'Flawless service, arrived 2 hours early for setup.' },
    { id: 'pare-rev-goldleaf-2',    supplierId: s.goldleaf,    rating: 5, notes: 'Food quality excellent. All 200 pax served on time.' },
    { id: 'pare-rev-goldleaf-3',    supplierId: s.goldleaf,    rating: 4, notes: 'Minor delay on dessert station but handled gracefully.' },
    { id: 'pare-rev-kusina-1',      supplierId: s.kusina,      rating: 4, notes: 'Good food, setup was clean, client happy.' },
    { id: 'pare-rev-kusina-2',      supplierId: s.kusina,      rating: 4, notes: 'Halal menu well-executed. No complaints from guests.' },
    { id: 'pare-rev-kusina-3',      supplierId: s.kusina,      rating: 3, notes: 'One menu item substituted without prior notice.' },
    { id: 'pare-rev-palate-1',      supplierId: s.palate,      rating: 5, notes: 'Excellent plating and service.' },
    { id: 'pare-rev-palate-2',      supplierId: s.palate,      rating: 4, notes: 'Corporate client very satisfied.' },
    { id: 'pare-rev-lumin-1',       supplierId: s.studiolumin, rating: 5, notes: 'Best photos we have seen. On time, professional.' },
    { id: 'pare-rev-lumin-2',       supplierId: s.studiolumin, rating: 5, notes: 'Couple loved the gallery delivery.' },
    { id: 'pare-rev-reel-1',        supplierId: s.reelstories, rating: 5, notes: 'Cinematic output. Client cried watching SDE.' },
    { id: 'pare-rev-bloom-1',       supplierId: s.bloompetel,  rating: 5, notes: 'Venue looked breathtaking. Setup finished 1 hour early.' },
    { id: 'pare-rev-bloom-2',       supplierId: s.bloompetel,  rating: 5, notes: 'Arch design exceeded client expectations.' },
    { id: 'pare-rev-resonance-1',   supplierId: s.resonance,   rating: 5, notes: 'Perfect audio, zero feedback issues.' },
    { id: 'pare-rev-joana-1',       supplierId: s.joana,       rating: 5, notes: 'Crowd loved her energy. Flawless transitions.' },
    { id: 'pare-rev-joana-2',       supplierId: s.joana,       rating: 5, notes: 'Clients specifically requested her for next event.' },
    { id: 'pare-rev-premier-1',     supplierId: s.premier,     rating: 5, notes: 'All vehicles arrived 30 min early. Spotless.' },
  ];

  for (const r of reviews) {
    await prisma.opsSupplierReview.upsert({
      where: { id: r.id },
      update: {},
      create: { id: r.id, supplierId: r.supplierId, rating: r.rating, notes: r.notes, reviewedBy: 'PMCM Admin' },
    });
  }
  console.log(`✓ ${reviews.length} reviews seeded`);
}

// ─── RELIABILITY NOTES ────────────────────────────────────────────────────────

async function seedReliabilityNotes() {
  const s = IDS.sup;
  const notes = [
    { id: 'pare-rel-goldleaf-1',  supplierId: s.goldleaf,    note: 'Consistently early for setup. Excellent communication.' },
    { id: 'pare-rel-goldleaf-2',  supplierId: s.goldleaf,    note: 'Client specifically requested them for next event.' },
    { id: 'pare-rel-kusina-1',    supplierId: s.kusina,      note: 'Substituted one menu item without notice — resolved with apology.' },
    { id: 'pare-rel-kusina-2',    supplierId: s.kusina,      note: 'Halal certification verified and up to date.' },
    { id: 'pare-rel-lumin-1',     supplierId: s.studiolumin, note: 'Delivered gallery 2 days ahead of SLA.' },
    { id: 'pare-rel-reel-1',      supplierId: s.reelstories, note: 'SDE played at reception — couple was emotional. Excellent execution.' },
    { id: 'pare-rel-joana-1',     supplierId: s.joana,       note: 'Crowd management skills exceptional. Handled technical delay gracefully.' },
  ];

  for (const n of notes) {
    await prisma.opsSupplierReliabilityNote.upsert({
      where: { id: n.id },
      update: {},
      create: { id: n.id, supplierId: n.supplierId, note: n.note },
    });
  }
  console.log('✓ Reliability notes seeded');
}

// ─── INQUIRIES ────────────────────────────────────────────────────────────────

async function seedInquiries() {
  const data = [
    { id: IDS.inq.reyes,  clientName: 'Reyes Family',     eventName: 'Reyes Grand Wedding',    days: 45, clientType: 'returning', email: 'reyes@example.com' },
    { id: IDS.inq.santos, clientName: 'Santos Family',    eventName: 'Santos 18th Debut',      days: 60, clientType: 'new',       email: 'santos@example.com' },
    { id: IDS.inq.cruz,   clientName: 'Cruz Corporation', eventName: 'Cruz Corp Annual Gala',  days: 30, clientType: 'corporate', email: 'events@cruzcorp.com' },
    { id: IDS.inq.lim,    clientName: 'Lim Family',       eventName: 'Lim Silver Anniversary', days: 90, clientType: 'returning', email: 'lim@example.com' },
    { id: IDS.inq.garcia, clientName: 'Garcia Family',    eventName: 'Garcia Baby Christening',days: 21, clientType: 'new',       email: 'garcia@example.com' },
  ];
  for (const d of data) {
    await prisma.opsInquiry.upsert({
      where: { id: d.id },
      update: {},
      create: {
        id: d.id,
        clientName: d.clientName,
        email: d.email,
        eventName: d.eventName,
        eventDate: futureDate(d.days),
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
  const inq = IDS.inq;
  const evt = IDS.evt;
  const data = [
    { id: evt.reyes,  inquiryId: inq.reyes,  clientName: 'Reyes Family',     eventName: 'Reyes Grand Wedding',    days: 45, readiness: 'Suppliers being confirmed' },
    { id: evt.santos, inquiryId: inq.santos, clientName: 'Santos Family',    eventName: 'Santos 18th Debut',      days: 60, readiness: 'Planning in progress' },
    { id: evt.cruz,   inquiryId: inq.cruz,   clientName: 'Cruz Corporation', eventName: 'Cruz Corp Annual Gala',  days: 30, readiness: 'Suppliers being confirmed' },
    { id: evt.lim,    inquiryId: inq.lim,    clientName: 'Lim Family',       eventName: 'Lim Silver Anniversary', days: 90, readiness: 'Planning in progress' },
    { id: evt.garcia, inquiryId: inq.garcia, clientName: 'Garcia Family',    eventName: 'Garcia Baby Christening',days: 21, readiness: 'Suppliers being confirmed' },
  ];
  for (const e of data) {
    await prisma.opsEvent.upsert({
      where: { id: e.id },
      update: {},
      create: {
        id: e.id,
        inquiryId: e.inquiryId,
        clientName: e.clientName,
        eventName: e.eventName,
        eventDate: futureDate(e.days),
        status: 'planning',
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
  const s = IDS.sup;
  const e = IDS.evt;
  const c = IDS.cat;
  const qr = IDS.qr;
  const qt = IDS.quote;

  const assignments = [
    // ── REYES GRAND WEDDING ─────────────────────────────────────────────────
    // Goldleaf = PRIMARY assigned (withdraw this to trigger PARE)
    { qrId: qr.reyes_goldleaf,  qtId: qt.reyes_goldleaf,  eventId: e.reyes,  supplierId: s.goldleaf,    catId: c['catering'],        name: 'Goldleaf Catering Co.',     cat: 'Catering',        amount: 72000, assigned: true,  inclusions: ['Buffet setup','On-site chef','Halal menu','Dessert station','Waitstaff x6'] },
    // Kusina = backup with submitted quote (PARE will find this as replacement)
    { qrId: qr.reyes_kusina,    qtId: qt.reyes_kusina,    eventId: e.reyes,  supplierId: s.kusina,      catId: c['catering'],        name: 'Kusina ni Lola Events',     cat: 'Catering',        amount: 65000, assigned: false, inclusions: ['Buffet setup','Halal menu','Lechon station','Dessert spread','Waitstaff x5'] },
    { qrId: qr.reyes_lumin,     qtId: qt.reyes_lumin,     eventId: e.reyes,  supplierId: s.studiolumin, catId: c['photography'],     name: 'Studio Lumin PH',           cat: 'Photography',     amount: 38000, assigned: true,  inclusions: ['Full-day coverage','2 photographers','Same-day slideshow','Online gallery'] },
    { qrId: qr.reyes_bloom,     qtId: qt.reyes_bloom,     eventId: e.reyes,  supplierId: s.bloompetel,  catId: c['flower-decor'],    name: 'Bloom & Petal Events',      cat: 'Flower & Decor',  amount: 55000, assigned: true,  inclusions: ['Full venue styling','Floral arch','Centerpieces x20','Entrance decor'] },
    { qrId: qr.reyes_resonance, qtId: qt.reyes_resonance, eventId: e.reyes,  supplierId: s.resonance,   catId: c['sound-lighting'],  name: 'Resonance AV Solutions',    cat: 'Sound & Lighting',amount: 32000, assigned: true,  inclusions: ['Full PA system','Stage lighting','LED uplights','Wireless mics x4'] },
    { qrId: qr.reyes_joana,     qtId: qt.reyes_joana,     eventId: e.reyes,  supplierId: s.joana,       catId: c['host-emcee'],      name: 'Joana Mercado Events Host', cat: 'Host / Emcee',    amount: 18000, assigned: true,  inclusions: ['Bilingual hosting','Script prep','Rehearsal session'] },
    // ── SANTOS DEBUT ────────────────────────────────────────────────────────
    { qrId: qr.santos_palate,   qtId: qt.santos_palate,   eventId: e.santos, supplierId: s.palate,      catId: c['catering'],        name: 'Palate Prime Catering',     cat: 'Catering',        amount: 42000, assigned: true,  inclusions: ['Buffet setup','Waitstaff x4'] },
    { qrId: qr.santos_bright,   qtId: qt.santos_bright,   eventId: e.santos, supplierId: s.brightframes,catId: c['photography'],     name: 'Bright Frames Photography', cat: 'Photography',     amount: 22000, assigned: true,  inclusions: ['Full-day coverage','1 photographer'] },
    { qrId: qr.santos_garden,   qtId: qt.santos_garden,   eventId: e.santos, supplierId: s.gardengrace, catId: c['flower-decor'],    name: 'Garden & Grace Decor',      cat: 'Flower & Decor',  amount: 28000, assigned: true,  inclusions: ['Centerpieces x15','Entrance decor'] },
    { qrId: qr.santos_rj,       qtId: qt.santos_rj,       eventId: e.santos, supplierId: s.rjevents,    catId: c['host-emcee'],      name: 'RJ Events Hosting',         cat: 'Host / Emcee',    amount: 12000, assigned: true,  inclusions: ['English hosting','Script coordination'] },
    // ── CRUZ CORPORATE GALA ─────────────────────────────────────────────────
    { qrId: qr.cruz_sage,       qtId: qt.cruz_sage,       eventId: e.cruz,   supplierId: s.sagesalt,    catId: c['catering'],        name: 'Sage & Salt Catering',      cat: 'Catering',        amount: 110000,assigned: true,  inclusions: ['Plated dinner x300','Waitstaff x10','Vegan options'] },
    { qrId: qr.cruz_reel,       qtId: qt.cruz_reel,       eventId: e.cruz,   supplierId: s.reelstories, catId: c['video-production'],name: 'Reel Stories PH',           cat: 'Video Production',amount: 45000, assigned: true,  inclusions: ['Event film','Highlights reel','Drone footage'] },
    { qrId: qr.cruz_resonance,  qtId: qt.cruz_resonance,  eventId: e.cruz,   supplierId: s.resonance,   catId: c['sound-lighting'],  name: 'Resonance AV Solutions',    cat: 'Sound & Lighting',amount: 55000, assigned: true,  inclusions: ['Full PA system','LED wall','Stage lighting','AV tech x3'] },
    { qrId: qr.cruz_joana,      qtId: qt.cruz_joana,      eventId: e.cruz,   supplierId: s.joana,       catId: c['host-emcee'],      name: 'Joana Mercado Events Host', cat: 'Host / Emcee',    amount: 20000, assigned: true,  inclusions: ['Corporate hosting','Script prep'] },
    // ── LIM ANNIVERSARY ─────────────────────────────────────────────────────
    { qrId: qr.lim_kusina,      qtId: qt.lim_kusina,      eventId: e.lim,    supplierId: s.kusina,      catId: c['catering'],        name: 'Kusina ni Lola Events',     cat: 'Catering',        amount: 48000, assigned: true,  inclusions: ['Buffet setup','Lechon station','Waitstaff x4'] },
    { qrId: qr.lim_captured,    qtId: qt.lim_captured,    eventId: e.lim,    supplierId: s.captured,    catId: c['photography'],     name: 'Captured Moments PH',       cat: 'Photography',     amount: 25000, assigned: true,  inclusions: ['Full-day coverage','1 photographer','Edited photos'] },
    { qrId: qr.lim_petal,       qtId: qt.lim_petal,       eventId: e.lim,    supplierId: s.petaltwine,  catId: c['flower-decor'],    name: 'Petal & Twine Studio',      cat: 'Flower & Decor',  amount: 22000, assigned: true,  inclusions: ['Rustic centerpieces x10','Entrance decor'] },
    // ── GARCIA CHRISTENING ──────────────────────────────────────────────────
    { qrId: qr.garcia_fiesta,   qtId: qt.garcia_fiesta,   eventId: e.garcia, supplierId: s.fiesta,      catId: c['catering'],        name: 'Fiesta Feast Catering',     cat: 'Catering',        amount: 28000, assigned: true,  inclusions: ['Buffet setup','Standard Filipino menu'] },
    { qrId: qr.garcia_golden,   qtId: qt.garcia_golden,   eventId: e.garcia, supplierId: s.goldenhour,  catId: c['photography'],     name: 'Golden Hour Shoots',        cat: 'Photography',     amount: 15000, assigned: true,  inclusions: ['4-hour coverage','1 photographer'] },
  ];

  for (const a of assignments) {
    await prisma.opsSupplierQuoteRequest.upsert({
      where: { id: a.qrId },
      update: {},
      create: {
        id: a.qrId,
        eventId: a.eventId,
        supplierId: a.supplierId,
        categoryId: a.catId,
        supplierName: a.name,
        category: a.cat,
        message: `Quote request for ${a.cat}.`,
        dueDate: futureDate(14),
        accessToken: `pare-token-${a.qrId}`,
        status: 'open',
        assignmentStatus: a.assigned ? 'confirmed' : 'pending_confirmation',
        assignmentConfirmedAt: a.assigned ? now : null,
        readinessStatus: a.assigned ? 'confirmed' : 'not_requested',
      },
    });
    await prisma.opsSupplierQuote.upsert({
      where: { id: a.qtId },
      update: {},
      create: {
        id: a.qtId,
        eventId: a.eventId,
        requestId: a.qrId,
        supplierId: a.supplierId,
        categoryId: a.catId,
        supplierName: a.name,
        category: a.cat,
        amount: a.amount,
        inclusions: a.inclusions,
        paymentTerms: '50% upon booking, 50% on event day',
        status: a.assigned ? 'selected' : 'submitted',
        selectedAt: a.assigned ? now : null,
      },
    });
  }
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
    • Reyes Grand Wedding       (45 days)  ← PARE sample event
    • Santos 18th Debut         (60 days)
    • Cruz Corp Annual Gala     (30 days)
    • Lim Silver Anniversary    (90 days)
    • Garcia Baby Christening   (21 days)

  TO TRIGGER PARE:
    1. Log in as admin@pmcm.ph / pmcm2024!
    2. Open Reyes Grand Wedding → Suppliers tab
    3. Click "Withdraw · Trigger PARE" on Goldleaf Catering Co.
    4. PARE runs → Kusina ni Lola recommended (₱65,000, halal, Tier 2)
    5. Approve or Reject in the panel below
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
