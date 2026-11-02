/** Money as the API sends it: integer cents and the currency (ADR 0006). */
export interface MoneyBody {
  amount: number;
  currency: 'BRL';
}

/**
 * R$ 1.234,56 from integer cents, by text alone: money never goes through a
 * float, not even to be shown.
 */
export function formatMoney(money: MoneyBody): string {
  const cents = String(Math.abs(money.amount)).padStart(3, '0');
  const reais = cents.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = money.amount < 0 ? '-' : '';
  return `${sign}R$ ${reais},${cents.slice(-2)}`;
}

/** A moment in Brasília time, as the staff reads it: 02/11/2026 15:04. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));
}
