'use client';

import { ArrowLeftRight, UserX } from 'lucide-react';
import { useActionState } from 'react';
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
import type { StaffMemberView } from '@/lib/api';
import { type ActionState, changeStaffRole, disableStaffMember } from './actions';

const NO_ERROR: ActionState = { error: null };

/**
 * What the admin does with one active operator or analyst (v1.3.0 plan,
 * task 7): switch it to the other role, or disable it for good, after a
 * confirmation. The API refuses the admin itself and any admin (STF-14).
 */
export function MemberActions({ member }: { member: StaffMemberView }) {
  const [switched, switchRole, switching] = useActionState(changeStaffRole, NO_ERROR);
  const [disabled, disable, disabling] = useActionState(disableStaffMember, NO_ERROR);
  const other = member.role === 'OPERATOR' ? 'ANALYST' : 'OPERATOR';
  const error = switched.error ?? disabled.error;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <form action={switchRole}>
        <input type="hidden" name="memberId" value={member.id} />
        <input type="hidden" name="role" value={other} />
        <Button type="submit" variant="ghost" size="sm" disabled={switching}>
          <ArrowLeftRight aria-hidden="true" />
          {other === 'ANALYST' ? 'Tornar analista' : 'Tornar operador'}
        </Button>
      </form>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={`Desativar ${member.name}`}>
            <UserX aria-hidden="true" />
            Desativar
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <form action={disable} className="space-y-4">
            <AlertDialogHeader>
              <AlertDialogTitle>Desativar {member.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                As sessões abertas terminam na hora, e o acesso não volta: se preciso, crie outro
                membro.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <input type="hidden" name="memberId" value={member.id} />
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Voltar</AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={disabling}>
                Desativar
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
      {error ? <p className="w-full text-right text-sm text-danger">{error}</p> : null}
    </div>
  );
}
