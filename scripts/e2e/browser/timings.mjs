import { performance } from 'node:perf_hooks';

export function browserTimings({ now = () => performance.now(), log = console.log } = {}) {
  const phases = [];
  return {
    phases,
    async measure(phase, action) {
      const start = now();
      let status = 'failed';
      try {
        const value = await action();
        status = 'passed';
        return value;
      } finally {
        const durationMs = Math.round(now() - start);
        phases.push({ phase, durationMs, status });
        log(`Browser timing ${phase}: ${durationMs}ms (${status})`);
      }
    },
  };
}
