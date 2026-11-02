import { Cpf } from '../../../shared/domain/cpf.ts';
import { DomainError } from '../../../shared/domain/domain-error.ts';

/** What the staff typed in the one search field (v1.3.0 plan, task 3, C2). */
export type CustomerQuery =
  | { by: 'CPF'; cpf: Cpf }
  | { by: 'EMAIL'; email: string }
  | { by: 'ACCOUNT'; number: string }
  | { by: 'NAME'; prefix: string };

/** A term too short to narrow the customers down. */
export class InvalidCustomerQuery extends DomainError {
  readonly code = 'InvalidRequest';

  constructor() {
    super('The search term is too short');
  }
}

const CPF_FORMAT = /^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/;
const ACCOUNT_NUMBER = /^\d{6}-\d$/;
const SHORTEST_NAME = 3;

/**
 * Reads what a term is. A CPF, an e-mail and an account number are matched
 * exactly; anything else is the start of a name. A CPF with wrong check
 * digits is refused, rather than looked up among the names.
 */
export function customerQueryOf(raw: string): CustomerQuery {
  const term = raw.trim();
  if (CPF_FORMAT.test(term)) return { by: 'CPF', cpf: Cpf.parse(term) };
  if (ACCOUNT_NUMBER.test(term)) return { by: 'ACCOUNT', number: term };
  if (term.includes('@')) return { by: 'EMAIL', email: term.toLowerCase() };
  if (term.length < SHORTEST_NAME) throw new InvalidCustomerQuery();
  return { by: 'NAME', prefix: term };
}
