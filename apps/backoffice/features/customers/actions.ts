'use server';

import { type CustomerSearch, SearchRefused } from '../../lib/api';
import { asSignedInMember } from '../../lib/backend';

export interface SearchState {
  result: CustomerSearch | null;
  error: string | null;
}

const REFUSALS: Readonly<Record<string, string>> = {
  InvalidCpf: 'Esse CPF não é válido. Confira os dígitos.',
  InvalidRequest: 'Digite ao menos 3 letras, um CPF, um e-mail ou o número da conta.',
};

/**
 * The staff's search (v1.3.0 plan, task 3, C2): a Server Action, so the term,
 * which may be a CPF, goes in the body of a POST and never in a URL, the
 * browser's history or the host's logs.
 */
export async function searchCustomers(
  _previous: SearchState,
  form: FormData,
): Promise<SearchState> {
  const query = form.get('query');
  try {
    const result = await asSignedInMember((api) =>
      api.searchCustomers(typeof query === 'string' ? query.trim() : ''),
    );
    return { result, error: null };
  } catch (error) {
    if (error instanceof SearchRefused) {
      return { result: null, error: REFUSALS[error.code] ?? 'Não foi possível buscar agora.' };
    }
    throw error;
  }
}
