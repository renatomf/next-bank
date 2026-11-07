import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AwaitingDecision } from '../features/home/awaiting-decision';
import { MyRequests } from '../features/home/my-requests';
import { ReconciliationSummary } from '../features/home/reconciliation-summary';
import type { ApprovalRequest, ReconciliationException } from '../lib/api';

// The home's blocks (home plan): the queue, oldest first, with the time left;
// only the customer's name, as text (STF-05, STF-07); an empty list said
// plainly, and a block that failed with its own warning.
const now = new Date('2026-11-04T15:00:00Z');

function request(id: string, requestedAt: string, overrides: Partial<ApprovalRequest> = {}) {
  const expiresAt = new Date(new Date(requestedAt).getTime() + 24 * 3_600_000).toISOString();
  return {
    id,
    kind: 'REVERSE_PIX',
    status: 'PENDING',
    customer: { id: `c-${id}`, name: '<b>Ana Demo</b>' },
    transfer: { id: `t-${id}`, amount: { amount: 1000, currency: 'BRL' }, payeeName: 'Bruno' },
    exception: null,
    reason: 'CUSTOMER_REQUEST',
    note: null,
    requestedBy: { id: 'olivia', name: 'Olívia' },
    requestedAt,
    expiresAt,
    decision: null,
    ...overrides,
  } satisfies ApprovalRequest;
}

const page = <T,>(items: T[], nextCursor: string | null = null) => ({ items, nextCursor });

describe('AwaitingDecision', () => {
  it('lists the oldest first, with the time left and the amount', () => {
    const html = renderToStaticMarkup(
      <AwaitingDecision
        loaded={{
          ok: true,
          value: page([
            request('new', '2026-11-04T14:00:00Z'),
            request('old', '2026-11-03T17:00:00Z'),
          ]),
        }}
        now={now}
      />,
    );

    expect(html.indexOf('/requests/old')).toBeLessThan(html.indexOf('/requests/new'));
    expect(html).toContain('Aguardando sua decisão (2)');
    expect(html).toContain('vence em 2 h');
    expect(html).toContain('vence em 23 h');
    expect(html).toContain('R$ 10,00');
    expect(html).toContain('Estorno de Pix');
  });

  it("shows the customer's name as text, and nothing more of them", () => {
    const html = renderToStaticMarkup(
      <AwaitingDecision
        loaded={{ ok: true, value: page([request('a', '2026-11-04T14:00:00Z')]) }}
        now={now}
      />,
    );

    expect(html).toContain('&lt;b&gt;Ana Demo&lt;/b&gt;');
    // The words on the screen, not the classes of the markup.
    expect(html.replace(/<[^>]+>/g, ' ')).not.toMatch(/cpf|@|saldo/i);
  });

  it('counts "20+" when more wait on the next page', () => {
    const html = renderToStaticMarkup(
      <AwaitingDecision
        loaded={{ ok: true, value: page([request('a', '2026-11-04T14:00:00Z')], 'next') }}
        now={now}
      />,
    );

    expect(html).toContain('Aguardando sua decisão (1+)');
  });

  it('says plainly when nothing waits', () => {
    const html = renderToStaticMarkup(
      <AwaitingDecision loaded={{ ok: true, value: page([]) }} now={now} />,
    );

    expect(html).toContain('Nada esperando por você');
  });

  it('warns when the queue could not be read', () => {
    const html = renderToStaticMarkup(<AwaitingDecision loaded={{ ok: false }} now={now} />);

    expect(html).toContain('Não foi possível carregar agora');
  });
});

describe('MyRequests', () => {
  it('shows what still waits and how the last ones ended', () => {
    const approved = request('done', '2026-11-03T10:00:00Z', {
      status: 'APPROVED',
      decision: {
        decision: 'APPROVED',
        decidedBy: { id: 'diogo', name: 'Diogo' },
        decidedAt: '2026-11-03T11:00:00Z',
        note: null,
      },
    });
    const html = renderToStaticMarkup(
      <MyRequests
        loaded={{
          ok: true,
          value: {
            pending: page([request('open', '2026-11-04T14:00:00Z')]),
            recent: page([request('open', '2026-11-04T14:00:00Z'), approved]),
          },
        }}
        now={now}
      />,
    );

    expect(html).toContain('Esperando decisão (1)');
    expect(html).toContain('/requests/open');
    expect(html).toContain('Decididos por último');
    expect(html).toContain('/requests/done');
    expect(html).toContain('Aprovado');
  });

  it('says plainly when the operator asked nothing', () => {
    const html = renderToStaticMarkup(
      <MyRequests
        loaded={{ ok: true, value: { pending: page([]), recent: page([]) } }}
        now={now}
      />,
    );

    expect(html).toContain('Você não tem pedidos abertos');
  });
});

describe('ReconciliationSummary', () => {
  const exception = (id: string, detectedAt: string) =>
    ({
      id,
      runDate: detectedAt.slice(0, 10),
      kind: 'STALE_PROCESSING',
      endToEndId: null,
      expected: null,
      actual: null,
      detectedAt,
      status: 'OPEN',
      pix: null,
    }) as ReconciliationException;

  it('counts the open exceptions and dates the oldest in Brasília time', () => {
    const html = renderToStaticMarkup(
      <ReconciliationSummary
        loaded={{
          ok: true,
          value: page([
            exception('b', '2026-11-04T06:10:00Z'),
            exception('a', '2026-11-02T06:10:00Z'),
          ]),
        }}
      />,
    );

    expect(html).toContain('exceções em aberto');
    expect(html).toContain('02/11/2026, 03:10');
  });

  it('says plainly when nothing is open', () => {
    const html = renderToStaticMarkup(
      <ReconciliationSummary loaded={{ ok: true, value: page([]) }} />,
    );

    expect(html).toContain('Nenhuma exceção em aberto');
  });
});
