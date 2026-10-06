// Personal data and secrets never reach the log (API-04).
const SENSITIVE_KEYS = [
  'password',
  'pin',
  'cpf',
  'pixKey',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  // Personal data: never in logs (database.md, section 2). Error class names stay in err.type.
  'email',
  'name',
];

export const REDACT_PATHS = SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]);
