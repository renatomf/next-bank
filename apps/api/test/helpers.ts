import { Writable } from 'node:stream';

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL não definida (veja .env.example)');
  return url;
}

/** Captura as linhas de log em JSON para inspeção nos testes. */
export function captureLogs(): {
  stream: Writable;
  lines: () => Record<string, unknown>[];
  raw: () => string;
} {
  let raw = '';
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      raw += chunk.toString();
      done();
    },
  });
  return {
    stream,
    raw: () => raw,
    lines: () =>
      raw
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}
