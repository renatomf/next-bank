import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { createPool } from '../src/shared/db.ts';
import { buildOpenApiDocument, type OpenApiDocument } from '../src/shared/openapi.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from './helpers.ts';

// The OpenAPI document is the contract the Dart client is generated from (ADR 0008).
describe('OpenAPI document', () => {
  const app = buildApp({
    pool: createPool(testDatabaseUrl()),
    logStream: captureLogs().stream,
    security: testSecurity(),
  });
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

  it('describes POST /v1/auth/register with the request the client sends and its answers', () => {
    const operation = document.paths['/v1/auth/register']?.post;

    expect(operation?.operationId).toBe('registerCustomer');
    expect(operation?.responses['201']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/AuthTokens',
    });
    for (const status of ['409', '422', '429']) {
      expect(operation?.responses[status]?.content?.['application/problem+json']?.schema).toEqual({
        $ref: '#/components/schemas/Problem',
      });
    }
  });

  // The approved contract: a new schema must be added here on purpose (READ-02).
  it('keeps only referenced schemas, without input duplicates', () => {
    expect(Object.keys(document.components.schemas).sort()).toEqual([
      'AuthTokens',
      'CreatePinRequestInput',
      'Health',
      'LoginRequestInput',
      'Me',
      'Money',
      'MyAccount',
      'PixKeyLookup',
      'PixKeyLookupRequestInput',
      'Problem',
      'RefreshRequestInput',
      'RegisterRequestInput',
      'VerifyPinRequestInput',
    ]);
  });

  it('declares bearer authentication and requires it only on protected operations', () => {
    expect(document.components.securitySchemes).toEqual({
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    });
    expect(document.paths['/v1/auth/logout']?.post?.security).toEqual([{ bearerAuth: [] }]);
    expect(document.paths['/v1/auth/logout']?.post?.operationId).toBe('logout');
    expect(document.paths['/v1/auth/refresh']?.post?.operationId).toBe('refreshSession');
    expect(document.paths['/v1/auth/refresh']?.post?.security).toBeUndefined();
    expect(document.paths['/v1/me/pin']?.post?.operationId).toBe('createPin');
    expect(document.paths['/v1/me/pin']?.post?.security).toEqual([{ bearerAuth: [] }]);
  });

  it('describes POST /v1/auth/login with the shared token answer', () => {
    const operation = document.paths['/v1/auth/login']?.post;

    expect(operation?.operationId).toBe('login');
    expect(operation?.responses['200']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/AuthTokens',
    });
    for (const status of ['401', '422', '429']) {
      expect(operation?.responses[status]?.content?.['application/problem+json']?.schema).toEqual({
        $ref: '#/components/schemas/Problem',
      });
    }
  });

  it('describes GET /v1/me as a protected read of the caller profile', () => {
    const operation = document.paths['/v1/me']?.get;

    expect(operation?.operationId).toBe('getMe');
    expect(operation?.security).toEqual([{ bearerAuth: [] }]);
    expect(operation?.responses['200']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/Me',
    });
    for (const status of ['401', '422']) {
      expect(operation?.responses[status]?.content?.['application/problem+json']?.schema).toEqual({
        $ref: '#/components/schemas/Problem',
      });
    }
  });

  it('describes GET /v1/me/account as a protected read of the caller account', () => {
    const operation = document.paths['/v1/me/account']?.get;

    expect(operation?.operationId).toBe('getMyAccount');
    expect(operation?.security).toEqual([{ bearerAuth: [] }]);
    expect(operation?.responses['200']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/MyAccount',
    });
    for (const status of ['401', '404', '422']) {
      expect(operation?.responses[status]?.content?.['application/problem+json']?.schema).toEqual({
        $ref: '#/components/schemas/Problem',
      });
    }
  });

  // F-16: the Unlock screen checks the PIN; the same counter as the Pix (PIX-05).
  it('describes POST /v1/me/pin/verify as a protected check with the attempts left', () => {
    const operation = document.paths['/v1/me/pin/verify']?.post;

    expect(operation?.operationId).toBe('verifyPin');
    expect(operation?.security).toEqual([{ bearerAuth: [] }]);
    for (const status of ['401', '409', '422', '423']) {
      expect(operation?.responses[status]?.content?.['application/problem+json']?.schema).toEqual({
        $ref: '#/components/schemas/Problem',
      });
    }
    expect(document.components.schemas.Problem).toMatchObject({
      properties: { remainingAttempts: { type: 'integer' } },
    });
  });

  // D2: the key value travels in the body, never in the URL; PIX-07.
  it('describes POST /v1/pix/key-lookups as a protected lookup of the payee', () => {
    const operation = document.paths['/v1/pix/key-lookups']?.post;

    expect(operation?.operationId).toBe('lookupPixKey');
    expect(operation?.security).toEqual([{ bearerAuth: [] }]);
    expect(operation?.responses['200']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/PixKeyLookup',
    });
    for (const status of ['401', '404', '422', '429']) {
      expect(operation?.responses[status]?.content?.['application/problem+json']?.schema).toEqual({
        $ref: '#/components/schemas/Problem',
      });
    }
  });

  // READ-01, READ-05: resources come from the token; no route names one by id or number.
  it('has no route that takes a resource id in the path', () => {
    expect(Object.keys(document.paths).filter((path) => path.includes('{'))).toEqual([]);
  });

  it('is deterministic', async () => {
    expect(JSON.stringify(await buildOpenApiDocument(app))).toBe(JSON.stringify(document));
  });
});
