'use server';

import { revalidatePath } from 'next/cache';
import { CommandRefused, type CreatedStaffMember, type ManagedRole } from '@/lib/api';
import { asSignedInMember } from '@/lib/backend';
import { refusalMessage } from '@/lib/staff-words';

export interface ActionState {
  error: string | null;
}

/** The new member's sign-in, for this answer only (G5, STF-15): never kept, never logged. */
export interface CreationState extends ActionState {
  created: { email: string; credentials: CreatedStaffMember['credentials'] } | null;
}

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

function roleOf(form: FormData): ManagedRole {
  const role = field(form, 'role');
  if (role !== 'OPERATOR' && role !== 'ANALYST') {
    throw new Error('The form came with an unknown role');
  }
  return role;
}

/** Adds an operator or an analyst (v1.3.0 plan, task 7, G1); the API decides. */
export async function createStaffMember(
  _previous: CreationState,
  form: FormData,
): Promise<CreationState> {
  try {
    const created = await asSignedInMember((api) =>
      api.createStaffMember({
        name: field(form, 'name'),
        email: field(form, 'email'),
        role: roleOf(form),
      }),
    );
    revalidatePath('/staff');
    return {
      error: null,
      created: { email: created.member.email, credentials: created.credentials },
    };
  } catch (error) {
    if (error instanceof CommandRefused) {
      return { error: refusalMessage(error.code), created: null };
    }
    throw error;
  }
}

/** Switches a member between operator and analyst (G3: it counts on its next request). */
export async function changeStaffRole(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    await asSignedInMember((api) => api.changeStaffRole(field(form, 'memberId'), roleOf(form)));
  } catch (error) {
    if (error instanceof CommandRefused) return { error: refusalMessage(error.code) };
    throw error;
  }
  revalidatePath('/staff');
  return { error: null };
}

/** Disables a member for good (G4); the API ends its sessions (STF-06). */
export async function disableStaffMember(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    await asSignedInMember((api) => api.disableStaffMember(field(form, 'memberId')));
  } catch (error) {
    if (error instanceof CommandRefused) return { error: refusalMessage(error.code) };
    throw error;
  }
  revalidatePath('/staff');
  return { error: null };
}
