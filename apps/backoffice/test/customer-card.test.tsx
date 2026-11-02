import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CustomerCard } from '../app/clientes/[id]/customer-card';

// The card of a customer (v1.3.0 plan, task 3): what customers wrote is
// shown as text, never run (STF-05), and only masked documents (STF-07).
const customer = {
  id: '0190f0b6-1b2c-7d3e-8f40-123456789abc',
  name: '<script>alert(1)</script>',
  cpfMasked: '***.444.777-**',
  emailMasked: 'a***@example.test',
  status: 'ACTIVE' as const,
  account: {
    branch: '0001',
    number: '100000-4',
    status: 'ACTIVE' as const,
    openedAt: '2026-10-01T12:00:00.000Z',
  },
  balance: { amount: 123456, currency: 'BRL' as const },
};

describe('CustomerCard', () => {
  it('shows a name with a script as text (STF-05)', () => {
    const html = renderToStaticMarkup(<CustomerCard customer={customer} />);

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('shows the masked documents, the account and the balance', () => {
    const html = renderToStaticMarkup(<CustomerCard customer={customer} />);

    expect(html).toContain('***.444.777-**');
    expect(html).toContain('a***@example.test');
    expect(html).toContain('0001 · 100000-4');
    expect(html).toContain('R$ 1.234,56');
  });
});
