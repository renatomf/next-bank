import { writeFileSync } from 'node:fs';
import { buildApp } from '../src/app.ts';
import { createPool } from '../src/db.ts';
import { buildOpenApiDocument } from '../src/openapi.ts';

const output = process.argv[2];
if (!output) throw new Error('usage: generate-openapi.ts <output.json>');

// The pool never connects: building the document only reads the route schemas.
const app = buildApp({
  pool: createPool('postgres://unused@127.0.0.1/unused'),
  logStream: { write: () => undefined },
});
const document = await buildOpenApiDocument(app);
await app.close();
writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
