import { describe, expect, it } from 'vitest';
import { Faults, NO_FAULTS, parseFaultProfile, seededRandom } from '../../src/base/faults.ts';

// Injected faults (v1.2.0 plan, D5): drawn from a seeded generator, so a test
// with 30% of faults gives the same faults every run.
describe('seededRandom', () => {
  it('gives the same numbers for the same seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);

    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('stays in [0, 1) and spreads', () => {
    const random = seededRandom(7);
    const draws = Array.from({ length: 10_000 }, random);

    expect(draws.every((n) => n >= 0 && n < 1)).toBe(true);
    const mean = draws.reduce((sum, n) => sum + n, 0) / draws.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});

describe('parseFaultProfile', () => {
  it('reads no faults when nothing is set', () => {
    expect(parseFaultProfile(undefined)).toEqual(NO_FAULTS);
  });

  it('reads the rates and times given, the rest staying at zero', () => {
    expect(parseFaultProfile('{"errorRate":0.3,"latencyMs":200}')).toEqual({
      ...NO_FAULTS,
      errorRate: 0.3,
      latencyMs: 200,
    });
  });

  it.each([
    ['a rate above 1', '{"errorRate":1.5}'],
    ['a negative rate', '{"timeoutRate":-0.1}'],
    ['a negative time', '{"latencyMs":-1}'],
    ['an unknown fault', '{"chaos":1}'],
    ['what is not JSON', 'not json'],
  ])('refuses %s', (_case, raw) => {
    expect(() => parseFaultProfile(raw)).toThrow();
  });
});

describe('Faults', () => {
  it('injects nothing without faults', () => {
    const faults = new Faults(NO_FAULTS, seededRandom(1));

    for (let i = 0; i < 100; i++) {
      expect(faults.requestFault()).toBeNull();
      expect(faults.rejects()).toBe(false);
      expect(faults.webhookDeliveries()).toBe(1);
    }
  });

  it('injects each fault about as often as asked', () => {
    const faults = new Faults(
      { ...NO_FAULTS, errorRate: 0.2, timeoutRate: 0.1, webhookLossRate: 0.3 },
      seededRandom(3),
    );
    const requests = Array.from({ length: 10_000 }, () => faults.requestFault());
    const webhooks = Array.from({ length: 10_000 }, () => faults.webhookDeliveries());

    const share = <T>(list: T[], value: T) => list.filter((x) => x === value).length / list.length;
    expect(share(requests, 'ERROR')).toBeCloseTo(0.2, 1);
    expect(share(requests, 'TIMEOUT')).toBeCloseTo(0.1, 1);
    expect(share(webhooks, 0)).toBeCloseTo(0.3, 1);
  });

  it('duplicates a webhook when asked', () => {
    const faults = new Faults({ ...NO_FAULTS, webhookDuplicateRate: 1 }, seededRandom(5));

    expect(faults.webhookDeliveries()).toBe(2);
  });

  it('gives the same faults for the same seed', () => {
    const profile = { ...NO_FAULTS, errorRate: 0.3, rejectRate: 0.3 };
    const a = new Faults(profile, seededRandom(9));
    const b = new Faults(profile, seededRandom(9));
    const draw = (f: Faults) =>
      Array.from({ length: 50 }, () => [f.requestFault(), f.rejects()] as const);

    expect(draw(a)).toEqual(draw(b));
  });
});
