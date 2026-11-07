import { type Browser, expect, type Page, test } from '@playwright/test';
import { sessionOf, type StaffName } from './staff';

// The two-person approval end to end (v1.3.0 plan, task 9; "Pronto quando"
// (2)): the operator blocks Carla and asks to unblock her, and never sees a
// way to approve her own request (STF-03); the analyst approves, Carla's
// account is active again, and the request's trail names both of them.
// The homes carry the request (home plan): the operator's own, pending and
// then approved; the analyst's queue, from which she decides.
async function pageOf(browser: Browser, name: StaffName): Promise<Page> {
  const context = await browser.newContext({ storageState: sessionOf(name) });
  return context.newPage();
}

async function pickReason(page: Page, reason: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Motivo' }).click();
  await page.getByRole('option', { name: reason }).click();
}

test('two people unblock an account, and the requester never approves', async ({ browser }) => {
  const operator = await pageOf(browser, 'olivia');
  const analyst = await pageOf(browser, 'diogo');

  // The operator finds Carla, whose account is active.
  await operator.goto('/customers');
  await operator.getByLabel('CPF, e-mail, conta ou nome').fill('carla.demo@example.com');
  await operator.getByRole('button', { name: 'Buscar' }).click();
  await operator.getByRole('link', { name: /Carla Demo/ }).click();
  await expect(operator.getByText('Conta ativa')).toBeVisible();
  const customerUrl = operator.url();

  // She blocks the account at once (B6).
  await operator.getByRole('button', { name: 'Bloquear conta' }).click();
  await pickReason(operator, 'Suspeita de fraude');
  await operator.getByRole('button', { name: 'Bloquear', exact: true }).click();
  await expect(operator.getByText('Conta bloqueada')).toBeVisible();

  // She asks to unblock it, and lands on her request.
  await pickReason(operator, 'Pedido do cliente');
  await operator.getByLabel('Observação (opcional)').fill('Cliente confirmou a identidade (E2E)');
  await operator.getByRole('button', { name: 'Pedir desbloqueio' }).click();
  await expect(operator).toHaveURL(/\/requests\/[0-9a-f-]{36}$/);
  const requestUrl = operator.url();

  // The requester never sees a way to approve her own request (STF-03).
  await expect(operator.getByText('Pendente')).toBeVisible();
  await expect(operator.getByRole('button', { name: 'Aprovar' })).toHaveCount(0);
  await expect(operator.getByRole('button', { name: 'Recusar' })).toHaveCount(0);
  await expect(operator.getByRole('button', { name: 'Cancelar pedido' })).toBeVisible();

  // The operator's home shows it among her own, waiting.
  const requestLink = `a[href="${new URL(requestUrl).pathname}"]`;
  await operator.goto('/');
  const mine = operator.locator('[data-slot="card"]').filter({ hasText: 'Seus pedidos' });
  await expect(mine.locator(requestLink)).toContainText(/vence em/);

  // The analyst finds it in her queue on the home, and approves it.
  await analyst.goto('/');
  const queue = analyst.locator('[data-slot="card"]').filter({ hasText: 'Aguardando sua decisão' });
  await queue.locator(requestLink).click();
  await expect(analyst).toHaveURL(requestUrl);
  await analyst.getByRole('button', { name: 'Aprovar' }).click();
  await expect(analyst.getByText('Aprovado por')).toBeVisible();

  // The operator's home shows how it ended.
  await operator.goto('/');
  await expect(mine.locator(requestLink)).toContainText('Aprovado');

  // Carla's account is active again.
  await operator.goto(customerUrl);
  await expect(operator.getByText('Conta ativa')).toBeVisible();

  // The request's trail names who asked and who approved (task 8).
  await analyst.getByRole('link', { name: 'Ver a trilha do pedido' }).click();
  const opened = analyst.getByRole('row').filter({ hasText: 'Pedido aberto' });
  const approved = analyst.getByRole('row').filter({ hasText: 'Pedido aprovado' });
  await expect(opened).toContainText('Olívia');
  await expect(approved).toContainText('Diogo');
});
