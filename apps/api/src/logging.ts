// Dados pessoais e segredos nunca chegam ao log (API-04).
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
];

export const REDACT_PATHS = SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]);
