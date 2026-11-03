'use client';

import { CheckCheck, MessageSquareText, Undo2 } from 'lucide-react';
import { useActionState } from 'react';
import { ReasonField } from '@/components/nb/reason-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type ActionState, explainException, requestResolution } from './actions';

const NO_ERROR: ActionState = { error: null };

function Refusal({ error }: { error: string | null }) {
  return error ? (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null;
}

/**
 * The operator asks to settle or refund a Pix left waiting, after checking
 * with the SPI; an analyst approves it (v1.3.0 plan, task 6, X1, X3). Each
 * form carries the key drawn when the page was rendered (K6).
 */
export function ResolutionRequestForm({
  exceptionId,
  idempotencyKey,
}: {
  exceptionId: string;
  idempotencyKey: string;
}) {
  const [state, ask, asking] = useActionState(requestResolution, NO_ERROR);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Pedir a resolução</CardTitle>
        <CardDescription>
          Confira com o SPI antes: liquidar conclui o Pix, estornar devolve o valor ao cliente. Um
          analista aprova; quem pede não aprova.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={ask} className="space-y-4">
          <input type="hidden" name="exceptionId" value={exceptionId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <ReasonField id="resolution-reason" />
          <div className="space-y-2">
            <Label htmlFor="resolution-note">Observação (opcional)</Label>
            <Textarea id="resolution-note" name="note" maxLength={500} rows={3} />
          </div>
          <Refusal error={state.error} />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" name="resolution" value="SETTLE" disabled={asking}>
              <CheckCheck aria-hidden="true" />
              Pedir para liquidar
            </Button>
            <Button
              type="submit"
              name="resolution"
              value="REFUND"
              variant="outline"
              disabled={asking}
            >
              <Undo2 aria-hidden="true" />
              Pedir para estornar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** The analyst resolves an exception that needs nothing more, moving no money (X2). */
export function ExplanationForm({
  exceptionId,
  idempotencyKey,
}: {
  exceptionId: string;
  idempotencyKey: string;
}) {
  const [state, explain, explaining] = useActionState(explainException, NO_ERROR);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Dar como explicada</CardTitle>
        <CardDescription>
          Nada se move: a exceção fica resolvida com a sua explicação, e a auditoria guarda quem
          explicou.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={explain} className="space-y-4">
          <input type="hidden" name="exceptionId" value={exceptionId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <div className="space-y-2">
            <Label htmlFor="explanation">Explicação</Label>
            <Textarea
              id="explanation"
              name="explanation"
              required
              minLength={10}
              maxLength={500}
              rows={3}
            />
          </div>
          <Refusal error={state.error} />
          <Button type="submit" variant="outline" disabled={explaining}>
            <MessageSquareText aria-hidden="true" />
            Dar como explicada
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
