import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatementList } from '../features/customers/statement-list';

// A customer's statement in the backoffice (v1.3.0 plan, task 5): each Pix
// the customer sent offers its reversal, except one already reversed, whose
// reversal back to the payer names it. The API refuses a second reversal
// either way (PIX-14); the button only spares the refusal.
const BRUNO = { name: 'Bruno Demo', documentMasked: '***.982.247-**' };
const REVERSED_PIX = '0190f0b6-1b2c-7d3e-8f40-000000000001';
const OTHER_PIX = '0190f0b6-1b2c-7d3e-8f40-000000000002';

function item(
  id: string,
  kind: 'PIX_SENT' | 'PIX_REVERSED',
  direction: 'IN' | 'OUT',
  transferId: string,
) {
  return {
    id,
    occurredAt: '2026-11-03T14:45:00.000Z',
    kind,
    direction,
    amount: { amount: 1000, currency: 'BRL' as const },
    counterparty: BRUNO,
    transferId,
    topUpId: null,
  };
}

const reversalButtons = (html: string) => html.match(/Pedir estorno do Pix/g)?.length ?? 0;

describe('StatementList', () => {
  it('offers no reversal of a Pix already reversed', () => {
    const html = renderToStaticMarkup(
      <StatementList
        canReverse
        items={[
          item('0190f0b6-1b2c-7d3e-8f40-0000000000a1', 'PIX_REVERSED', 'IN', REVERSED_PIX),
          item('0190f0b6-1b2c-7d3e-8f40-0000000000a2', 'PIX_SENT', 'OUT', REVERSED_PIX),
          item('0190f0b6-1b2c-7d3e-8f40-0000000000a3', 'PIX_SENT', 'OUT', OTHER_PIX),
        ]}
      />,
    );

    expect(reversalButtons(html)).toBe(1);
  });

  it('offers no reversal at all without canReverse', () => {
    const html = renderToStaticMarkup(
      <StatementList
        items={[item('0190f0b6-1b2c-7d3e-8f40-0000000000a3', 'PIX_SENT', 'OUT', OTHER_PIX)]}
      />,
    );

    expect(reversalButtons(html)).toBe(0);
  });
});
