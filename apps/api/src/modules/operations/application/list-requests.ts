import { NotFound } from '../../../shared/domain/not-found.ts';
import type { RequestPosition, StaffReader } from './ports.ts';
import { type CommandDependencies, type RequestView, viewOf, viewsOf } from './staff-commands.ts';

const PAGE_SIZE = 20;

export interface RequestsPage {
  items: RequestView[];
  next: RequestPosition | null;
}

/**
 * The requests queue (v1.3.0 plan, task 4): newest first, pending only or
 * all of them, a page at a time; the demo staff sees the demo ones only.
 */
export class ListRequests {
  readonly #deps: CommandDependencies;

  constructor(deps: CommandDependencies) {
    this.#deps = deps;
  }

  execute(
    actor: StaffReader,
    input: { status: 'PENDING' | 'ALL'; after: RequestPosition | null },
  ): Promise<RequestsPage> {
    const now = this.#deps.clock.now();
    return this.#deps.unitOfWork.run(async (tx) => {
      const found = await this.#deps.repositories.for(tx).requests.list({
        status: input.status,
        onlyDemo: actor.isDemo,
        now,
        after: input.after,
        limit: PAGE_SIZE + 1,
      });
      const page = found.slice(0, PAGE_SIZE);
      const last = page.at(-1);
      return {
        items: await viewsOf(this.#deps, tx, page, now),
        next:
          found.length > PAGE_SIZE && last ? { requestedAt: last.requestedAt, id: last.id } : null,
      };
    });
  }
}

/** One request, with its people; NotFound outside the demo staff's scope (STF-11). */
export class GetRequest {
  readonly #deps: CommandDependencies;

  constructor(deps: CommandDependencies) {
    this.#deps = deps;
  }

  execute(actor: StaffReader, requestId: string): Promise<RequestView> {
    const now = this.#deps.clock.now();
    return this.#deps.unitOfWork.run(async (tx) => {
      const state = await this.#deps.repositories.for(tx).requests.find(requestId);
      if (!state || (actor.isDemo && !state.demoScope)) throw new NotFound('Request');
      return viewOf(this.#deps, tx, state, now);
    });
  }
}
