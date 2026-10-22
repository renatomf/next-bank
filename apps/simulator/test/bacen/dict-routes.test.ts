import { afterAll, describe, expect, it } from 'vitest';
import { testPool } from '../helpers.ts';
import { AURORA_KEY, simulatorFor, withKey } from '../support.ts';

// The DICT of the simulated Bacen (v1.2.0 plan, task 1): a key of another
// (made-up) bank gives the bank and the owner, the document masked; the
// participant's key is asked (EXT-09).
const pool = testPool();
const app = simulatorFor(pool);

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('GET /dict/keys/:key', () => {
  it('gives the bank and the masked owner of a key', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/dict/keys/${encodeURIComponent(AURORA_KEY)}`,
      headers: withKey,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      key: AURORA_KEY,
      keyType: 'EMAIL',
      bank: { ispb: '99900001', name: 'Banco Aurora' },
      owner: { name: 'Clara Aurora Teixeira', documentMasked: '***.407.256-**' },
    });
  });

  it('answers a key no bank holds as not found', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/dict/keys/nobody%40example.com',
      headers: withKey,
    });

    expect(response.statusCode).toBe(404);
  });

  it.each([
    ['no key', {}],
    ['another key', { 'x-participant-key': 'not-the-key' }],
  ])('refuses %s of the participant (EXT-09)', async (_case, headers) => {
    const response = await app.inject({
      method: 'GET',
      url: `/dict/keys/${encodeURIComponent(AURORA_KEY)}`,
      headers,
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).not.toContain('Clara');
  });
});
