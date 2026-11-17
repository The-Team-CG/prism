import { describe, expect, it } from 'vitest';
import { deviceName } from './device-name';

describe('deviceName', () => {
  it('names the browser and system in plain words, and says so when it cannot tell', () => {
    expect(deviceName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36')).toBe('Chrome on Windows');
    expect(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe('Safari on iOS');
    expect(deviceName('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/131.0 Safari/537.36 Edg/131.0')).toBe('Edge on Windows');
    expect(deviceName('curl/8.0')).toBe('Unknown device');
    expect(deviceName(undefined)).toBe('Unknown device');
  });
});
