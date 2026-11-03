'use client';

import { Undo2 } from 'lucide-react';
import { useActionState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type ActionState, requestReversal } from './account-actions';
import { ReasonField } from '@/components/nb/reason-field';

const NO_ERROR: ActionState = { error: null };

/**
 * Asks to reverse one sent Pix (v1.3.0 plan, task 5): the request names the
 * Pix, never an amount (PIX-14), and an analyst approves it. The key was
 * drawn when the server rendered the statement (K6).
 */
export function ReversalButton({
  transferId,
  amountText,
  idempotencyKey,
}: {
  transferId: string;
  amountText: string;
  idempotencyKey: string;
}) {
  const [state, ask, asking] = useActionState(requestReversal, NO_ERROR);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Pedir estorno do Pix de ${amountText}`}>
          <Undo2 aria-hidden="true" />
          Estornar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={ask} className="space-y-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Pedir o estorno deste Pix?</AlertDialogTitle>
            <AlertDialogDescription>
              Quem recebeu devolve {amountText} a quem pagou, depois que um analista aprovar. Quem
              pede não aprova.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input type="hidden" name="transferId" value={transferId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <ReasonField id={`reason-${transferId}`} />
          <div className="space-y-2">
            <Label htmlFor={`note-${transferId}`}>Observação (opcional)</Label>
            <Textarea id={`note-${transferId}`} name="note" maxLength={500} rows={3} />
          </div>
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Voltar</AlertDialogCancel>
            <Button type="submit" disabled={asking}>
              {asking ? 'Enviando…' : 'Pedir estorno'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
