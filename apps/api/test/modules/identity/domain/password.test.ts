import { describe, expect, it } from 'vitest';
import { WeakPassword } from '../../../../src/modules/identity/domain/errors.ts';
import {
  type CommonPasswordList,
  Password,
} from '../../../../src/modules/identity/domain/password.ts';

// Password policy (ADR 0004, AUTH-07, AUTH-08): 10 to 128 characters,
// no common passwords, no composition rules.
const common: CommonPasswordList = {
  contains: (candidate) => ['password123', 'qwertyuiop'].includes(candidate),
};

describe('Password', () => {
  it('accepts 10 characters without composition rules', () => {
    expect(Password.create('abcdefghij', common).value).toBe('abcdefghij');
  });

  it('rejects fewer than 10 characters (WeakPassword)', () => {
    expect(() => Password.create('abcdefghi', common)).toThrow(WeakPassword);
  });

  it('accepts 128 characters and rejects 129, which bounds the hashing cost (AUTH-08)', () => {
    expect(() => Password.create('a'.repeat(128), common)).not.toThrow();
    expect(() => Password.create('a'.repeat(129), common)).toThrow(WeakPassword);
  });

  it('counts characters, not UTF-16 units', () => {
    // 10 emoji are 20 UTF-16 units but 10 characters.
    expect(() => Password.create('🔒'.repeat(10), common)).not.toThrow();
    expect(() => Password.create('🔒'.repeat(9), common)).toThrow(WeakPassword);
    expect(() => Password.create('🔒'.repeat(65), common)).toThrow(WeakPassword);
  });

  it('rejects a common password regardless of case (AUTH-07)', () => {
    expect(() => Password.create('password123', common)).toThrow(WeakPassword);
    expect(() => Password.create('QwertyUIOP', common)).toThrow(WeakPassword);
  });

  it('keeps spaces, which are valid password characters', () => {
    expect(Password.create(' long pass ', common).value).toBe(' long pass ');
  });

  it('never prints the secret by accident', () => {
    const password = Password.create('correct horse battery', common);

    expect(String(password)).toBe('[REDACTED]');
    expect(JSON.stringify({ password })).toBe('{"password":"[REDACTED]"}');
  });

  it('carries the catalog code', () => {
    expect(() => Password.create('short', common)).toThrow(
      expect.objectContaining({ code: 'WeakPassword' }),
    );
  });
});
