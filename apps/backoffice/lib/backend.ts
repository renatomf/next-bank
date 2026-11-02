import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { adminApi, SessionEnded } from './api';
import { SESSION_COOKIE } from './session';
import { THEME_COOKIE, themeOf } from './theme';

/** The configuration of this server: never sent to a browser (STF-08). */
function settings(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.API_URL;
  const apiKey = process.env.BACKOFFICE_API_KEY;
  if (!baseUrl || !apiKey) throw new Error('API_URL and BACKOFFICE_API_KEY are not set');
  return { baseUrl, apiKey };
}

/** The API, as the member of this request's session (or no one, before the login). */
export async function apiForThisRequest() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return adminApi({ ...settings(), token: token === '' ? undefined : token });
}

/** A read as the member of this session; the login when the API no longer takes it. */
export async function asSignedInMember<T>(
  read: (api: Awaited<ReturnType<typeof apiForThisRequest>>) => Promise<T>,
): Promise<T> {
  try {
    return await read(await apiForThisRequest());
  } catch (error) {
    if (error instanceof SessionEnded) redirect('/login?sessao=expirada');
    throw error;
  }
}

/**
 * The member signed in, or the login when the API no longer takes the session.
 * Asked once per request: the frame and the page share the answer.
 */
export const signedInMember = cache(() => asSignedInMember((api) => api.me()));

/** The member's theme, from the cookie: the system's until one is picked (task 3.5, E2). */
export async function themeOfThisRequest() {
  return themeOf((await cookies()).get(THEME_COOKIE)?.value);
}

/** How each role reads on the screen. */
export const ROLE_LABELS: Readonly<Record<string, string>> = {
  OPERATOR: 'Operação',
  ANALYST: 'Análise',
  ADMIN: 'Administração',
};

/** The roles that read customers; the API decides, this only spares a 403 (task 3, C1). */
export const READS_CUSTOMERS: readonly string[] = ['OPERATOR', 'ANALYST'];
