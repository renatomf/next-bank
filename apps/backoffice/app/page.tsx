import { signedInMember } from '../lib/backend';
import { logout } from './actions';

const ROLES: Readonly<Record<string, string>> = {
  OPERATOR: 'Operação',
  ANALYST: 'Análise',
  ADMIN: 'Administração',
};

/** The staff's home: who is signed in. The next tasks bring the customers and the requests. */
export default async function HomePage() {
  const member = await signedInMember();

  return (
    <main className="centered">
      <section className="card" aria-labelledby="title">
        <h1 id="title" className="brand">
          Olá, {member.name}
        </h1>
        <p className="muted">{ROLES[member.role] ?? member.role}</p>
        <form action={logout}>
          <button type="submit" className="secondary">
            Sair
          </button>
        </form>
      </section>
    </main>
  );
}
