import type { FastifyInstance } from 'fastify';

interface MediaType {
  schema?: unknown;
}
interface Operation {
  operationId?: string;
  security?: Record<string, string[]>[];
  parameters?: { in: string; name: string; required?: boolean }[];
  responses: Record<string, { content?: Record<string, MediaType> } | undefined>;
}
export interface OpenApiDocument {
  openapi: string;
  paths: Record<string, Record<string, Operation> | undefined>;
  components: { schemas: Record<string, unknown>; securitySchemes?: Record<string, unknown> };
}

const REF_PREFIX = '#/components/schemas/';

/** Names of the component schemas reachable from the paths, following nested $refs. */
function referencedSchemas(document: OpenApiDocument): Set<string> {
  const found = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string' && value.startsWith(REF_PREFIX)) {
        const name = value.slice(REF_PREFIX.length);
        if (!found.has(name)) {
          found.add(name);
          visit(document.components.schemas[name]);
        }
      } else {
        visit(value);
      }
    }
  };
  visit(document.paths);
  return found;
}

/**
 * Builds the OpenAPI contract the clients are generated from (ADR 0008).
 * The Zod provider registers an input and an output variant of every named schema;
 * only the ones the paths reference are kept, so clients get no unused classes.
 */
export async function buildOpenApiDocument(app: FastifyInstance): Promise<OpenApiDocument> {
  await app.ready();
  const document = app.swagger() as unknown as OpenApiDocument;
  const used = referencedSchemas(document);
  const schemas = Object.fromEntries(
    Object.entries(document.components.schemas)
      .filter(([name]) => used.has(name))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return { ...document, components: { ...document.components, schemas } };
}
