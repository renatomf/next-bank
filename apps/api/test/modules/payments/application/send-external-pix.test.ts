import { describe, expect, it } from 'vitest';
import { SendExternalPix } from '../../../../src/modules/payments/application/send-external-pix.ts';
import { PixTransfer } from '../../../../src/modules/payments/domain/pix-transfer.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { AURORA_EMAIL, FakeKeyProtector, FakeSpi, FakeUnitOfWork, twoCustomers } from './fakes.ts';

// Sending a Pix to another bank (v1.2.0 plan, task 3; ADR 0016): the worker
// delivers pix.send-external at least once, so the handler sends the same
// payment, with the same end-to-end id, however often it runs (EXT-03). The
// message carries only the id; the key is read sealed and opened here.
const CREATED = new Date('2026-10-22T15:00:00.000Z');
const AUTHORIZED = new Date('2026-10-22T15:01:00.000Z');
const E2E = 'E00000000202610221501a1B2c3D4e5F';

function setup() {
  const world = twoCustomers();
  const transfer = PixTransfer.create({
    id: 'pix-2',
    payerAccountId: 'account-a',
    payee: {
      accountId: null,
      bank: { ispb: '99900001', name: 'Banco Aurora' },
      name: 'Clara Aurora Teixeira',
      documentMasked: '***.407.256-**',
      keyType: 'EMAIL',
      keyMasked: 'cl***@example.com',
    },
    amount: Money.of(8_000n),
    description: null,
    now: CREATED,
  });
  transfer.startProcessing(AUTHORIZED);
  transfer.awaitSettlement(E2E);
  world.repositories.transfers.push(transfer.state);
  const { ciphertext, keyVersion } = new FakeKeyProtector().protect('EMAIL', AURORA_EMAIL);
  world.repositories.payeeKeys.set('pix-2', { ciphertext, keyVersion });
  const spi = new FakeSpi();
  const send = new SendExternalPix({
    unitOfWork: new FakeUnitOfWork(),
    repositories: world.repositories,
    protector: new FakeKeyProtector(),
    accounts: world.accounts,
    identity: world.identity,
    spi,
  });
  return { ...world, spi, send };
}

const message = (payload: Record<string, string> = { transferId: 'pix-2' }) => ({
  id: 'message-1',
  type: 'pix.send-external',
  payload,
  attempts: 0,
});

describe('SendExternalPix', () => {
  it('sends the Pix with its end-to-end id, the payer masked and the key opened', async () => {
    const { spi, send } = setup();

    await send.handle(message());

    expect(spi.sent).toEqual([
      {
        endToEndId: E2E,
        amount: Money.of(8_000n),
        payer: { ispb: '00000000', name: 'Ana Souza', documentMasked: '***.444.777-**' },
        payeeKey: AURORA_EMAIL,
      },
    ]);
  });

  // At least once (ADR 0016): the SPI takes the same end-to-end id once.
  it('sends the very same payment when the message comes again', async () => {
    const { spi, send } = setup();

    await send.handle(message());
    await send.handle(message());

    expect(spi.sent).toHaveLength(2);
    expect(spi.sent[1]).toEqual(spi.sent[0]);
  });

  it('sends nothing for a Pix the SPI already answered', async () => {
    const { repositories, spi, send } = setup();
    const [sent] = repositories.transfers;
    if (!sent) throw new Error('setup created no Pix');
    repositories.transfers[0] = { ...sent, status: 'COMPLETED', completedAt: AUTHORIZED };

    await send.handle(message());

    expect(spi.sent).toEqual([]);
  });

  it('fails when the SPI does not answer, so the outbox tries again', async () => {
    const { spi, send } = setup();
    spi.down = true;

    await expect(send.handle(message())).rejects.toThrow(/unreachable/);
  });

  it.each([
    ['without the Pix id', {}],
    ['for no Pix to another bank', { transferId: 'pix-unknown' }],
  ])('fails on a message %s: a bug, for a person to see', async (_case, payload) => {
    const { spi, send } = setup();

    await expect(send.handle(message(payload))).rejects.toThrow();
    expect(spi.sent).toEqual([]);
  });
});
