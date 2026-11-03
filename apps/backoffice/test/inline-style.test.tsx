import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Logo } from '../components/nb/logo';
import { MoneyText } from '../components/nb/money-text';
import { SidebarNav } from '../components/nb/sidebar-nav';
import { ThemeToggle } from '../components/nb/theme-toggle';
import { StatementList } from '../features/customers/statement-list';
import { ExceptionDetail } from '../features/reconciliation/exception-detail';
import { ExceptionsTable } from '../features/reconciliation/exceptions-table';
import { NewMemberCredentials } from '../features/staff/new-member-credentials';
import { StaffTable } from '../features/staff/staff-table';
import { RequestDetail } from '../features/requests/request-detail';
import { RequestsTable } from '../features/requests/requests-table';

// The CSP has no unsafe-inline (STF-05; task 3.5, E5): a style attribute in
// the server's HTML would be dropped by the browser. Every component the
// screens use renders without one.
// An exception of the reconciliation as the API answers it (task 6), explained.
const exception = {
  id: '0190f0b6-1b2c-7d3e-8f40-123456789abf',
  runDate: '2026-11-02',
  kind: 'STALE_PROCESSING' as const,
  endToEndId: 'E00000000202611021200abcdefghijk',
  expected: null,
  actual: null,
  detectedAt: '2026-11-03T06:30:00.000Z',
  status: 'RESOLVED' as const,
  pix: {
    id: '0190f0b6-1b2c-7d3e-8f40-123456789ab0',
    amount: { amount: 8000, currency: 'BRL' as const },
    status: 'COMPLETED',
    customer: { id: '0190f0b6-1b2c-7d3e-8f40-123456789abd', name: 'Carla Demo' },
  },
  pendingRequestId: null,
  resolution: {
    outcome: 'EXPLAINED' as const,
    resolvedBy: { id: '0190f0b6-1b2c-7d3e-8f40-123456789ab1', name: 'Diogo' },
    resolvedAt: '2026-11-03T15:00:00.000Z',
    explanation: 'Conferido no SPI: liquidado no dia seguinte.',
    approvalRequestId: null,
  },
};

// A request as the API answers it (task 4), decided, with notes.
const request = {
  id: '0190f0b6-1b2c-7d3e-8f40-123456789abc',
  kind: 'UNBLOCK_ACCOUNT' as const,
  status: 'APPROVED' as const,
  customer: { id: '0190f0b6-1b2c-7d3e-8f40-123456789abd', name: 'Carla Demo' },
  transfer: null,
  exception: null,
  reason: 'CUSTOMER_REQUEST' as const,
  note: 'Cliente confirmou a identidade',
  requestedBy: { id: '0190f0b6-1b2c-7d3e-8f40-123456789abe', name: 'Olívia' },
  requestedAt: '2026-11-02T12:00:00.000Z',
  expiresAt: '2026-11-03T12:00:00.000Z',
  decision: {
    decision: 'APPROVED' as const,
    decidedBy: { id: '0190f0b6-1b2c-7d3e-8f40-123456789abf', name: 'Diogo' },
    decidedAt: '2026-11-02T13:00:00.000Z',
    note: '<b>conferido</b>',
  },
};

const rendered: [string, ReactElement][] = [
  [
    'Alert',
    <Alert key="a">
      <AlertDescription>x</AlertDescription>
    </Alert>,
  ],
  ['Badge', <Badge key="b">x</Badge>],
  ['Button', <Button key="c">x</Button>],
  [
    'Card',
    <Card key="d">
      <CardHeader>
        <CardTitle>x</CardTitle>
      </CardHeader>
      <CardContent>x</CardContent>
    </Card>,
  ],
  ['Input', <Input key="e" />],
  ['Label', <Label key="f">x</Label>],
  ['Separator', <Separator key="g" />],
  [
    'Table',
    <Table key="h">
      <TableHeader>
        <TableRow>
          <TableHead>x</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>x</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  ],
  ['Logo', <Logo key="i" />],
  [
    'SidebarNav, open',
    <SidebarNav key="l" role="ANALYST" currentPath="/customers" collapsed={false} />,
  ],
  [
    'SidebarNav, collapsed to icons with tooltips',
    <SidebarNav key="m" role="ANALYST" currentPath="/" collapsed />,
  ],
  ['ThemeToggle', <ThemeToggle key="n" />],
  ['RequestsTable', <RequestsTable key="o" requests={[request]} />],
  ['RequestDetail', <RequestDetail key="p" request={request} />],
  ['ExceptionsTable', <ExceptionsTable key="q" exceptions={[exception]} />],
  ['ExceptionDetail', <ExceptionDetail key="r" exception={exception} />],
  [
    'StaffTable',
    <StaffTable
      key="s"
      members={[
        {
          id: '0190f0b6-1b2c-7d3e-8f40-123456789ab2',
          name: 'Nina',
          email: 'nina@example.test',
          role: 'OPERATOR',
          status: 'ACTIVE',
          isDemo: false,
          createdAt: '2026-11-03T12:00:00.000Z',
        },
      ]}
    />,
  ],
  [
    'NewMemberCredentials',
    <NewMemberCredentials
      key="t"
      email="nina@example.test"
      credentials={{ password: 'p', totpSecret: 'S', totpUri: 'otpauth://totp/x?secret=S' }}
    />,
  ],
  ['MoneyText', <MoneyText key="j" money={{ amount: 123456, currency: 'BRL' }} />],
  [
    'StatementList',
    <StatementList
      key="k"
      items={[
        {
          id: '0190f0b6-1b2c-7d3e-8f40-123456789abc',
          occurredAt: '2026-11-02T12:00:00.000Z',
          kind: 'PIX_SENT',
          direction: 'OUT',
          amount: { amount: 1500, currency: 'BRL' },
          counterparty: { name: 'Bruno', documentMasked: '***.444.777-**' },
          transferId: null,
          topUpId: null,
        },
      ]}
    />,
  ],
];

describe('the components of the screens', () => {
  it.each(rendered)('%s renders with no inline style', (_name, element) => {
    expect(renderToStaticMarkup(element)).not.toMatch(/\sstyle="/);
  });
});

// The sidebar marks where the member is and keeps every name for screen
// readers, even collapsed to icons (task 3.5; brief, section 8).
describe('SidebarNav', () => {
  it('marks the current page', () => {
    const html = renderToStaticMarkup(
      <SidebarNav role="ANALYST" currentPath="/customers/0190f0b6" collapsed={false} />,
    );

    const current = [...html.matchAll(/<a [^>]*>/g)].filter(([tag]) =>
      tag.includes('aria-current="page"'),
    );
    expect(current.map(([tag]) => /href="([^"]+)"/.exec(tag)?.[1])).toEqual(['/customers']);
    expect(html).toContain('Clientes');
  });

  it('keeps the names as accessible labels when collapsed', () => {
    const html = renderToStaticMarkup(<SidebarNav role="ANALYST" currentPath="/" collapsed />);

    expect(html).toContain('aria-label="Início"');
    expect(html).toContain('aria-label="Clientes"');
  });
});

// The staff's notes are shown as text, never run (STF-05).
describe('RequestDetail', () => {
  it('shows a note with markup as text', () => {
    const html = renderToStaticMarkup(<RequestDetail request={request} />);

    expect(html).toContain('&lt;b&gt;conferido&lt;/b&gt;');
  });
});
