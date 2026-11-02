/**
 * The e-mail as the staff sees it (v1.3.0 plan, task 3; STF-07): the first
 * letter and the domain, enough to confirm it with the customer, and a fixed
 * mask that hides the length of the rest.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}
