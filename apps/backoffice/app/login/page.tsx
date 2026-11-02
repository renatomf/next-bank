import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const expired = (await searchParams).sessao === 'expirada';

  return (
    <main className="centered">
      <section className="card" aria-labelledby="title">
        <h1 id="title" className="brand">
          next<span>.</span> backoffice
        </h1>
        <p className="muted">Acesso da equipe, com o código do autenticador.</p>
        <LoginForm notice={expired ? 'Sua sessão expirou. Entre de novo.' : null} />
      </section>
    </main>
  );
}
