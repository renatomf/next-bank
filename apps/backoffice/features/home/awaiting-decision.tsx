import { DeadlineBadge } from '@/components/nb/deadline-badge';
import type { ApprovalRequestsPage } from '@/lib/api';
import { AllClear, BlockError, HomeBlock } from './home-block';
import type { Loaded } from './load-home';
import { countOf, oldestFirst } from './queue';
import { RequestRow } from './request-row';

/** The analyst's queue (home plan): the pending requests, the closest to expiring first. */
export function AwaitingDecision({
  loaded,
  now,
  className,
}: {
  loaded: Loaded<ApprovalRequestsPage>;
  now: Date;
  className?: string;
}) {
  const title = loaded.ok
    ? `Aguardando sua decisão (${countOf(loaded.value)})`
    : 'Aguardando sua decisão';
  return (
    <HomeBlock title={title} href="/requests" className={className}>
      {!loaded.ok ? (
        <BlockError />
      ) : loaded.value.items.length === 0 ? (
        <AllClear
          title="Nada esperando por você"
          detail="Os pedidos que precisarem da sua decisão aparecem aqui."
        />
      ) : (
        <ul className="divide-y">
          {oldestFirst(loaded.value.items, (request) => request.requestedAt).map((request) => (
            <RequestRow
              key={request.id}
              request={request}
              status={<DeadlineBadge expiresAt={request.expiresAt} now={now} />}
            />
          ))}
        </ul>
      )}
    </HomeBlock>
  );
}
