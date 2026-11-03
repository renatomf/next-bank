import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ExceptionDetail } from '@/features/reconciliation/exception-detail';
import { ExplanationForm, ResolutionRequestForm } from '@/features/reconciliation/resolution-panel';
import { asSignedInMember, signedInMember } from '@/lib/backend';
import { newIdempotencyKey } from '@/lib/idempotency';

/**
 * One exception, and what the member may do with it while it is open (task
 * 6): the operator asks to settle or refund a Pix left waiting (X1, X3), the
 * analyst explains any of them (X2). The forms only spare a refusal: the
 * API decides who does what.
 */
export default async function ExceptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [exception, member] = await Promise.all([
    asSignedInMember((api) => api.exception(id)),
    signedInMember(),
  ]);
  if (!exception) notFound();
  const open = exception.status === 'OPEN' && exception.pendingRequestId === null;
  const settleable =
    exception.kind === 'STALE_PROCESSING' && exception.pix?.status === 'PROCESSING';
  const requestId = exception.pendingRequestId ?? exception.resolution?.approvalRequestId ?? null;

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/reconciliation">
          <ArrowLeft aria-hidden="true" />
          Conciliação
        </Link>
      </Button>
      <ExceptionDetail exception={exception} />
      {exception.pendingRequestId ? (
        <p className="text-muted-foreground">
          Há um pedido pendente para esta exceção: ela se resolve quando um analista o decidir.
        </p>
      ) : null}
      {open && settleable && member.role === 'OPERATOR' ? (
        <ResolutionRequestForm exceptionId={exception.id} idempotencyKey={newIdempotencyKey()} />
      ) : null}
      {open && member.role === 'ANALYST' ? (
        <ExplanationForm exceptionId={exception.id} idempotencyKey={newIdempotencyKey()} />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {requestId ? (
          <Button asChild variant="link">
            <Link href={`/requests/${requestId}`}>Abrir o pedido</Link>
          </Button>
        ) : null}
        {exception.pix ? (
          <Button asChild variant="link">
            <Link href={`/customers/${exception.pix.customer.id}`}>Abrir a ficha do cliente</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
