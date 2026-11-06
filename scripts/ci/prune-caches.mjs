import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dependencyCacheKeys } from './dependency-cache.mjs';

const kind = key => key.startsWith('prism-deps-v1-') ? 'dependencies'
  : key.startsWith('prism-playwright-v1-') ? 'browser' : key.startsWith('turbo-v2-') ? 'legacy' : null;

export function cachePruningPlan(caches, { budgetBytes = 8 * 1024 ** 3, keepKeys = [], ref = 'refs/heads/staging' } = {}) {
  if (!Number.isSafeInteger(budgetBytes) || budgetBytes < 0) throw new Error('Invalid cache budget.');
  for (const cache of caches) {
    if (!Number.isSafeInteger(cache.id) || cache.id < 1 || typeof cache.key !== 'string'
      || !Number.isSafeInteger(cache.size_in_bytes) || cache.size_in_bytes < 0
      || !Number.isFinite(Date.parse(cache.last_accessed_at))) throw new Error('Invalid cache inventory.');
  }
  const protectedCache = cache => cache.ref === ref && keepKeys.includes(cache.key);
  const ordered = [...caches].sort((a, b) => Number(protectedCache(b)) - Number(protectedCache(a))
    || Date.parse(b.last_accessed_at) - Date.parse(a.last_accessed_at) || b.id - a.id);
  const remove = new Set(ordered.filter(cache => kind(cache.key) === 'legacy').map(cache => cache.id));
  for (const category of ['dependencies', 'browser']) {
    const entries = ordered.filter(cache => kind(cache.key) === category);
    for (const cache of entries.slice(2)) if (!protectedCache(cache)) remove.add(cache.id);
  }
  let remainingBytes = caches.filter(cache => !remove.has(cache.id)).reduce((sum, cache) => sum + cache.size_in_bytes, 0);
  for (const cache of [...ordered].reverse()) {
    if (remainingBytes <= budgetBytes) break;
    if (remove.has(cache.id) || !kind(cache.key) || protectedCache(cache)) continue;
    remove.add(cache.id);
    remainingBytes -= cache.size_in_bytes;
  }
  return { remove: caches.filter(cache => remove.has(cache.id)), remainingBytes,
    reclaimedBytes: caches.filter(cache => remove.has(cache.id)).reduce((sum, cache) => sum + cache.size_in_bytes, 0) };
}

export async function pruneCaches({ repository, token, event, ref, keepKeys, request = fetch, log = console.log }) {
  if (event !== 'push' || ref !== 'refs/heads/staging') throw new Error('Cache maintenance only runs after a trusted staging push.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '') || !token) throw new Error('Missing cache-maintenance identity.');
  const endpoint = `https://api.github.com/repos/${repository}/actions/caches`;
  const options = { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' } };
  const caches = [];
  for (let page = 1; ; page += 1) {
    const response = await request(`${endpoint}?per_page=100&page=${page}`, options);
    if (!response.ok) throw new Error(`Cache inventory failed (${response.status}).`);
    const data = await response.json();
    if (!Array.isArray(data.actions_caches)) throw new Error('Invalid cache inventory response.');
    caches.push(...data.actions_caches);
    if (data.actions_caches.length < 100) break;
  }
  const plan = cachePruningPlan(caches, { keepKeys, ref });
  for (const cache of plan.remove) {
    const response = await request(`${endpoint}/${cache.id}`, { ...options, method: 'DELETE' });
    if (!response.ok && response.status !== 404) throw new Error(`Owned cache deletion failed (${response.status}).`);
  }
  log(`Removed ${plan.remove.length} superseded owned caches; reclaimed ${plan.reclaimedBytes} bytes. Inventory remaining: ${plan.remainingBytes} bytes.`);
  if (plan.remainingBytes > 8 * 1024 ** 3) log('::warning::Cache target remains exceeded by protected or unrelated entries. No paid storage limits were changed.');
  return plan;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const keys = dependencyCacheKeys(resolve(fileURLToPath(new URL('../../', import.meta.url))));
  await pruneCaches({ repository: process.env.GITHUB_REPOSITORY, token: process.env.GITHUB_TOKEN,
    event: process.env.GITHUB_EVENT_NAME, ref: process.env.GITHUB_REF, keepKeys: Object.values(keys) });
}
