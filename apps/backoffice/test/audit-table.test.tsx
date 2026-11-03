import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AuditTable } from '../features/audit/audit-table';

// The audit trail on the screen (v1.3.0 plan, task 8): each action in words
// with its code beside it (H6), the staff by name and a customer only by id
// (H4), and the metadata as text, never run (STF-05).
const entries = [
  {
    id: '0190f0b6-1b2c-7d3e-8f40-000000000001',
    occurredAt: '2026-11-03T15:00:00.000Z',
    actor: { type: 'STAFF' as const, id: '0190f0b6-1b2c-7d3e-8f40-0000000000a1', name: 'Diogo' },
    action: 'REQUEST_APPROVED',
    subject: { type: 'APPROVAL_REQUEST', id: '0190f0b6-1b2c-7d3e-8f40-0000000000b1' },
    requestId: 'req-1',
    metadata: { kind: 'RESOLVE_EXCEPTION', note: '<script>x</script>' },
  },
  {
    id: '0190f0b6-1b2c-7d3e-8f40-000000000002',
    occurredAt: '2026-11-03T14:00:00.000Z',
    actor: { type: 'USER' as const, id: '0190f0b6-1b2c-7d3e-8f40-0000000000c1', name: null },
    action: 'SOMETHING_NEW',
    subject: { type: 'USER', id: '0190f0b6-1b2c-7d3e-8f40-0000000000c1' },
    requestId: null,
    metadata: {},
  },
];

describe('AuditTable', () => {
  it('names each action in words, with its code, and the staff by name', () => {
    const html = renderToStaticMarkup(<AuditTable entries={entries} />);

    expect(html).toContain('Pedido aprovado');
    expect(html).toContain('REQUEST_APPROVED');
    expect(html).toContain('Diogo');
  });

  it('shows an action it has no words for by its code, and a customer by id only', () => {
    const html = renderToStaticMarkup(<AuditTable entries={entries} />);

    expect(html).toContain('SOMETHING_NEW');
    expect(html).toContain('Cliente');
    expect(html).toContain('0190f0b6');
  });

  it('shows the metadata as text (STF-05)', () => {
    const html = renderToStaticMarkup(<AuditTable entries={entries} />);

    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });
});
