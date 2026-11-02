import { Logo } from '@/components/nb/logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const expired = (await searchParams).sessao === 'expirada';

  return (
    <main className="grid min-h-dvh place-items-center bg-[radial-gradient(ellipse_at_top,var(--nb-glow),transparent_60%)] p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-3xl">
            <Logo /> <span className="font-normal text-muted-foreground">backoffice</span>
          </CardTitle>
          <CardDescription>Acesso da equipe, com o código do autenticador.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm notice={expired ? 'Sua sessão expirou. Entre de novo.' : null} />
        </CardContent>
      </Card>
    </main>
  );
}
