const BRASILIA = 'America/Sao_Paulo';

export interface Greeting {
  salutation: 'Bom dia' | 'Boa tarde' | 'Boa noite';
  date: string;
}

/**
 * The home's greeting and today's date in Brasília: the server runs in UTC,
 * where the evening in Brasília is already the next day.
 */
export function greetingOf(now: Date): Greeting {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: BRASILIA,
    }).format(now),
  );
  const salutation =
    hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
  const date = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: BRASILIA,
  }).format(now);
  return { salutation, date };
}
