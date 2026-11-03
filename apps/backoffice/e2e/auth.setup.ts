import { expect, test as setup } from '@playwright/test';
import { sessionOf, STAFF, type StaffName } from './staff';

// Each member signs in once, through the login screen, and the tests reuse
// the session (P6): a TOTP code works once (STF-01), so signing in for every
// test would trip on the code just used. The session cookie stays out of
// reach of the page's scripts and of other sites (STF-06).
for (const name of Object.keys(STAFF) as StaffName[]) {
  setup(`signs in as ${name}`, async ({ page }) => {
    const member = STAFF[name];
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(member.email);
    await page.getByLabel('Senha').fill(member.password);
    await page.getByLabel('Código do autenticador').fill(member.totp.generate());
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL('/');
    const cookie = (await page.context().cookies()).find((each) => each.name === 'nb_staff');
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict' });
    await page.context().storageState({ path: sessionOf(name) });
  });
}
