import type { ReactNode } from 'react';
import { AppShell, type ShellLink } from '@/components/nb/app-shell';
import { READS_CUSTOMERS, ROLE_LABELS, signedInMember, themeOfThisRequest } from '@/lib/backend';
import { logout } from '../actions';

/** Every page after the login, inside the frame with the member's links. */
export default async function StaffLayout({ children }: { children: ReactNode }) {
  const [member, theme] = await Promise.all([signedInMember(), themeOfThisRequest()]);
  const links: ShellLink[] = READS_CUSTOMERS.includes(member.role)
    ? [{ href: '/clientes', label: 'Clientes' }]
    : [];

  return (
    <AppShell
      member={{ name: member.name, roleLabel: ROLE_LABELS[member.role] ?? member.role }}
      links={links}
      theme={theme}
      logout={logout}
    >
      {children}
    </AppShell>
  );
}
