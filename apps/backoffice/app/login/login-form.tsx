'use client';

import { ArrowUpRight } from 'lucide-react';
import { useActionState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login, type LoginState } from '../actions';

const NO_ERROR: LoginState = { error: null };

/** E-mail, password and the authenticator's code, sent to the server's action. */
export function LoginForm({ notice }: { notice: string | null }) {
  const [state, action, pending] = useActionState(login, NO_ERROR);
  const error = state.error ?? notice;

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mfaCode">Código do autenticador</Label>
        <Input
          id="mfaCode"
          name="mfaCode"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
        />
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
        <ArrowUpRight aria-hidden="true" />
      </Button>
    </form>
  );
}
