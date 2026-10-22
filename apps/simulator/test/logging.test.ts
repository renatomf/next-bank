import { afterAll, describe, expect, it } from 'vitest';
import { testPool } from './helpers.ts';
import { participantKey, simulatorFor, withKey } from './support.ts';

// What the simulator logs (API-04, MOB-02): the DICT key in the path is a
// Pix key, personal data even when made up, so the request log masks it, as
// the API keeps searched names out of its logs (READ-06); the participant's
// key never shows.
const pool = testPool();
let raw = '';
const app = simulatorFor(pool, {
  logStream: {
    write: (line: string) => {
      raw += line;
    },
  },
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('the request log', () => {
  it('masks the key asked of the DICT', async () => {
    await app.inject({ method: 'GET', url: '/dict/keys/31840725680', headers: withKey });
    await app.inject({
      method: 'GET',
      url: '/dict/keys/clara.aurora%40example.com',
      headers: withKey,
    });

    expect(raw).toContain('/dict/keys/[REDACTED]');
    expect(raw).not.toContain('31840725680');
    expect(raw).not.toContain('clara.aurora');
  });

  it("never shows the participant's key", async () => {
    await app.inject({ method: 'GET', url: '/settlements/2026-10-22', headers: withKey });

    expect(raw).toContain('/settlements/2026-10-22');
    expect(raw).not.toContain(participantKey);
  });
});
