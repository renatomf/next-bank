'use client';

import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isCurrent, navigationFor } from './navigation';

/**
 * The pages a role may open (task 3.5, E9). The current one is the only
 * colored item: mint on a soft mint ground, as the app marks what is
 * selected. Collapsed, only the icons stay, each name in a tooltip and in
 * the link's accessible name.
 */
export function SidebarNav({
  role,
  currentPath,
  collapsed,
  onNavigate,
}: {
  role: string;
  currentPath: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <nav aria-label="Navegação principal" className="flex flex-col gap-1">
        {navigationFor(role).map(({ href, label, icon: Icon }) => {
          const current = isCurrent(href, currentPath);
          const link = (
            <Link
              key={href}
              href={href}
              {...(onNavigate ? { onClick: onNavigate } : {})}
              aria-current={current ? 'page' : undefined}
              aria-label={collapsed ? label : undefined}
              className={cn(
                'flex h-9 items-center gap-2.5 rounded-md text-[13px] whitespace-nowrap font-medium text-muted-foreground transition-colors duration-150',
                'hover:bg-accent hover:text-foreground motion-reduce:transition-none',
                current && 'bg-selected font-semibold text-link hover:bg-selected hover:text-link',
                collapsed ? 'w-9 justify-center' : 'px-2.5',
              )}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {collapsed ? null : label}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
