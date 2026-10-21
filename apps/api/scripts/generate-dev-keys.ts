// Prints fresh keys for a local apps/api/.env (never committed; the deploy uses
// its own keys from the provider's secret store).
// Usage: node scripts/generate-dev-keys.ts >> .env
import { generateKeyPairSync, randomBytes } from 'node:crypto';

const signingKey = generateKeyPairSync('ed25519')
  .privateKey.export({ format: 'der', type: 'pkcs8' })
  .toString('base64');
const today = new Date().toISOString().slice(0, 10);

process.stdout.write(
  [
    `JWT_PRIVATE_KEY=${signingKey}`,
    `JWT_KEY_ID=dev-${today}`,
    `PII_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`,
    `PII_HMAC_KEY=${randomBytes(32).toString('base64')}`,
    'PII_KEY_VERSION=1',
    `PIN_PEPPER=${randomBytes(32).toString('base64')}`,
    `TOP_UP_PHONE_KEY=${randomBytes(32).toString('base64')}`,
    '',
  ].join('\n'),
);
