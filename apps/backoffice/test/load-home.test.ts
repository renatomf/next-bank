import { describe, expect, it } from 'vitest';
import { loadHome } from '../features/home/load-home';
import { SessionEnded } from '../lib/api';

// What the home reads for each role (home plan): only the lists of the
// blocks the role has, each on its own, so that one failing block leaves
// the others (allSettled); a session the API refused still ends the visit.
const page = { items: [], nextCursor: null };

function fakeApi(fail: Partial<Record<'requests' | 'exceptions', Error>> = {}) {
  const calls: string[] = [];
  return {
    calls,
    api: {
      listRequests(status: 'PENDING' | 'ALL', cursor: string | null, options?: { mine?: boolean }) {
        calls.push(`requests ${status}${options?.mine === true ? ' mine' : ''}`);
        return fail.requests ? Promise.reject(fail.requests) : Promise.resolve(page);
      },
      listExceptions(status: 'OPEN' | 'ALL') {
        calls.push(`exceptions ${status}`);
        return fail.exceptions ? Promise.reject(fail.exceptions) : Promise.resolve(page);
      },
    },
  };
}

describe('loadHome', () => {
  it("reads the analyst's queue and the open exceptions", async () => {
    const { api, calls } = fakeApi();

    const home = await loadHome(api, 'ANALYST');

    expect(calls.sort()).toEqual(['exceptions OPEN', 'requests PENDING']);
    expect(home).toEqual({
      awaiting: { ok: true, value: page },
      exceptions: { ok: true, value: page },
    });
  });

  it("reads the operator's own requests, pending and all, and the open exceptions", async () => {
    const { api, calls } = fakeApi();

    const home = await loadHome(api, 'OPERATOR');

    expect(calls.sort()).toEqual(['exceptions OPEN', 'requests ALL mine', 'requests PENDING mine']);
    expect(home).toEqual({
      mine: { ok: true, value: { pending: page, recent: page } },
      exceptions: { ok: true, value: page },
    });
  });

  // STF-02: the admin reads no customer's request nor exception.
  it('reads nothing for the admin', async () => {
    const { api, calls } = fakeApi();

    expect(await loadHome(api, 'ADMIN')).toEqual({});
    expect(calls).toEqual([]);
  });

  it('marks the block that failed and keeps the others', async () => {
    const { api } = fakeApi({ exceptions: new Error('timeout') });

    const home = await loadHome(api, 'ANALYST');

    expect(home).toEqual({
      awaiting: { ok: true, value: page },
      exceptions: { ok: false },
    });
  });

  it('ends the visit when the API no longer takes the session', async () => {
    const { api } = fakeApi({ requests: new SessionEnded() });

    await expect(loadHome(api, 'OPERATOR')).rejects.toBeInstanceOf(SessionEnded);
  });
});
