import { describe, expect, it } from 'vitest';
import { parseTrustProxySetting } from './trust-proxy-setting';

describe('parseTrustProxySetting', () => {
  it.each([
    ['false', false],
    ['true', true],
    ['loopback', 'loopback'],
    ['0', 0],
    ['1', 1],
    [' 2 ', 2],
  ])('accepts %j as %j', (raw, expected) => {
    expect(parseTrustProxySetting(raw)).toBe(expected);
  });

  it.each([undefined, '', '   ', 'yes', '-1', '1.5', '10.0.0.0/8', 'FALSE'])(
    'refuses %j and names the variable and the accepted values',
    (raw) => {
      expect(() => parseTrustProxySetting(raw)).toThrow(/PRISM_TRUST_PROXY is required and must be false, true, loopback, or a hop count/);
    },
  );
});
