/**
 * The content security policy of every response (v1.3.0 plan, task 2;
 * STF-05). Only the scripts that carry this response's nonce run, and the
 * ones they load ('strict-dynamic'): a customer's name with a script in it is
 * shown as text and never runs. Nothing frames the backoffice, and its forms
 * post only to itself. Next.js's dev server needs eval and inline styles,
 * so only development gets them.
 */
export function contentSecurityPolicy(nonce: string, options: { development: boolean }): string {
  const { development } = options;
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    `style-src 'self'${development ? " 'unsafe-inline'" : ''}`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    ...(development ? [] : ['upgrade-insecure-requests']),
  ];
  return directives.join('; ');
}
