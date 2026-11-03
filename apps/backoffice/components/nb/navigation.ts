import { ClipboardCheck, House, type LucideIcon, Scale, Users } from 'lucide-react';

export interface NavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Who sees it; none means every role. The API decides either way (STF-02). */
  roles?: readonly string[];
}

// One list for the sidebar, the drawer and the home's shortcuts (task 3.5,
// E9). Each task of v1.3.0 adds its own item: requests, exceptions, staff, audit.
const ITEMS: readonly NavigationItem[] = [
  { href: '/', label: 'Início', icon: House },
  { href: '/customers', label: 'Clientes', icon: Users, roles: ['OPERATOR', 'ANALYST'] },
  { href: '/requests', label: 'Pedidos', icon: ClipboardCheck, roles: ['OPERATOR', 'ANALYST'] },
  { href: '/reconciliation', label: 'Conciliação', icon: Scale, roles: ['OPERATOR', 'ANALYST'] },
];

/** The items a role may open. */
export function navigationFor(role: string): NavigationItem[] {
  return ITEMS.filter((item) => item.roles === undefined || item.roles.includes(role));
}

/** Whether [href] is the page at [path], or a page under it ("/" only itself). */
export function isCurrent(href: string, path: string): boolean {
  return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
}
