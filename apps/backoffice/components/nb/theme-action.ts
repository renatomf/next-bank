'use server';

import { cookies } from 'next/headers';
import { chosenTheme, themeCookie } from '@/lib/theme';

/** Keeps the theme the toggle chose; anything but light or dark changes nothing. */
export async function setTheme(form: FormData): Promise<void> {
  const choice = chosenTheme(form.get('theme'));
  if (choice !== null) (await cookies()).set(themeCookie(choice));
}
