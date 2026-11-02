'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoginRefused, SessionEnded } from '../lib/api';
import { apiForThisRequest } from '../lib/backend';
import { clearedSessionCookie, sessionCookie } from '../lib/session';

export interface LoginState {
  error: string | null;
}

const REFUSALS: Readonly<Record<string, string>> = {
  InvalidCredentials: 'E-mail, senha ou código incorretos.',
  TooManyAttempts: 'Muitas tentativas. Tente de novo em alguns minutos.',
  InvalidRequest: 'Confira o e-mail, a senha e o código de 6 dígitos.',
};

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
};

/**
 * The staff's login (v1.3.0 plan, task 2): the API decides; this only keeps
 * the session it opened in the cookie (D1). Next.js refuses a Server Action
 * whose origin is another site's (STF-04).
 */
export async function login(_previous: LoginState, form: FormData): Promise<LoginState> {
  try {
    const api = await apiForThisRequest();
    const session = await api.login({
      email: field(form, 'email').trim(),
      password: field(form, 'password'),
      mfaCode: field(form, 'mfaCode').trim(),
    });
    (await cookies()).set(sessionCookie(session.token, session.expiresAt));
  } catch (error) {
    if (error instanceof LoginRefused) {
      return { error: REFUSALS[error.code] ?? 'Não foi possível entrar agora. Tente de novo.' };
    }
    throw error;
  }
  redirect('/');
}

/** Ends the session at the API and in the browser. */
export async function logout(): Promise<void> {
  try {
    const api = await apiForThisRequest();
    await api.logout();
  } catch (error) {
    // Already ended at the API: the cookie still goes.
    if (!(error instanceof SessionEnded)) throw error;
  }
  (await cookies()).set(clearedSessionCookie());
  redirect('/login');
}
