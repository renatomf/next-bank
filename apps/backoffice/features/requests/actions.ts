'use server';

import { revalidatePath } from 'next/cache';
import { CommandRefused } from '@/lib/api';
import { asSignedInMember } from '@/lib/backend';
import { idempotencyKeyOf } from '@/lib/idempotency';
import { refusalMessage } from '@/lib/staff-words';

export interface DecisionState {
  error: string | null;
}

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

/**
 * Approves, rejects or cancels a request (v1.3.0 plan, task 4). The API
 * refuses the requester deciding, anyone but the requester cancelling, and
 * a second decision (STF-03, STF-09); this only carries the form's key (K6).
 */
export async function decideRequest(
  _previous: DecisionState,
  form: FormData,
): Promise<DecisionState> {
  const requestId = field(form, 'requestId');
  const verb = field(form, 'verb');
  const note = field(form, 'note');
  const key = idempotencyKeyOf(form);
  try {
    await asSignedInMember((api) => {
      if (verb === 'cancel') return api.cancelRequest(requestId, key);
      if (verb === 'approve' || verb === 'reject') {
        return api.decideRequest(requestId, verb, note === '' ? null : note, key);
      }
      throw new Error('The form came with an unknown decision');
    });
  } catch (error) {
    if (error instanceof CommandRefused) return { error: refusalMessage(error.code) };
    throw error;
  }
  revalidatePath(`/requests/${requestId}`);
  revalidatePath('/requests');
  return { error: null };
}
