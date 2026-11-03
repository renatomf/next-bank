import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NewMemberCredentials } from '../features/staff/new-member-credentials';
import { StaffTable } from '../features/staff/staff-table';

// The admin's screen of the staff (v1.3.0 plan, task 7): who is on it, with
// the role and status in words, the names as text (STF-05); and the
// credentials of a new member, shown once, as text to copy (G5).
const members = [
  {
    id: '0190f0b6-1b2c-7d3e-8f40-000000000001',
    name: '<b>Nina</b>',
    email: 'nina@example.test',
    role: 'OPERATOR' as const,
    status: 'ACTIVE' as const,
    isDemo: false,
    createdAt: '2026-11-03T12:00:00.000Z',
  },
  {
    id: '0190f0b6-1b2c-7d3e-8f40-000000000002',
    name: 'Diogo (analista demo)',
    email: 'diogo.demo@example.com',
    role: 'ANALYST' as const,
    status: 'DISABLED' as const,
    isDemo: true,
    createdAt: '2026-11-02T12:00:00.000Z',
  },
];

describe('StaffTable', () => {
  it('shows each member with its role and status in words, the name as text', () => {
    const html = renderToStaticMarkup(<StaffTable members={members} />);

    expect(html).toContain('&lt;b&gt;Nina&lt;/b&gt;');
    expect(html).toContain('Operador');
    expect(html).toContain('Analista');
    expect(html).toContain('Ativo');
    expect(html).toContain('Desativado');
    expect(html).toContain('Demo');
  });
});

describe('NewMemberCredentials', () => {
  it('shows the e-mail, password and authenticator key once, to copy now', () => {
    const html = renderToStaticMarkup(
      <NewMemberCredentials
        email="nina@example.test"
        credentials={{
          password: 'drawn-password',
          totpSecret: 'DRAWNSECRET',
          totpUri: 'otpauth://totp/next%20bank:nina@example.test?secret=DRAWNSECRET',
        }}
      />,
    );

    expect(html).toContain('nina@example.test');
    expect(html).toContain('drawn-password');
    expect(html).toContain('DRAWNSECRET');
    expect(html).toContain('só aparecem agora');
  });
});
