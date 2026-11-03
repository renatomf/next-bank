'use client';

import { Check, Undo2, X } from 'lucide-react';
import { useActionState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ApprovalRequest } from '@/lib/api';
import { APPROVAL_EFFECTS } from '@/lib/staff-words';
import { type DecisionState, decideRequest } from './actions';

const NO_ERROR: DecisionState = { error: null };

/**
 * What can be done with a pending request (v1.3.0 plan, task 4, K3): the
 * analyst approves or rejects it, the operator who asked cancels it. The
 * buttons only spare a refusal; the API refuses the requester deciding
 * (STF-03). One key per form, drawn when the page was rendered (K6).
 */
export function DecisionPanel({
  requestId,
  kind,
  canDecide,
  canCancel,
  decideKey,
  cancelKey,
}: {
  requestId: string;
  kind: ApprovalRequest['kind'];
  canDecide: boolean;
  canCancel: boolean;
  decideKey: string;
  cancelKey: string;
}) {
  const [state, act, pending] = useActionState(decideRequest, NO_ERROR);
  if (!canDecide && !canCancel) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{canDecide ? 'Decidir' : 'Cancelar o pedido'}</CardTitle>
        <CardDescription>
          {canDecide ? APPROVAL_EFFECTS[kind] : 'Só quem fez o pedido pode cancelá-lo.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={act} className="space-y-4">
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="idempotencyKey" value={canDecide ? decideKey : cancelKey} />
          {canDecide ? (
            <div className="space-y-2">
              <Label htmlFor="note">Nota (opcional)</Label>
              <Textarea id="note" name="note" maxLength={500} rows={3} />
            </div>
          ) : null}
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {canDecide ? (
              <>
                <Button type="submit" name="verb" value="approve" disabled={pending}>
                  <Check aria-hidden="true" />
                  Aprovar
                </Button>
                <Button
                  type="submit"
                  name="verb"
                  value="reject"
                  variant="outline"
                  disabled={pending}
                >
                  <X aria-hidden="true" />
                  Recusar
                </Button>
              </>
            ) : (
              <Button type="submit" name="verb" value="cancel" variant="outline" disabled={pending}>
                <Undo2 aria-hidden="true" />
                Cancelar pedido
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
