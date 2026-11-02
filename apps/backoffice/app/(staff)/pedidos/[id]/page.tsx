import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DecisionPanel } from '@/features/requests/decision-panel';
import { RequestDetail } from '@/features/requests/request-detail';
import { asSignedInMember, signedInMember } from '@/lib/backend';
import { newIdempotencyKey } from '@/lib/idempotency';

/** One request, and what the member may do with it while it is pending (task 4, K3). */
export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [request, member] = await Promise.all([
    asSignedInMember((api) => api.request(id)),
    signedInMember(),
  ]);
  if (!request) notFound();
  const pending = request.status === 'PENDING';

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/pedidos">
          <ArrowLeft aria-hidden="true" />
          Pedidos
        </Link>
      </Button>
      <RequestDetail request={request} />
      <DecisionPanel
        requestId={request.id}
        canDecide={pending && member.role === 'ANALYST'}
        canCancel={pending && member.role === 'OPERATOR'}
        decideKey={newIdempotencyKey()}
        cancelKey={newIdempotencyKey()}
      />
      <Button asChild variant="link">
        <Link href={`/clientes/${request.customer.id}`}>Abrir a ficha do cliente</Link>
      </Button>
    </div>
  );
}
