import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { NO_FAULTS } from '../src/base/faults.ts';
import { loadConfig } from '../src/config.ts';

// The simulator reads its environment once, at start, and stops on a bad
// value; the secrets are 32 bytes and never the same (EXT-01, EXT-09).
const key = () => randomBytes(32).toString('base64');

function env(changes: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    SIMULATOR_DATABASE_URL: 'postgres://u:p@localhost:5432/nextbank',
    SIMULATOR_PARTICIPANT_KEY: key(),
    SIMULATOR_WEBHOOK_SECRET: key(),
    SIMULATOR_WEBHOOK_URL: 'http://127.0.0.1:3000/v1/spi/webhooks',
    ...changes,
  };
}

describe('loadConfig', () => {
  it('reads a complete environment, with no faults and port 4000 by default', () => {
    const config = loadConfig(env({ SIMULATOR_SEED: '7' }));

    expect(config.faults).toEqual(NO_FAULTS);
    expect(config.seed).toBe(7);
    expect(config.port).toBe(4000);
    expect(config.webhook.secret).toHaveLength(32);
  });

  it('reads the fault profile', () => {
    const config = loadConfig(env({ SIMULATOR_FAULTS: '{"errorRate":0.3}' }));

    expect(config.faults.errorRate).toBe(0.3);
  });

  it.each([
    ['no participant key', { SIMULATOR_PARTICIPANT_KEY: undefined }],
    ['a short participant key', { SIMULATOR_PARTICIPANT_KEY: 'short' }],
    ['no webhook secret', { SIMULATOR_WEBHOOK_SECRET: undefined }],
    ['no webhook URL', { SIMULATOR_WEBHOOK_URL: undefined }],
    ['a bad fault profile', { SIMULATOR_FAULTS: '{"errorRate":2}' }],
  ])('refuses %s', (_case, changes) => {
    expect(() => loadConfig(env(changes))).toThrow();
  });

  it('refuses the same secret for the key and the webhooks', () => {
    const same = key();

    expect(() =>
      loadConfig(env({ SIMULATOR_PARTICIPANT_KEY: same, SIMULATOR_WEBHOOK_SECRET: same })),
    ).toThrow(/must differ/);
  });
});
