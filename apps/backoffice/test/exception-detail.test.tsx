import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExceptionDetail } from '../features/reconciliation/exception-detail';

// An exception of the daily reconciliation, as the staff reads it (v1.3.0
// plan, task 6): what kind of divergence, the Pix and its payer, and how it
// was resolved. The staff's explanation is shown as text, never run (STF-05).
const stale = {
  id: '0190f0b6-1b2c-7d3e-8f40-123456789abc',
  runDate: '2026-11-02',
  kind: 'STALE_PROCESSING' as const,
  endToEndId: 'E00000000202611021200abcdefghijk',
  expected: null,
  actual: null,
  detectedAt: '2026-11-03T06:30:00.000Z',
  status: 'OPEN' as const,
  pix: {
    id: '0190f0b6-1b2c-7d3e-8f40-000000000001',
    amount: { amount: 8000, currency: 'BRL' as const },
    status: 'PROCESSING',
    customer: { id: '0190f0b6-1b2c-7d3e-8f40-000000000002', name: 'Carla Demo' },
  },
  pendingRequestId: null,
  resolution: null,
};

describe('ExceptionDetail', () => {
  it('names the divergence, the Pix and its payer', () => {
    const html = renderToStaticMarkup(<ExceptionDetail exception={stale} />);

    expect(html).toContain('Pix parado sem resposta do SPI');
    expect(html).toContain('E00000000202611021200abcdefghijk');
    expect(html).toContain('R$ 80,00');
    expect(html).toContain('Carla Demo');
    expect(html).toContain('Aberta');
  });

  it('shows the amounts that differ, for a divergence without a Pix', () => {
    const html = renderToStaticMarkup(
      <ExceptionDetail
        exception={{
          ...stale,
          kind: 'CLEARING_MISMATCH',
          endToEndId: null,
          pix: null,
          expected: { amount: 10000, currency: 'BRL' },
          actual: { amount: 9000, currency: 'BRL' },
        }}
      />,
    );

    expect(html).toContain('Saldo da conta de compensação');
    expect(html).toContain('R$ 100,00');
    expect(html).toContain('R$ 90,00');
  });

  it('shows who resolved it and the explanation as text (STF-05)', () => {
    const html = renderToStaticMarkup(
      <ExceptionDetail
        exception={{
          ...stale,
          status: 'RESOLVED',
          resolution: {
            outcome: 'EXPLAINED',
            resolvedBy: { id: '0190f0b6-1b2c-7d3e-8f40-000000000003', name: 'Diogo' },
            resolvedAt: '2026-11-03T15:00:00.000Z',
            explanation: '<img src=x onerror=alert(1)> conferido',
            approvalRequestId: null,
          },
        }}
      />,
    );

    expect(html).toContain('Explicada');
    expect(html).toContain('Diogo');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; conferido');
    expect(html).not.toContain('<img');
  });
});
