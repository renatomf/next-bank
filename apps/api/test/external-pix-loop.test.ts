import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { mountSimulator } from '../src/mount-simulator.ts';
import { createPool } from '../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from './helpers.ts';
import { externalPixClient } from './modules/payments/http/external-pix-client.ts';
import { participantKey } from './simulator.ts';

// The whole loop of a Pix to another bank as it runs in production (v1.2.0
// plan, tasks 3 and 4; D2, D3): the API and the simulator mounted in one
// server; the worker sends the Pix to the SPI over HTTP, the SPI's
// dispatcher signs its answer and posts it to the API's webhook, and the
// Pix ends. Settled, it completes; refused, the payer gets the money back.
let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

/** A port free now, for a server that must know its own address before it listens. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => {
        if (address === null || typeof address === 'string') reject(new Error('no port'));
        else resolve(address.port);
      });
    });
  });
}

async function service(faults?: string) {
  const databaseUrl = process.env.TEST_SIMULATOR_DATABASE_URL;
  if (!databaseUrl) throw new Error('TEST_SIMULATOR_DATABASE_URL is not set (see .env.example)');
  const port = await freePort();
  const base = `http://127.0.0.1:${String(port)}`;
  const webhookSecret = randomBytes(32);
  const server = buildApp({
    pool: createPool(testDatabaseUrl()),
    logStream: captureLogs().stream,
    security: testSecurity(),
    externalPix: { simulatorUrl: `${base}/simulator`, participantKey, webhookSecret },
  });
  app = server;
  const simulator = await mountSimulator(server, {
    databaseUrl,
    participantKey,
    webhookSecret,
    webhookUrl: `${base}/v1/spi/webhooks`,
    ...(faults ? { faults } : {}),
  });
  await server.listen({ host: '127.0.0.1', port });
  return { server, simulator, client: externalPixClient(server, '198.18.11') };
}

describe('the Pix to another bank, end to end in one service', () => {
  it('completes when the SPI settles it', async () => {
    const { server, simulator, client } = await service();
    const payer = await client.newCustomer();
    const pix = await client.sendToAurora(payer);

    await server.outboxWorker.runOnce(100);
    await simulator.dispatchDue();

    expect(await client.pix(payer, pix.id)).toMatchObject({ status: 'COMPLETED' });
    expect(await client.balanceOf(payer)).toBe(1_000_000 - 8_000);
  });

  it('gives the money back when the payee bank refuses it', async () => {
    const { server, simulator, client } = await service('{"rejectRate":1}');
    const payer = await client.newCustomer();
    const pix = await client.sendToAurora(payer);

    await server.outboxWorker.runOnce(100);
    await simulator.dispatchDue();

    expect(await client.pix(payer, pix.id)).toMatchObject({
      status: 'FAILED',
      failureReason: 'PAYEE_BANK_REJECTED',
    });
    expect(await client.balanceOf(payer)).toBe(1_000_000);
  });
});
