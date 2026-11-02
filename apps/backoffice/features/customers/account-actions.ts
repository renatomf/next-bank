'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CommandRefused, type Reason } from '@/lib/api';
import { asSignedInMember } from '@/lib/backend';
import { idempotencyKeyOf } from '@/lib/idempotency';
import { REASON_LABELS, refusalMessage } from '@/lib/staff-words';

export interface ActionState {
  error: string | null;
}

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

const isReason = (value: string): value is Reason => Object.hasOwn(REASON_LABELS, value);

function reasonOf(form: FormData): Reason {
  const reason = field(form, 'reason');
  if (!isReason(reason)) throw new Error('The form came with an unknown reason');
  return reason;
}

/**
 * Blocks the customer's account at once (v1.3.0 plan, task 4): the API
 * decides and shuts the customer out; this only carries the form's key (K6).
 */
export async function blockAccount(_previous: ActionState, form: FormData): Promise<ActionState> {
  const customerId = field(form, 'customerId');
  try {
    await asSignedInMember((api) =>
      api.blockAccount(customerId, reasonOf(form), idempotencyKeyOf(form)),
    );
  } catch (error) {
    if (error instanceof CommandRefused) return { error: refusalMessage(error.code) };
    throw error;
  }
  revalidatePath(`/clientes/${customerId}`);
  return { error: null };
}

/** Opens the request to unblock; someone else decides it, on the request's page. */
export async function requestUnblock(_previous: ActionState, form: FormData): Promise<ActionState> {
  const note = field(form, 'note');
  let requestId: string;
  try {
    const request = await asSignedInMember((api) =>
      api.requestUnblock(
        field(form, 'customerId'),
        reasonOf(form),
        note === '' ? null : note,
        idempotencyKeyOf(form),
      ),
    );
    requestId = request.id;
  } catch (error) {
    if (error instanceof CommandRefused) return { error: refusalMessage(error.code) };
    throw error;
  }
  redirect(`/pedidos/${requestId}`);
}
