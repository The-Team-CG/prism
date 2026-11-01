export const pageCoverageApps = ['client', 'supplier', 'event', 'guest'];

const caseKey = ({ template, path }) => `${template}\0${path}`;

export function validatedPageCoverageCases(templates, cases) {
  const unresolved = cases.find(item => /\[[^\]]+\]/.test(item.path));
  if (unresolved) throw new Error(`Unresolved route ${unresolved.template}`);
  const missing = templates.filter(template => !cases.some(item => item.template === template));
  if (missing.length) throw new Error(`Uncovered page templates: ${missing.join(', ')}`);
  return [...new Map(cases.map(item => [caseKey(item), item])).values()];
}

export function assertPageCoverageComplete(cases, records) {
  const passed = new Set(records.filter(item => item.result === 'passed').map(caseKey));
  const missing = cases.filter(item => !passed.has(caseKey(item)));
  if (missing.length) throw new Error(`Page coverage did not pass ${missing.length} expected routes: ${missing.map(item => item.template).join(', ')}`);
}
