import { expect, test } from '@playwright/test';
import { STAFF } from './staff';

// A Server Action posted from another site is refused (STF-04): Next.js
// compares the request's Origin with the host before running the action, so
// a page elsewhere cannot sign anyone in nor act for a member. The login the
// browser submits is sent on with a forged Origin, as a cross-site form
// would carry it; the browser itself never lets a page forge that header,
// so the request is replayed by Playwright's own client, unchanged otherwise.
test('refuses a Server Action from another origin, and opens no session', async ({ page }) => {
  let refused: { status: number; setsSession: boolean } | null = null;
  await page.route('**/login', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') return route.continue();
    const response = await route.fetch({
      headers: { ...request.headers(), origin: 'https://attacker.example' },
    });
    refused = {
      status: response.status(),
      setsSession: (response.headers()['set-cookie'] ?? '').includes('nb_staff='),
    };
    return route.fulfill({ response });
  });
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(STAFF.diogo.email);
  await page.getByLabel('Senha').fill(STAFF.diogo.password);
  await page.getByLabel('Código do autenticador').fill(STAFF.diogo.totp.generate());

  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect.poll(() => refused).toEqual({ status: 500, setsSession: false });
  expect((await page.context().cookies()).map((cookie) => cookie.name)).not.toContain('nb_staff');
  await expect(page).toHaveURL(/\/login$/);
});
