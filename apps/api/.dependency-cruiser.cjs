// Architecture rules (CLAUDE.md, section 3). A violation breaks the build.
// Dependencies point inward: http/infrastructure -> application -> domain.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Cycles hide which piece depends on which.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment:
        'Domain is plain TypeScript: only its own module domain and the shared domain kernel. No framework, no npm package, no Node API.',
      from: { path: '^src/modules/([^/]+)/domain/' },
      to: { pathNot: ['^src/modules/$1/domain/', '^src/shared/domain/'] },
    },
    {
      name: 'shared-domain-is-pure',
      severity: 'error',
      comment: 'The shared domain kernel follows the same rule as every domain.',
      from: { path: '^src/shared/domain/' },
      to: { pathNot: '^src/shared/domain/' },
    },
    {
      name: 'application-depends-only-inward',
      severity: 'error',
      comment:
        'Use cases talk to the outside world only through ports they declare; infrastructure and HTTP implement them.',
      from: { path: '^src/modules/([^/]+)/application/' },
      to: {
        pathNot: ['^src/modules/$1/(domain|application)/', '^src/shared/(domain|application)/'],
      },
    },
    {
      name: 'shared-application-depends-only-inward',
      severity: 'error',
      comment: 'Shared ports follow the same rule as every application layer.',
      from: { path: '^src/shared/application/' },
      to: { pathNot: '^src/shared/(domain|application)/' },
    },
    {
      name: 'modules-talk-through-public-api',
      severity: 'error',
      comment: 'A bounded context only uses another one through its index.ts.',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/', pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\.ts$'] },
    },
    {
      name: 'orchestration-uses-public-apis',
      severity: 'error',
      comment:
        'Flows owned by no context (ADR 0010) only sequence calls to module public APIs and shared ports.',
      from: { path: '^src/application/' },
      to: {
        path: '^src/(modules|shared)/',
        pathNot: ['^src/modules/[^/]+/index\\.ts$', '^src/shared/(domain|application)/'],
      },
    },
    {
      name: 'modules-do-not-know-orchestration',
      severity: 'error',
      comment: 'Contexts never depend on the flows that orchestrate them (ADR 0010).',
      from: { path: '^src/(modules|shared)/' },
      to: { path: '^src/application/' },
    },
    {
      name: 'shared-does-not-know-modules',
      severity: 'error',
      comment: 'Cross-cutting code must not depend on a bounded context.',
      from: { path: '^src/shared/' },
      to: { path: '^src/modules/' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  },
};
