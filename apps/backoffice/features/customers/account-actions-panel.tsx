'use client';

import { Lock, LockOpen } from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type ActionState, blockAccount, requestUnblock } from './account-actions';
import { ReasonField } from './reason-field';

const NO_ERROR: ActionState = { error: null };

/**
 * What the staff does to a customer's account (v1.3.0 plan, task 4): block
 * it at once, after a confirmation, or ask someone else to unblock it. Each
 * form carries the key the server drew when it rendered the page (K6). The
 * buttons only spare a refusal: the API decides who may do what (K3).
 */
export function AccountActionsPanel({
  customerId,
  accountStatus,
  canBlock,
  canRequest,
  blockKey,
  requestKey,
}: {
  customerId: string;
  accountStatus: 'ACTIVE' | 'BLOCKED' | 'CLOSED';
  canBlock: boolean;
  canRequest: boolean;
  blockKey: string;
  requestKey: string;
}) {
  const [blockState, block, blocking] = useActionState(blockAccount, NO_ERROR);
  const [requestState, request, requesting] = useActionState(requestUnblock, NO_ERROR);
  const error = blockState.error ?? requestState.error;

  if (accountStatus === 'ACTIVE' && canBlock) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bloquear a conta</CardTitle>
          <CardDescription>
            O cliente sai de todas as sessões na hora, e nenhum dinheiro entra ou sai. Para
            desbloquear, outra pessoa precisa aprovar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Lock aria-hidden="true" />
                Bloquear conta
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <form action={block} className="space-y-4">
                <AlertDialogHeader>
                  <AlertDialogTitle>Bloquear esta conta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O cliente perde o acesso agora. O desbloqueio exige o pedido de um operador e a
                    aprovação de um analista.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <input type="hidden" name="customerId" value={customerId} />
                <input type="hidden" name="idempotencyKey" value={blockKey} />
                <ReasonField />
                <AlertDialogFooter>
                  <AlertDialogCancel type="button">Voltar</AlertDialogCancel>
                  <Button type="submit" variant="destructive" disabled={blocking}>
                    {blocking ? 'Bloqueando…' : 'Bloquear'}
                  </Button>
                </AlertDialogFooter>
              </form>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    );
  }

  if (accountStatus === 'BLOCKED' && canRequest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pedir o desbloqueio</CardTitle>
          <CardDescription>Um analista aprova ou recusa. Quem pede não decide.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={request} className="space-y-4">
            <input type="hidden" name="customerId" value={customerId} />
            <input type="hidden" name="idempotencyKey" value={requestKey} />
            <ReasonField />
            <div className="space-y-2">
              <Label htmlFor="note">Observação (opcional)</Label>
              <Textarea id="note" name="note" maxLength={500} rows={3} />
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" disabled={requesting}>
              <LockOpen aria-hidden="true" />
              {requesting ? 'Enviando…' : 'Pedir desbloqueio'}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return null;
}
