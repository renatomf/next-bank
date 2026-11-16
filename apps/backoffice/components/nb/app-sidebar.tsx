'use client';

import { PanelLeftClose } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type MouseEvent, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { sidebarCookie } from '@/lib/sidebar';
import { cn } from '@/lib/utils';
import { Logo, LogoMark } from './logo';
import { SidebarNav } from './sidebar-nav';

/** One size for every control of the sidebar: a 36 px box, its icon centered. */
const CONTROL =
  'grid size-9 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none';

/**
 * The left sidebar of the desktop (task 3.5): open with icons and names,
 * collapsed to the icons alone. Collapsed, the brand at the top is the
 * button that opens it, and a click on the rail's empty space opens it too,
 * as in ChatGPT; open, the logo goes home
 * and the button beside it closes the sidebar. It starts as the server
 * rendered it, from the member's cookie, and a click keeps the choice.
 */
export function AppSidebar({ role, collapsed: initial }: { role: string; collapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initial);
  const pathname = usePathname();

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    // A screen preference the server reads on the next page (E7).
    document.cookie = sidebarCookie(next);
  }

  // Only the empty space: a link or a button keeps its own click. The mouse
  // shortcut needs no keyboard twin, the brand button already is one.
  function openFromRail(event: MouseEvent<HTMLElement>) {
    if (!collapsed) return;
    if (event.target instanceof Element && event.target.closest('a, button')) return;
    toggle();
  }

  return (
    <aside
      onClick={openFromRail}
      className={cn(
        // Clipped while the width animates, so the names never wrap or spill
        // past the border on the way; no centering, so nothing jumps sideways.
        'sticky top-0 hidden h-dvh shrink-0 flex-col gap-5 overflow-hidden border-r bg-card px-2.5 py-3 transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex',
        collapsed ? 'w-14 cursor-e-resize' : 'w-56',
      )}
    >
      <TooltipProvider delayDuration={200}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggle}
                aria-label="Abrir menu"
                aria-expanded={false}
                className={CONTROL}
              >
                <LogoMark />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Abrir menu</TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center justify-between">
            <Link
              href="/"
              aria-label="Início"
              className="shrink-0 pl-2.5 text-xl whitespace-nowrap"
            >
              <Logo />
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggle}
                  aria-label="Fechar menu"
                  aria-expanded
                  className={CONTROL}
                >
                  <PanelLeftClose aria-hidden="true" className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Fechar menu</TooltipContent>
            </Tooltip>
          </div>
        )}
      </TooltipProvider>
      <SidebarNav role={role} currentPath={pathname} collapsed={collapsed} />
    </aside>
  );
}
