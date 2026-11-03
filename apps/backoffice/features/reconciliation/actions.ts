'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CommandRefused, type Reason, type Resolution } from '@/lib/api';
import { asSignedInMember } from '@/lib/backend';
import { idempotencyKeyOf } from '@/lib/idempotency';
import { REASON_LABELS, RESOLUTION_LABELS, refusalMessage } from '@/lib/staff-words';

export interface ActionState {
  error: string | null;
}

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

function chosen<T extends string>(form: FormData, name: string, labels: Record<T, string>): T {
  const value = field(form, name);
  if (!Object.hasOwn(labels, value)) throw new Error(`The form came with an unknown ${name}`);
  return value as T;
}

/**
 * Opens the request to settle or refund a Pix left waiting (v1.3.0 plan,
 * task 6, X3); an analyst decides it, on the request's page.
 */
export async function requestResolution(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const note = field(form, 'note');
  let requestId: string;
  try {
    const request = await asSignedInMember((api) =>
      api.requestResolution(
        field(form, 'exceptionId'),
        chosen<Resolution>(form, 'resolution', RESOLUTION_LABELS),
        chosen<Reason>(form, 'reason', REASON_LABELS),
        note === '' ? null : note,
        idempotencyKeyOf(form),
      ),
    );
    requestId = request.id;
  } catch (error) {
    if (error instanceof CommandRefused) return { error: refusalMessage(error.code) };
    throw error;
  }
  redirect(`/requests/${requestId}`);
}

/**
 * Resolves an exception that needs nothing more (task 6, X2). The text goes
 * on one line: the API keeps no control characters.
 */
export async function explainException(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const exceptionId = field(form, 'exceptionId');
  const explanation = field(form, 'explanation').replace(/\s+/g, ' ');
  try {
    await asSignedInMember((api) =>
      api.explainException(exceptionId, explanation, idempotencyKeyOf(form)),
    );
  } catch (error) {
    if (error instanceof CommandRefused) return { error: refusalMessage(error.code) };
    throw error;
  }
  revalidatePath(`/reconciliation/${exceptionId}`);
  revalidatePath('/reconciliation');
  return { error: null };
}
