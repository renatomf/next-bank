import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminApi, SessionEnded } from './api';
import { SESSION_COOKIE } from './session';

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

/** The member signed in, or the login when the API no longer takes the session. */
export async function signedInMember() {
  try {
    const api = await apiForThisRequest();
    return await api.me();
  } catch (error) {
    if (error instanceof SessionEnded) redirect('/login?sessao=expirada');
    throw error;
  }
}
