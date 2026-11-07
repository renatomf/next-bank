import {
  type ApprovalRequestsPage,
  type ReconciliationExceptionsPage,
  SessionEnded,
} from '@/lib/api';

/** A block's list, or the mark that it could not be read this time. */
export type Loaded<T> = { ok: true; value: T } | { ok: false };

export interface Home {
  /** The analyst's: every pending request, which someone else asked (B6). */
  awaiting?: Loaded<ApprovalRequestsPage>;
  /** The operator's: what they asked, pending and the last ones. */
  mine?: Loaded<{ pending: ApprovalRequestsPage; recent: ApprovalRequestsPage }>;
  exceptions?: Loaded<ReconciliationExceptionsPage>;
}

interface HomeApi {
  listRequests(
    status: 'PENDING' | 'ALL',
    cursor: string | null,
    options?: { mine?: boolean },
  ): Promise<ApprovalRequestsPage>;
  listExceptions(
    status: 'OPEN' | 'ALL',
    cursor: string | null,
  ): Promise<ReconciliationExceptionsPage>;
}

// The blocks of each role; the API decides, this only spares a 403 (STF-02).
const DECIDES = ['ANALYST'];
const ASKS = ['OPERATOR'];
const READS_EXCEPTIONS = ['OPERATOR', 'ANALYST'];

const nothing = Promise.resolve(undefined);

/**
 * What the home shows for a role (home plan): only the lists of its blocks,
 * read side by side, each on its own, so one failing block leaves the others.
 */
export async function loadHome(api: HomeApi, role: string): Promise<Home> {
  const [awaiting, mine, exceptions] = await Promise.allSettled([
    DECIDES.includes(role) ? api.listRequests('PENDING', null) : nothing,
    ASKS.includes(role)
      ? Promise.all([
          api.listRequests('PENDING', null, { mine: true }),
          api.listRequests('ALL', null, { mine: true }),
        ]).then(([pending, recent]) => ({ pending, recent }))
      : nothing,
    READS_EXCEPTIONS.includes(role) ? api.listExceptions('OPEN', null) : nothing,
  ]);
  const home: Home = {};
  const awaitingBlock = loadedOf(awaiting);
  const mineBlock = loadedOf(mine);
  const exceptionsBlock = loadedOf(exceptions);
  if (awaitingBlock) home.awaiting = awaitingBlock;
  if (mineBlock) home.mine = mineBlock;
  if (exceptionsBlock) home.exceptions = exceptionsBlock;
  return home;
}

/** A block's list, its failure, or nothing for a block the role does not have. */
function loadedOf<T>(result: PromiseSettledResult<T | undefined>): Loaded<T> | undefined {
  if (result.status === 'rejected') {
    // The session ended: the visit goes back to the login, not to a block's warning.
    if (result.reason instanceof SessionEnded) throw result.reason;
    return { ok: false };
  }
  return result.value === undefined ? undefined : { ok: true, value: result.value };
}
