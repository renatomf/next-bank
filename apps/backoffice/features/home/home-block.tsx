import { ChevronRight, CircleCheck } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** One block of the home: a title, a link to the whole list, and its content. */
export function HomeBlock({
  title,
  href,
  linkLabel = 'Ver todos',
  className,
  children,
}: {
  title: string;
  href: string;
  linkLabel?: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardAction>
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-sm font-semibold text-link hover:underline"
          >
            {linkLabel}
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Nothing waiting: said plainly, with the brand's check. */
export function AllClear({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-selected text-link">
        <CircleCheck aria-hidden="true" className="size-7" />
      </span>
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

/** A block whose list could not be read this time; the others stay. */
export function BlockError() {
  return (
    <p role="status" className="text-sm text-muted-foreground">
      Não foi possível carregar agora. Atualize a página para tentar de novo.
    </p>
  );
}
