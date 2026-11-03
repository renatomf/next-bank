import { KeyRound } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { CreatedStaffMember } from '@/lib/api';

/**
 * The new member's sign-in, shown once (v1.3.0 plan, task 7, G5): neither
 * the API nor the backoffice keeps it, so it is copied now or drawn again
 * with a new member. The authenticator takes the key typed in, as TOTP.
 */
export function NewMemberCredentials({
  email,
  credentials,
}: {
  email: string;
  credentials: CreatedStaffMember['credentials'];
}) {
  const facts: [string, string][] = [
    ['E-mail', email],
    ['Senha', credentials.password],
    ['Chave do autenticador', credentials.totpSecret],
    ['Link do autenticador', credentials.totpUri],
  ];
  return (
    <Alert>
      <KeyRound aria-hidden="true" />
      <AlertTitle>Membro criado: copie o acesso agora</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          Estes dados só aparecem agora. Entregue-os à pessoa por um canal seguro; ela cadastra a
          chave no autenticador, como TOTP.
        </p>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          {facts.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-muted-foreground">{term}</dt>
              <dd className="font-mono break-all">{value}</dd>
            </div>
          ))}
        </dl>
      </AlertDescription>
    </Alert>
  );
}
