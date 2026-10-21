import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { buildApp } from '../src/app.ts';
import { createPool } from '../src/shared/db.ts';
import { buildOpenApiDocument } from '../src/shared/openapi.ts';

const output = process.argv[2];
if (!output) throw new Error('usage: generate-openapi.ts <output.json>');

// The pool never connects: building the document only reads the route schemas.
const app = buildApp({
  pool: createPool('postgres://unused@127.0.0.1/unused'),
  logStream: { write: () => undefined },
  // Throwaway keys: they do not change the document, which only reads route schemas.
  security: {
    accessTokenKeys: { privateKey: generateKeyPairSync('ed25519').privateKey, keyId: 'contract' },
    piiKeys: { keyVersion: 1, encryptionKey: randomBytes(32), hmacKey: randomBytes(32) },
    pinPepper: randomBytes(32),
    topUpPhoneKey: randomBytes(32),
  },
});
const document = await buildOpenApiDocument(app);
await app.close();
writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
