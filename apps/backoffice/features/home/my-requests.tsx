import { DeadlineBadge } from '@/components/nb/deadline-badge';
import { RequestStatusBadge } from '@/components/nb/request-status-badge';
import type { ApprovalRequestsPage } from '@/lib/api';
import { AllClear, BlockError, HomeBlock } from './home-block';
import type { Loaded } from './load-home';
import { countOf, oldestFirst } from './queue';
import { RequestRow } from './request-row';

const RECENT = 5;

/** The operator's requests (home plan, H1): what still waits, and how the last ones ended. */
export function MyRequests({
  loaded,
  now,
  className,
}: {
  loaded: Loaded<{ pending: ApprovalRequestsPage; recent: ApprovalRequestsPage }>;
  now: Date;
  className?: string;
}) {
  if (!loaded.ok) {
    return (
      <HomeBlock title="Seus pedidos" href="/requests" className={className}>
        <BlockError />
      </HomeBlock>
    );
  }
  const { pending, recent } = loaded.value;
  const decided = recent.items.filter((request) => request.decision !== null).slice(0, RECENT);
  return (
    <HomeBlock title="Seus pedidos" href="/requests?status=ALL" className={className}>
      {pending.items.length === 0 && decided.length === 0 ? (
        <AllClear
          title="Você não tem pedidos abertos"
          detail="Os desbloqueios, estornos e resoluções que você pedir aparecem aqui."
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-1">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Esperando decisão ({countOf(pending)})
            </h3>
            {pending.items.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Nenhum pedido esperando.</p>
            ) : (
              <ul className="divide-y">
                {oldestFirst(pending.items, (request) => request.requestedAt).map((request) => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    status={<DeadlineBadge expiresAt={request.expiresAt} now={now} />}
                  />
                ))}
              </ul>
            )}
          </section>
          {decided.length > 0 ? (
            <section className="space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground">Decididos por último</h3>
              <ul className="divide-y">
                {decided.map((request) => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    status={<RequestStatusBadge status={request.status} />}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </HomeBlock>
  );
}
