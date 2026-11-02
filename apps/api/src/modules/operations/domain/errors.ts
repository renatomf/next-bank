import { DomainError } from '../../../shared/domain/domain-error.ts';

/** A note longer than a request keeps (catalog: 422). */
export class InvalidRequestNote extends DomainError {
  readonly code = 'InvalidRequest';

  constructor() {
    super('The note of a request has at most 500 characters');
  }
}

/** The request was already decided, cancelled or expired (catalog: 409; STF-09). */
export class RequestNotPending extends DomainError {
  readonly code = 'RequestNotPending';

  constructor() {
    super('The request is no longer pending');
  }
}

/** The one who asked never approves or rejects (catalog: 403; STF-03). */
export class SelfApprovalNotAllowed extends DomainError {
  readonly code = 'SelfApprovalNotAllowed';

  constructor() {
    super('A request is decided by someone other than its requester');
  }
}

/** Only the one who asked cancels (catalog: 403). */
export class NotTheRequester extends DomainError {
  readonly code = 'NotTheRequester';

  constructor() {
    super('Only the requester cancels a request');
  }
}

/** A pending request of this kind already exists for the customer (catalog: 409). */
export class RequestAlreadyOpen extends DomainError {
  readonly code = 'RequestAlreadyOpen';

  constructor() {
    super('A request of this kind is already pending for the customer');
  }
}

/** The account is already blocked (catalog: 409). */
export class AccountAlreadyBlocked extends DomainError {
  readonly code = 'AccountAlreadyBlocked';

  constructor() {
    super('The account is already blocked');
  }
}

/** Only a blocked account is unblocked (catalog: 409). */
export class AccountNotBlocked extends DomainError {
  readonly code = 'AccountNotBlocked';

  constructor() {
    super('The account is not blocked');
  }
}

/** Ana and Bruno, shared by every visitor of the app, stay unblocked (catalog: 403; K5). */
export class DemoCustomerProtected extends DomainError {
  readonly code = 'DemoCustomerProtected';

  constructor() {
    super('The demo staff does not block the demo customers of the app');
  }
}
