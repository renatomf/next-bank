// Tailwind runs at build time only (ADR 0020): the browser gets a static
// stylesheet, which the CSP's style-src 'self' already allows.
export default { plugins: { '@tailwindcss/postcss': {} } };
