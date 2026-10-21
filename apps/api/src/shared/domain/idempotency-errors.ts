import { DomainError } from './domain-error.ts';

/** The same Idempotency-Key came with another request: a client bug (ADR 0007). */
export class IdempotencyKeyReused extends DomainError {
  readonly code = 'IdempotencyKeyReused';

  constructor() {
    super('Idempotency key already used for another request');
  }
}

/** The first request with this key is still running; the client asks again later. */
export class RequestInProgress extends DomainError {
  readonly code = 'RequestInProgress';

  constructor() {
    super('A request with this idempotency key is still in progress');
  }
}
