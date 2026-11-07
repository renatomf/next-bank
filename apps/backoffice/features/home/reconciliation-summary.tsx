import type { ReconciliationExceptionsPage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { AllClear, BlockError, HomeBlock } from './home-block';
import type { Loaded } from './load-home';
import { countOf, oldestFirst } from './queue';

/** What the daily reconciliation left open (home plan): how many, and since when. */
export function ReconciliationSummary({
  loaded,
  className,
}: {
  loaded: Loaded<ReconciliationExceptionsPage>;
  className?: string;
}) {
  return (
    <HomeBlock title="Conciliação" href="/reconciliation" linkLabel="Abrir" className={className}>
      {!loaded.ok ? (
        <BlockError />
      ) : loaded.value.items.length === 0 ? (
        <AllClear
          title="Nenhuma exceção em aberto"
          detail="A conciliação diária bateu com o SPI."
        />
      ) : (
        <OpenExceptions page={loaded.value} />
      )}
    </HomeBlock>
  );
}

function OpenExceptions({ page }: { page: ReconciliationExceptionsPage }) {
  const count = countOf(page);
  const [oldest] = oldestFirst(page.items, (exception) => exception.detectedAt);
  return (
    <div className="space-y-1 py-2">
      <p className="font-display text-4xl font-semibold tabular-nums">{count}</p>
      <p className="font-semibold">{count === '1' ? 'exceção em aberto' : 'exceções em aberto'}</p>
      {oldest ? (
        <p className="text-sm text-muted-foreground">
          A mais antiga foi encontrada em {formatDateTime(oldest.detectedAt)}.
        </p>
      ) : null}
    </div>
  );
}
