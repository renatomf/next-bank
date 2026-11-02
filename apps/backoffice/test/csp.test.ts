import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from '../lib/csp';

// The content security policy of the backoffice (v1.3.0 plan, task 2;
// STF-05): only scripts with the nonce of this response run, so a customer's
// name holding a script never runs; nothing is framed, nothing posts away.
const directivesOf = (policy: string) =>
  new Map(
    policy
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .map(([name = '', ...values]) => [name, values]),
  );

describe('contentSecurityPolicy', () => {
  it('runs only the scripts of this response, never inline ones', () => {
    const directives = directivesOf(contentSecurityPolicy('abc123', { development: false }));

    expect(directives.get('script-src')).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
    expect(directives.get('script-src')).not.toContain("'unsafe-inline'");
    expect(directives.get('script-src')).not.toContain("'unsafe-eval'");
  });

  it('frames nothing, embeds nothing and posts nowhere else', () => {
    const directives = directivesOf(contentSecurityPolicy('abc123', { development: false }));

    expect(directives.get('default-src')).toEqual(["'self'"]);
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
    expect(directives.get('object-src')).toEqual(["'none'"]);
    expect(directives.get('base-uri')).toEqual(["'none'"]);
    expect(directives.get('form-action')).toEqual(["'self'"]);
    expect(directives.has('upgrade-insecure-requests')).toBe(true);
  });

  it("allows eval only in development, as Next.js's dev server needs it", () => {
    const directives = directivesOf(contentSecurityPolicy('abc123', { development: true }));

    expect(directives.get('script-src')).toContain("'unsafe-eval'");
    expect(directives.has('upgrade-insecure-requests')).toBe(false);
  });
});
