import { DomainError } from './domain-error.ts';

/**
 * The resource does not exist for the caller (catalog: 404). A resource of
 * another user answers the same, so its existence is never revealed (READ-01).
 */
export class NotFound extends DomainError {
  readonly code = 'NotFound';

  constructor(resource: string) {
    super(`${resource} not found`);
  }
}
