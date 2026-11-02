import type { ReactNode } from 'react';
import { AppShell } from '@/components/nb/app-shell';
import { ROLE_LABELS, sidebarCollapsedOfThisRequest, signedInMember } from '@/lib/backend';
import { logout } from '../actions';

/** Every page after the login, inside the frame, with the sidebar as the member left it. */
export default async function StaffLayout({ children }: { children: ReactNode }) {
  const [member, sidebarCollapsed] = await Promise.all([
    signedInMember(),
    sidebarCollapsedOfThisRequest(),
  ]);

  return (
    <AppShell
      member={{
        name: member.name,
        role: member.role,
        roleLabel: ROLE_LABELS[member.role] ?? member.role,
      }}
      sidebarCollapsed={sidebarCollapsed}
      logout={logout}
    >
      {children}
    </AppShell>
  );
}
