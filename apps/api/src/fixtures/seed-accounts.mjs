export const fixtureAccounts = [
  ['usr_pmcm', 'Ms. Mys', 'mys@pmcm.test', 'pmcm-admin', 'PMCM Events', 'ADMIN'],
  ['usr_pmcm_approver', 'PMCM Approver', 'approver@pmcm.test', 'pmcm-admin', 'PMCM Events', 'ADMIN'],
  ['usr_client', 'Ana Reyes', 'ana@ayala.test', 'client', 'Ayala Corp', 'CLIENT'],
  ['usr_coord', 'Marco Santos', 'marco@pmcm.test', 'coordinator', 'PMCM Events', 'COORDINATOR'],
  ['usr_supplier', 'XPERTO Registration', 'ops@xperto.test', 'supplier', 'XPERTO Registration', 'SUPPLIER'],
  ['usr_supplier_bloom', 'Bloom Florals', 'flowers@bloom.test', 'supplier', 'Bloom Florals', 'SUPPLIER'],
];

function row(table, data, identity, passwordKey) {
  const columns = Object.keys(data);
  return {
    table, key: 'id', columns, identity, passwordKey,
    select: Object.values(data).map(sqlValue).join(', '),
  };
}

function sqlValue(value) {
  if (Array.isArray(value)) return `ARRAY[${value.map(sqlValue).join(', ')}]::text[]`;
  if (value === '$password') return '$2::text';
  return `'${value.replaceAll("'", "''")}'`;
}

export const accountRows = [
  ...fixtureAccounts.map(([id, name, email, role, organization, passwordKey]) => row('identity_access.users', {
    id, name, email, role, organization, password: '$password', approval_status: 'approved',
  }, ['email', 'role'], passwordKey)),
  row('commercial.supplier_categories', { id: 'supcat_digital_registration', slug: 'digital-registration', name: 'Digital Registration' }, ['slug']),
  row('commercial.supplier_categories', { id: 'supcat_production', slug: 'production', name: 'Production' }, ['slug']),
  row('commercial.suppliers', { id: 'sup_xperto', category_id: 'supcat_digital_registration', name: 'XPERTO Registration', email: 'ops@xperto.test', tier: 'tier_1' }, ['email', 'category_id']),
  row('commercial.suppliers', { id: 'sup_bloom', category_id: 'supcat_production', name: 'Bloom Florals', email: 'flowers@bloom.test', tier: 'tier_2' }, ['email', 'category_id']),
  row('operations.coordinators', { id: 'coord_marco', user_id: 'usr_coord', name: 'Marco Santos', email: 'marco@pmcm.test', role_tags: ['General Coordinator', 'Event Day System Operator', 'Floor Director'], skills_tags: ['event-day', 'vendor-coordination'] }, ['user_id', 'email']),
  row('operations.coordinators', { id: 'coord_juan', name: 'Juan Pascual', email: 'juan@pmcm.test', role_tags: ['General Coordinator', 'Ingress and Egress Assistant'], skills_tags: ['logistics', 'vendor-coordination'] }, ['email']),
  row('operations.coordinators', { id: 'coord_bianca', name: 'Bianca Lim', email: 'bianca@pmcm.test', role_tags: ['Registration Staff', 'Stage Director'], skills_tags: ['guest-check-in'] }, ['email']),
];
