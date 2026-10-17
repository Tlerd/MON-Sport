import { describe, expect, it } from 'vitest';
import { ipBucket } from './throttle.service.js';

describe('ipBucket', () => {
  it('keeps an IPv4 address, also when IPv6 maps it', () => {
    expect(ipBucket('203.0.113.7')).toBe('203.0.113.7');
    expect(ipBucket('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('keys an IPv6 address by its /64 block, in any notation', () => {
    expect(ipBucket('2001:db8:1:2::a')).toBe('2001:db8:1:2::/64');
    expect(ipBucket('2001:0db8:0001:0002:ffff:0:0:1')).toBe('2001:db8:1:2::/64');
    expect(ipBucket('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(ipBucket('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(ipBucket('::1')).toBe('0:0:0:0::/64');
  });

  it('puts a request without an address in one bucket', () => {
    expect(ipBucket(undefined)).toBe('unknown');
  });
});
