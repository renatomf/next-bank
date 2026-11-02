'use client';

import { useActionState } from 'react';
import { login, type LoginState } from '../actions';

const NO_ERROR: LoginState = { error: null };

/** E-mail, password and the authenticator's code, sent to the server's action. */
export function LoginForm({ notice }: { notice: string | null }) {
  const [state, action, pending] = useActionState(login, NO_ERROR);
  const error = state.error ?? notice;

  return (
    <form action={action}>
      <label htmlFor="email">E-mail</label>
      <input id="email" name="email" type="email" autoComplete="username" required />
      <label htmlFor="password">Senha</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <label htmlFor="mfaCode">Código do autenticador</label>
      <input
        id="mfaCode"
        name="mfaCode"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
      />
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
