import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { createPool } from '../src/db.ts';
import { buildOpenApiDocument, type OpenApiDocument } from '../src/openapi.ts';
import { captureLogs, testDatabaseUrl } from './helpers.ts';

// The OpenAPI document is the contract the Dart client is generated from (ADR 0008).
describe('OpenAPI document', () => {
  const app = buildApp({ pool: createPool(testDatabaseUrl()), logStream: captureLogs().stream });
  let document: OpenApiDocument;

  beforeAll(async () => {
    document = await buildOpenApiDocument(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('describes GET /health with named response schemas', () => {
    const operation = document.paths['/health']?.get;

    expect(operation?.operationId).toBe('getHealth');
    expect(operation?.responses['200']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/Health',
    });
    expect(operation?.responses['503']?.content?.['application/problem+json']?.schema).toEqual({
      $ref: '#/components/schemas/Problem',
    });
  });

  it('keeps only referenced schemas, without input duplicates', () => {
    expect(Object.keys(document.components.schemas).sort()).toEqual(['Health', 'Problem']);
  });

  it('is deterministic', async () => {
    expect(JSON.stringify(await buildOpenApiDocument(app))).toBe(JSON.stringify(document));
  });
});
