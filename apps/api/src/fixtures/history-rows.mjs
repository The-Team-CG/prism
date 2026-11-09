import { createHash } from 'node:crypto';

/**
 * The `history` seed profile: five years of synthetic events around the scenario date, deterministic for a given
 * date. Four years back and one year ahead, four events a month, each carrying the records its stage would have:
 * archived and closing events with billing, payments, staffing, check-ins, feedback and closeout; a live event today;
 * planning and briefing events with suppliers and proposals; and an inquiry pipeline with declined, pending and new
 * inquiries. Every row is synthetic and marked "History seed"; conforme rows are fixtures, not legal signatures.
 */

export const HISTORY_WINDOW = { monthsBack: 48, monthsAhead: 12, eventsPerMonth: 4 };
const DAYS_PER_MONTH = 30.44;
const SEED_SOURCE = 'History seed';
const NOTICE = 'HISTORY-2022';
const CONFORME_TEXT = 'PRISM history conforme fixture v1';
const CONFORME_SHA = createHash('sha256').update(CONFORME_TEXT).digest('hex');

const CLIENTS = [
  { userId: 'usr_client', name: 'Ana Reyes', company: 'Ayala Corp', email: 'ana@ayala.test', type: 'corporate' },
  { name: 'Carlo Mendoza', company: 'Northwind Telecom', email: 'carlo@northwind.test', type: 'corporate' },
  { name: 'Liza Tan', company: 'Tan Family', email: 'liza@tanfamily.test', type: 'individual' },
  { name: 'Miguel Ramos', company: 'Harbor Bank', email: 'miguel@harborbank.test', type: 'corporate' },
  { name: 'Patricia Go', company: 'Go Holdings', email: 'patricia@goholdings.test', type: 'corporate' },
  { name: 'Rafael Cruz', company: 'Cruz Family', email: 'rafael@cruzfamily.test', type: 'individual' },
  { name: 'Sofia Villanueva', company: 'Lumen Pharma', email: 'sofia@lumenpharma.test', type: 'corporate' },
  { name: 'Teresa Lim', company: 'Lim and Partners', email: 'teresa@limpartners.test', type: 'corporate' },
  { name: 'Victor Aquino', company: 'Aquino Family', email: 'victor@aquinofamily.test', type: 'individual' },
  { name: 'Diana Santos', company: 'Metro Retail Group', email: 'diana@metroretail.test', type: 'corporate' },
];

const EVENT_KINDS = [
  { type: 'Corporate Event', title: 'Annual Conference', categories: ['registration', 'catering'] },
  { type: 'Wedding', title: 'Wedding Reception', categories: ['florals', 'catering'] },
  { type: 'Corporate Event', title: 'Product Launch', categories: ['lights', 'registration'] },
  { type: 'Debut', title: 'Debut Celebration', categories: ['florals', 'photo'] },
  { type: 'Corporate Event', title: 'Year-End Party', categories: ['catering', 'lights'] },
  { type: 'Social Event', title: 'Anniversary Dinner', categories: ['florals', 'catering'] },
  { type: 'Corporate Event', title: 'Awards Night', categories: ['lights', 'photo'] },
  { type: 'Social Event', title: 'Birthday Gala', categories: ['catering', 'photo'] },
];

const VENUES = ['Grand Ballroom, Makati', 'Garden Pavilion, Tagaytay', 'Function Room A, BGC', 'Rooftop Deck, Pasay', 'Heritage Hall, Intramuros', 'Seaside Pavilion, Batangas'];
const GUESTS = ['Noel Reyes', 'Mara Dizon', 'Paolo Garcia', 'Iris Navarro', 'Ben Castillo', 'Celine Ortiz', 'Dante Flores', 'Gina Pascual'];

const NEW_CATEGORIES = [
  { id: 'supcat_hist_catering', slug: 'catering', name: 'Catering' },
  { id: 'supcat_hist_lights', slug: 'lights-and-sound', name: 'Lights and Sound' },
  { id: 'supcat_hist_photo', slug: 'photo-and-video', name: 'Photo and Video' },
];
const NEW_SUPPLIERS = [
  { id: 'sup_hist_feast', category_id: 'supcat_hist_catering', name: 'Feast Catering Co.', email: 'sales@feast.test', tier: 'tier_1' },
  { id: 'sup_hist_harvest', category_id: 'supcat_hist_catering', name: 'Harvest Table', email: 'hello@harvesttable.test', tier: 'tier_2' },
  { id: 'sup_hist_luma', category_id: 'supcat_hist_lights', name: 'Luma Lights and Sound', email: 'bookings@luma.test', tier: 'tier_1' },
  { id: 'sup_hist_frame', category_id: 'supcat_hist_photo', name: 'Frame and Co. Studios', email: 'studio@frameco.test', tier: 'tier_1' },
];
/** Category key to the suppliers that serve it; registration and florals reuse the accounts profile's suppliers. */
const SUPPLIERS_BY_CATEGORY = {
  registration: [{ id: 'sup_xperto', category_id: 'supcat_digital_registration', name: 'XPERTO Registration', category: 'Digital Registration' }],
  florals: [{ id: 'sup_bloom', category_id: 'supcat_production', name: 'Bloom Florals', category: 'Production' }],
  catering: [
    { id: 'sup_hist_feast', category_id: 'supcat_hist_catering', name: 'Feast Catering Co.', category: 'Catering' },
    { id: 'sup_hist_harvest', category_id: 'supcat_hist_catering', name: 'Harvest Table', category: 'Catering' },
  ],
  lights: [{ id: 'sup_hist_luma', category_id: 'supcat_hist_lights', name: 'Luma Lights and Sound', category: 'Lights and Sound' }],
  photo: [{ id: 'sup_hist_frame', category_id: 'supcat_hist_photo', name: 'Frame and Co. Studios', category: 'Photo and Video' }],
};

/** Deterministic pseudo-random numbers (mulberry32), so the same scenario date seeds the same history. */
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (next, list) => list[Math.floor(next() * list.length)];
const between = (next, low, high) => Math.round(low + next() * (high - low));
const roundTo = (value, step) => Math.round(value / step) * step;
const sql = (text) => ({ sql: text });
/** A timestamp relative to the scenario anchor (midnight Asia/Manila on the scenario date). */
const at = (days, hours = 0) => sql(`($1::timestamptz + interval '${days} days ${hours} hours')`);
/** A calendar date: the app stores date-only values (event dates, due dates) at UTC midnight, eight hours after Manila midnight. */
const day = (days) => at(days, 8);

function literal(value) {
  if (typeof value === 'object' && 'sql' in value) return value.sql;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  return `'${String(value).replaceAll("'", "''")}'`;
}

/** Null values are left out: a bare NULL in the seed's SELECT is typed text, so the column default applies instead. */
function row(table, data, identity, key = 'id') {
  const present = Object.entries(data).filter(([, value]) => value !== null);
  return { table, key, identity, columns: present.map(([column]) => column), select: present.map(([, value]) => literal(value)).join(', ') };
}

/** Where an event sits relative to the scenario date decides which records it has. */
export function historyStage(days) {
  if (days < -45) return 'archived';
  if (days < 0) return 'closure';
  if (days === 0) return 'live';
  if (days <= 75) return 'planning';
  if (days <= 200) return 'briefing';
  return 'inquiry';
}

/** The events of the five-year window: date offset, client, kind and amounts. */
export function historyEvents() {
  const events = [];
  for (let month = -HISTORY_WINDOW.monthsBack; month < HISTORY_WINDOW.monthsAhead; month += 1) {
    for (let slot = 0; slot < HISTORY_WINDOW.eventsPerMonth; slot += 1) {
      const seq = events.length + 1;
      const next = random(seq * 7919);
      const days = Math.round(month * DAYS_PER_MONTH) + 3 + slot * 7 + between(next, 0, 2);
      events.push(describeEvent(seq, days === 0 ? 1 : days, next));
    }
  }
  // Two events happen today, so live operations always has a live event: one is the client fixture account's.
  events.push(describeEvent(events.length + 1, 0, random(424242), 0));
  events.push(describeEvent(events.length + 1, 0, random(434343), 3));
  return events;
}

function describeEvent(seq, days, next, clientIndex) {
  const kind = pick(next, EVENT_KINDS);
  // Every fifth event belongs to the client fixture account, so the client portal has a history too.
  const client = clientIndex !== undefined ? CLIENTS[clientIndex] : seq % 5 === 0 ? CLIENTS[0] : CLIENTS[1 + (seq % (CLIENTS.length - 1))];
  const budget = roundTo(between(next, 450_000, 3_200_000), 10_000);
  const declined = days < 0 && seq % 11 === 0;
  const id = String(seq).padStart(3, '0');
  return {
    seq, id, days, kind, client, budget, declined, stage: declined ? 'declined' : historyStage(days),
    name: `${client.company} ${kind.title}`, venue: pick(next, VENUES), guestCount: roundTo(between(next, 80, 600), 10),
    rating: between(next, 3, 5), testimonial: next() < 0.6, next,
  };
}

function inquiryRow(event) {
  const { stage, days } = event;
  const accepted = !['declined', 'inquiry'].includes(stage) || event.seq % 3 === 0;
  const signed = !['declined', 'inquiry'].includes(stage);
  const status = stage === 'declined' ? 'declined' : accepted ? 'accepted' : event.seq % 2 === 0 ? 'pending' : 'new';
  const acceptedDay = days - 150;
  return row('event_lifecycle.inquiries', {
    id: `inq_hist_${event.id}`, client_name: event.client.name, company_name: event.client.company, email: event.client.email,
    event_name: event.name, event_type: event.kind.type, event_date: day(days), client_type: event.client.type, source: SEED_SOURCE,
    normalized_email: event.client.email, message: `Synthetic history inquiry for a ${event.kind.title.toLowerCase()} of about ${event.guestCount} guests.`,
    status, accepted_at: accepted ? at(acceptedDay) : null, declined_at: stage === 'declined' ? at(days - 170) : null,
    decline_reason: stage === 'declined' ? 'Date unavailable: PMCM was fully booked.' : null,
    conforme_sent_at: accepted ? at(acceptedDay) : null, conforme_signed_at: signed ? at(acceptedDay + 7) : null,
    portal_activated_at: signed ? at(acceptedDay + 7) : null, privacy_consent_accepted: true, privacy_notice_version: NOTICE,
    created_at: at(days - 180),
  }, ['email', 'source']);
}

const EVENT_STATE = {
  archived: { status: 'completed', readiness: 'Event complete', proposal: 'approved' },
  closure: { status: 'completed', readiness: 'Event complete', proposal: 'approved' },
  live: { status: 'event_day', readiness: 'Event day in progress', proposal: 'approved' },
  planning: { status: 'planning', readiness: 'Conforme complete', proposal: 'approved' },
  briefing: { status: 'briefing', readiness: 'Client briefing open', proposal: 'pending' },
};

function eventRows(event) {
  const state = EVENT_STATE[event.stage];
  const past = event.stage === 'archived' || event.stage === 'closure';
  const clientUser = event.client.userId ?? `usr_hist_client_${CLIENTS.indexOf(event.client)}`;
  return [
    row('event_lifecycle.events', {
      id: `evt_hist_${event.id}`, inquiry_id: `inq_hist_${event.id}`, client_name: event.client.name, event_name: event.name,
      event_date: day(event.days), status: state.status, client_portal_status: 'unlocked', readiness: state.readiness,
      proposal_client_status: state.proposal, actual_ended_at: past ? at(event.days, 20) : null,
      archived: event.stage === 'archived', archived_at: event.stage === 'archived' ? at(event.days + 21) : null,
      created_at: at(event.days - 143),
    }, ['inquiry_id']),
    row('event_lifecycle.conforme_executions', {
      id: `conf_hist_${event.id}`, inquiry_id: `inq_hist_${event.id}`, event_id: `evt_hist_${event.id}`, template_version: 1,
      template_content: CONFORME_TEXT, template_sha256: CONFORME_SHA, document_content: CONFORME_TEXT, document_sha256: CONFORME_SHA,
      status: 'completed', completed_at: at(event.days - 143),
    }, ['inquiry_id', 'event_id']),
    row('event_lifecycle.conforme_signatures', {
      id: `sig_hist_${event.id}_client`, execution_id: `conf_hist_${event.id}`, actor_id: clientUser, actor_role: 'client',
      actor_name: `${event.client.name} (history fixture)`, actor_email: event.client.email, consent_text_version: 'HISTORY-SEED-ONLY-v1',
      consent_text: 'History seed record only; this is not a legal signature or client consent.',
    }, ['execution_id', 'actor_id', 'actor_role', 'actor_email']),
  ];
}

function briefingRow(event) {
  const styling = roundTo(event.budget * 0.12, 5_000);
  return row('event_lifecycle.briefings', {
    id: `brief_hist_${event.id}`, event_id: `evt_hist_${event.id}`, venue: event.venue, guest_count: event.guestCount,
    budget_range: `PHP ${(roundTo(event.budget * 0.9, 50_000)).toLocaleString('en-PH')}–${(roundTo(event.budget * 1.1, 50_000)).toLocaleString('en-PH')}`,
    service_requirements: event.kind.categories.map((category) => SUPPLIERS_BY_CATEGORY[category][0].category),
    notes: 'Synthetic history briefing.', confirmed_date: day(event.days), confirmed_start_time: '17:00', confirmed_end_time: '22:00',
    program: [{ time: '17:00', activity: 'Registration' }, { time: '18:30', activity: 'Program' }, { time: '20:00', activity: 'Dinner and entertainment' }],
    mood_and_styling: pick(event.next, ['Warm modern Filipino', 'Classic black and gold', 'Garden pastels', 'Minimal white and greenery']),
    styling_budget: styling, submitted_at: at(event.days - 120),
  }, ['event_id']);
}

/** Selected suppliers: one quote request and selected quote per category, priced from the budget. */
function supplierLines(event) {
  return event.kind.categories.map((category, index) => {
    const supplier = SUPPLIERS_BY_CATEGORY[category][event.seq % SUPPLIERS_BY_CATEGORY[category].length];
    return { supplier, index, amount: roundTo(event.budget * (index === 0 ? 0.38 : 0.27), 5_000) };
  });
}

function supplierRows(event) {
  const settled = event.stage !== 'briefing';
  const past = event.stage === 'archived' || event.stage === 'closure';
  return supplierLines(event).flatMap(({ supplier, index, amount }) => {
    const requestId = `rq_hist_${event.id}_${index}`;
    const request = row('commercial.quote_requests', {
      id: requestId, event_id: `evt_hist_${event.id}`, supplier_id: supplier.id, category_id: supplier.category_id, supplier_name: supplier.name,
      category: supplier.category, message: `Quote request for ${event.name}.`, due_date: at(event.days - 100),
      access_token: sql("replace(gen_random_uuid()::text, '-', '')"), status: settled ? 'selected' : 'open',
      assignment_status: settled ? 'confirmed' : 'pending_confirmation', assignment_confirmed_at: settled ? at(event.days - 90) : null,
      readiness_status: settled ? 'confirmed' : 'not_requested', readiness_confirmed_at: settled ? at(event.days - 14) : null,
      event_day_status: past ? 'done_leaving' : 'not_started', event_day_status_at: past ? at(event.days, 23) : null, created_at: at(event.days - 110),
    }, ['event_id', 'supplier_id', 'category_id']);
    if (!settled) return [request];
    return [request, row('commercial.quotes', {
      id: `quote_hist_${event.id}_${index}`, event_id: `evt_hist_${event.id}`, request_id: requestId, supplier_id: supplier.id, category_id: supplier.category_id,
      supplier_name: supplier.name, category: supplier.category, amount, inclusions: [`${supplier.category} package`, 'On-site team'],
      payment_terms: '50% upon confirmation; balance after the event', notes: 'Synthetic history quote.', status: 'selected', revision_number: 1,
      selected_at: at(event.days - 92), locked_at: at(event.days - 92), created_at: at(event.days - 100), updated_at: at(event.days - 92),
    }, ['event_id', 'request_id', 'supplier_id', 'category_id'])];
  });
}

function proposalRows(event) {
  const lines = supplierLines(event);
  const fee = roundTo(event.budget * 0.15, 5_000);
  const total = lines.reduce((sum, line) => sum + line.amount, 0) + fee;
  const estimateId = `estimate_hist_${event.id}`;
  return {
    total,
    rows: [
      row('commercial.cost_estimates', { id: estimateId, event_id: `evt_hist_${event.id}`, budget_amount: event.budget, total_amount: total, status: 'ready', notes: 'Synthetic history estimate.', created_at: at(event.days - 95), updated_at: at(event.days - 95) }, ['event_id']),
      ...lines.map(({ supplier, index, amount }) => row('commercial.cost_estimate_lines', { id: `cel_hist_${event.id}_${index}`, estimate_id: estimateId, category: supplier.category, description: `${supplier.name} quote`, quantity: 1, unit_amount: amount, total_amount: amount }, ['estimate_id'])),
      row('commercial.cost_estimate_lines', { id: `cel_hist_${event.id}_fee`, estimate_id: estimateId, category: 'Management', description: 'PMCM event management fee', quantity: 1, unit_amount: fee, total_amount: fee }, ['estimate_id']),
      row('commercial.proposal_versions', { id: `proposal_hist_${event.id}`, event_id: `evt_hist_${event.id}`, cost_estimate_id: estimateId, version_number: 1, title: `${event.name} proposal`, summary: `Full event management for ${event.guestCount} guests at ${event.venue}.`, total_amount: total, status: 'issued', issued_at: at(event.days - 94), created_at: at(event.days - 94) }, ['event_id', 'cost_estimate_id']),
    ],
  };
}

/** Deposit and balance: past events are paid (the last month's balance is partly paid), upcoming events have paid deposits. */
function paymentState(event, which) {
  if (event.stage === 'archived') return { status: 'paid', share: 1 };
  if (event.stage === 'closure') return which === 'deposit' ? { status: 'paid', share: 1 } : event.seq % 2 ? { status: 'partially_paid', share: 0.5 } : { status: 'pending', share: 0 };
  if (which === 'deposit' && event.days <= 45) return { status: 'paid', share: 1 };
  return { status: 'pending', share: 0 };
}

function billingRows(event, total) {
  const statementId = `bill_hist_${event.id}`;
  const deposit = roundTo(total / 2, 1_000);
  const milestones = [
    { key: 'deposit', label: 'Deposit (50%)', amount: deposit, due: event.days - 30 },
    { key: 'balance', label: 'Balance (50%)', amount: total - deposit, due: event.days + 7 },
  ];
  const statement = row('commercial.billing_statements', {
    id: statementId, event_id: `evt_hist_${event.id}`, number: `HIST-${event.id}`, client_name: event.client.name, client_contact: event.client.email,
    event_name: event.name, event_date: day(event.days), line_items: [{ label: `${event.name} event management and suppliers`, amount: total }],
    payment_schedule: milestones.map((milestone) => ({ label: milestone.label, percentage: 50, amount: milestone.amount })),
    payment_methods: [{ label: 'Bank Transfer', details: 'Synthetic account 0000-0000' }], total_amount: total, status: 'sent',
    sent_at: at(event.days - 60), generated_at: at(event.days - 61),
  }, ['event_id']);
  return [statement, ...milestones.flatMap((milestone) => milestoneRows(event, statementId, milestone))];
}

function milestoneRows(event, statementId, milestone) {
  const { status, share } = paymentState(event, milestone.key);
  const paid = Math.round(milestone.amount * share);
  const milestoneId = `pm_hist_${event.id}_${milestone.key}`;
  const rows = [row('commercial.payment_milestones', {
    id: milestoneId, event_id: `evt_hist_${event.id}`, label: milestone.label, percentage: 50, amount: milestone.amount, amount_paid: paid,
    remaining_balance: milestone.amount - paid, due_date: day(milestone.due), status, statement_id: statementId, created_at: at(event.days - 60),
  }, ['event_id', 'statement_id'])];
  if (paid > 0) rows.push(row('commercial.payment_records', {
    id: `pay_hist_${event.id}_${milestone.key}`, event_id: `evt_hist_${event.id}`, milestone_id: milestoneId, amount_received: paid,
    payment_date: at(milestone.due - 3), payment_method: milestone.key === 'deposit' ? 'Bank Transfer' : 'Cheque',
    reference_number: `REF-HIST-${event.id}-${milestone.key.toUpperCase()}`, recorded_at: at(milestone.due - 2),
  }, ['event_id', 'milestone_id']));
  return rows;
}

const COORDINATORS = [
  { id: 'coord_marco', name: 'Marco Santos', userId: 'usr_coord', role: 'General Coordinator' },
  { id: 'coord_juan', name: 'Juan Pascual', userId: null, role: 'General Coordinator' },
  { id: 'coord_bianca', name: 'Bianca Lim', userId: null, role: 'Registration Staff' },
];

function staffingRows(event) {
  const past = event.stage === 'archived' || event.stage === 'closure';
  // Today's two events take different general coordinators; history alternates between them.
  const lead = event.days === 0 ? COORDINATORS[event.client.userId ? 0 : 1] : COORDINATORS[event.seq % 2];
  return [lead, COORDINATORS[2]].map((coordinator) => row('operations.coordinator_assignments', {
    id: `coord_asg_hist_${event.id}_${coordinator.id}`, event_id: `evt_hist_${event.id}`, coordinator_id: coordinator.id, coordinator_name: coordinator.name,
    role: coordinator.role, status: 'acknowledged', attendance_status: past ? 'present' : 'pending', attendance_marked_at: past ? at(event.days, 16) : null,
    event_date: day(event.days), acknowledged_at: at(event.days - 30), acknowledged_by: coordinator.userId ?? coordinator.id,
    acknowledgement_reason: 'Acknowledged history fixture assignment.', created_at: at(event.days - 31),
  }, ['event_id', 'coordinator_id']));
}

function guestRows(event) {
  const live = event.stage === 'live';
  const guests = [0, 1, 2].map((index) => GUESTS[(event.seq + index) % GUESTS.length]);
  const checkIns = guests.map((guest, index) => row('operations.check_ins', {
    id: `checkin_hist_${event.id}_${index}`, event_id: `evt_hist_${event.id}`, guest_name: guest, check_in_mode: 'name_search', status: 'checked_in',
    walk_in: index === 2, verification_status: 'verified', privacy_consent_accepted: true, privacy_notice_version: NOTICE,
    privacy_consent_captured_at: live ? sql(`now() - interval '${index + 1} hours'`) : at(event.days, 17), checked_in_at: live ? sql(`now() - interval '${index + 1} hours'`) : at(event.days, 17),
  }, ['event_id']));
  if (live) return checkIns;
  return [...checkIns, row('operations.feedback', {
    id: `feedback_hist_${event.id}`, event_id: `evt_hist_${event.id}`, guest_name: guests[0], rating: event.rating,
    comment: 'Smooth registration and a well-run program.', privacy_consent_accepted: true, privacy_notice_version: NOTICE,
    moderation_status: event.stage === 'archived' ? 'approved' : 'pending_review', submitted_at: at(event.days + 1),
  }, ['event_id'])];
}

function closeoutRow(event) {
  const consent = event.testimonial;
  return row('event_lifecycle.client_closeout_responses', {
    id: `closeout_hist_${event.id}`, event_id: `evt_hist_${event.id}`, rating: event.rating, feedback: 'The team handled every detail; suppliers arrived on time.',
    testimonial: consent ? `PMCM made our ${event.kind.title.toLowerCase()} effortless. We would book them again.` : '', testimonial_consent: consent,
    moderation_status: consent && event.stage === 'archived' ? 'approved' : 'pending', actor_id: event.client.userId ?? `usr_hist_client_${CLIENTS.indexOf(event.client)}`,
    actor_email: event.client.email, submitted_at: at(event.days + 3), updated_at: at(event.days + 3),
  }, ['event_id']);
}

/** The records an event has at its stage. */
function rowsForEvent(event) {
  const inquiry = inquiryRow(event);
  if (event.stage === 'declined' || event.stage === 'inquiry') return [inquiry];
  const rows = [inquiry, ...eventRows(event), briefingRow(event), ...supplierRows(event)];
  if (event.stage === 'briefing') return rows;
  const proposal = proposalRows(event);
  rows.push(...proposal.rows, ...billingRows(event, proposal.total), ...staffingRows(event));
  if (event.stage === 'planning') return rows;
  rows.push(...guestRows(event));
  // About seven in ten past clients answered the closeout survey.
  if (event.stage !== 'live' && event.seq % 10 < 7) rows.push(closeoutRow(event));
  return rows;
}

export const historyRows = [
  ...NEW_CATEGORIES.map((category) => row('commercial.supplier_categories', category, ['slug'])),
  ...NEW_SUPPLIERS.map((supplier) => row('commercial.suppliers', supplier, ['email', 'category_id'])),
  ...historyEvents().flatMap(rowsForEvent),
];
