'use client';

import { UserPlus } from 'lucide-react';
import { useActionState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type CreationState, createStaffMember } from './actions';
import { NewMemberCredentials } from './new-member-credentials';

const NOTHING_YET: CreationState = { error: null, created: null };

/**
 * Adds an operator or an analyst (v1.3.0 plan, task 7, G1): never an admin,
 * which only the script creates. The new member's sign-in shows once, here.
 */
export function NewMemberForm() {
  const [state, create, creating] = useActionState(createStaffMember, NOTHING_YET);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Novo membro</CardTitle>
        <CardDescription>
          A senha e a chave do autenticador são geradas aqui e mostradas uma vez só.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.created ? (
          <NewMemberCredentials
            email={state.created.email}
            credentials={state.created.credentials}
          />
        ) : null}
        <form action={create} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="member-name">Nome</Label>
            <Input id="member-name" name="name" required minLength={2} maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-email">E-mail</Label>
            <Input id="member-email" name="email" type="email" required maxLength={254} />
          </div>
          {state.error ? (
            <Alert variant="destructive" className="sm:col-span-2">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <Button type="submit" name="role" value="OPERATOR" disabled={creating}>
              <UserPlus aria-hidden="true" />
              Criar operador
            </Button>
            <Button type="submit" name="role" value="ANALYST" variant="outline" disabled={creating}>
              <UserPlus aria-hidden="true" />
              Criar analista
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
