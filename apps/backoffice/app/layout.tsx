import type { Metadata } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { themeOfThisRequest } from '@/lib/backend';
import './globals.css';

// The app's own fonts (brief, section 3; task 3.5, E3): the variable files of
// packages/design_system, served from this site.
const sora = localFont({
  src: '../../../packages/design_system/fonts/Sora-Variable.ttf',
  variable: '--font-sora',
  display: 'swap',
});
const manrope = localFont({
  src: '../../../packages/design_system/fonts/Manrope-Variable.ttf',
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'next bank · backoffice',
  description: 'Backoffice de demonstração do next bank, um banco fictício.',
  robots: { index: false, follow: false },
};

/** The theme comes with the page, from the cookie: no flash and no script (E2). */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = await themeOfThisRequest();
  return (
    <html lang="pt-BR" data-theme={theme} className={`${sora.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
