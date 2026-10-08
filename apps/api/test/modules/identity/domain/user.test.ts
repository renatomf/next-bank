import { describe, expect, it } from 'vitest';
import { Cpf } from '../../../../src/shared/domain/cpf.ts';
import { User } from '../../../../src/modules/identity/domain/user.ts';

const NOW = new Date('2026-10-06T12:00:00.000Z');

function register(overrides: { name?: string; email?: string } = {}): User {
  return User.register({
    id: 'user-1',
    name: overrides.name ?? 'Maria Teste',
    email: overrides.email ?? 'maria@example.test',
    cpf: Cpf.parse('123.456.789-09'),
    passwordHash: '$argon2id$fake',
    now: NOW,
  });
}

// User aggregate (domain-model.md 3.1).
describe('User', () => {
  it('starts active', () => {
    expect(register().state).toMatchObject({
      id: 'user-1',
      name: 'Maria Teste',
      email: 'maria@example.test',
      passwordHash: '$argon2id$fake',
      status: 'ACTIVE',
      createdAt: NOW,
    });
  });

  it('keeps the e-mail normalized: trimmed and lowercase', () => {
    expect(register({ email: '  Maria@Example.TEST ' }).state.email).toBe('maria@example.test');
  });

  it('trims the name', () => {
    expect(register({ name: '  Maria Teste ' }).state.name).toBe('Maria Teste');
  });

  it('keeps the CPF as a value object, so it is only ever printed masked', () => {
    expect(JSON.stringify(register().state)).not.toContain('12345678909');
  });
});
