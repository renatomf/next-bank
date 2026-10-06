import { validate, version } from 'uuid';
import { describe, expect, it } from 'vitest';
import { SystemClock, UuidV7Generator } from '../../src/shared/infrastructure/system-ports.ts';

describe('SystemClock', () => {
  it('returns the current time', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});

describe('UuidV7Generator', () => {
  it('generates valid version 7 UUIDs (database.md, section 3)', () => {
    const id = new UuidV7Generator().next();

    expect(validate(id)).toBe(true);
    expect(version(id)).toBe(7);
  });

  it('generates ids that sort in creation order, which keeps indexes compact', () => {
    const ids = new UuidV7Generator();
    const generated = Array.from({ length: 1_000 }, () => ids.next());

    expect([...generated].sort()).toEqual(generated);
    expect(new Set(generated).size).toBe(generated.length);
  });
});
