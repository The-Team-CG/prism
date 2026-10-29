import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DASHBOARD_ROUTE_ITEMS, CLIENT_DETAIL_ROUTE_ITEMS, EVENT_WORKSPACE_ROUTE_TABS, SECTION_ROUTE_ITEMS } from '../../../apps/event/src/features/event-dashboard/shell/model/event-dashboard-routing.ts';
import { CLIENT_PORTAL_VIEW_HREFS, ROUTE_TO_DETAIL_TAB, dashboardHref } from '../../../apps/client/src/features/client-dashboard/workspace/model/client-dashboard-navigation.ts';

export function routeTemplates(app) {
  const root = join('apps', app, 'src/app');
  return readdirSync(root, { recursive: true }).filter(file => /(^|[\\/])page\.tsx$/.test(file)).map(file => {
    const parts = file.replaceAll('\\', '/').split('/').filter(part => !part.startsWith('(') && part !== 'page.tsx');
    return '/' + parts.join('/');
  });
}

export function pageCoverageCases(app, fixture) {
  const cases = [];
  const add = (template, path, state = 'ready') => cases.push({ template, path, state });
  for (const template of routeTemplates(app)) {
    if (!template.includes('[')) {
      add(template, template, /activate|conforme/.test(template) ? 'link-or-access-state' : 'ready');
      continue;
    }
    if (app === 'client' && /\[(approvalView|billingView|calendarView|fileView|messageView)\]/.test(template)) {
      const prefix = template.slice(0, template.lastIndexOf('/')) + '/';
      for (const path of Object.values(CLIENT_PORTAL_VIEW_HREFS).filter(path => path.startsWith(prefix))) add(template, path);
      continue;
    }
    if (app === 'event') {
      const view = template.match(/\[(dashboardView|calendarView|clientView|fileView|financeView|messageView|settingView|supplierView|taskView|teamView|eventView)\]/)?.[1];
      if (view) {
        const section = template.split('/')[2];
        const choices = view === 'dashboardView' ? Object.keys(DASHBOARD_ROUTE_ITEMS)
          : view === 'clientView' ? Object.keys(CLIENT_DETAIL_ROUTE_ITEMS)
            : view === 'eventView' ? Object.keys(EVENT_WORKSPACE_ROUTE_TABS)
              : Object.keys(SECTION_ROUTE_ITEMS[section] ?? {});
        if (!choices.length) throw new Error(`No registered variants for ${template}`);
        for (const choice of choices) add(template, template.replace(`[${view}]`, choice).replace('[clientId]', fixture.clientId).replace('[eventSlug]', fixture.eventId));
        continue;
      }
    }
    if (template.endsWith('/[section]')) {
      const sections = app === 'supplier' ? ['requests', 'bookings', 'calendar', 'quotations', 'messages', 'files', 'payments', 'profile', 'support'] : Object.keys(ROUTE_TO_DETAIL_TAB);
      for (const section of sections) add(template, app === 'client' ? dashboardHref(section, fixture.eventId) : template.replace('[section]', section));
      continue;
    }
    let path = template.replace('[clientId]', fixture.clientId).replace('[eventId]', fixture.eventId).replace('[eventSlug]', app === 'guest' ? fixture.guestLobbySlug ?? fixture.eventId : fixture.eventId);
    if (path.includes('[token]')) path = path.replace('[token]', fixture.quoteToken);
    if (path.includes('[draftId]')) {
      for (const snapshot of ['submitted', 'approved']) add(template, path.replace('[draftId]', fixture.draftId).replace('[snapshotType]', snapshot));
      continue;
    }
    if (path.includes('[sessionId]')) {
      if (fixture.gameSessionId) add(template, path.replace('[sessionId]', fixture.gameSessionId));
      add(template, path.replace('[sessionId]', 'unavailable-audit-session'), 'unavailable-session');
      continue;
    }
    if (path.includes('[')) throw new Error(`Unresolved route ${template}`);
    add(template, path);
  }
  const missing = routeTemplates(app).filter(template => !cases.some(item => item.template === template));
  if (missing.length) throw new Error(`Uncovered page templates: ${missing.join(', ')}`);
  return cases.filter((item, index) => cases.findIndex(other => other.path === item.path) === index);
}
