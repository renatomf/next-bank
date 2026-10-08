/**
 * A broken business rule listed in the error catalog (domain-model.md, section 9).
 * The code is the contract with clients; the message is for developers only.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  /** Extra fields the client needs to react, e.g. the attempts left (section 9). */
  get details(): Readonly<Record<string, number>> {
    return {};
  }

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
