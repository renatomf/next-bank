'use server';

import { cookies } from 'next/headers';
import { themeCookie, themeOf } from '@/lib/theme';

/** Keeps the member's theme; anything but light, dark or system follows the system. */
export async function setTheme(form: FormData): Promise<void> {
  const choice = form.get('theme');
  (await cookies()).set(themeCookie(themeOf(typeof choice === 'string' ? choice : undefined)));
}
