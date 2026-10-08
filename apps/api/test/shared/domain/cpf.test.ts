import { describe, expect, it } from 'vitest';
import { Cpf, InvalidCpf } from '../../../src/shared/domain/cpf.ts';

// Fictitious CPFs used in textbook examples; never real people's data.
const VALID = '123.456.789-09';
const VALID_DIGITS = '11144477735';

describe('Cpf', () => {
  it('accepts a CPF with or without punctuation and keeps only the digits', () => {
    expect(Cpf.parse(VALID).digits).toBe('12345678909');
    expect(Cpf.parse(VALID_DIGITS).digits).toBe(VALID_DIGITS);
  });

  it('ignores surrounding spaces', () => {
    expect(Cpf.parse(`  ${VALID} `).digits).toBe('12345678909');
  });

  it.each([
    ['wrong first check digit', '123.456.789-19'],
    ['wrong second check digit', '123.456.789-00'],
    ['too short', '123.456.789-0'],
    ['too long', '123.456.789-091'],
    ['letters', '123.456.78a-09'],
    ['unexpected separators', '123/456/789-09'],
    ['empty', ''],
  ])('rejects %s (InvalidCpf)', (_case, raw) => {
    expect(() => Cpf.parse(raw)).toThrow(InvalidCpf);
  });

  it('rejects repeated digits even though their check digits add up', () => {
    expect(() => Cpf.parse('111.111.111-11')).toThrow(InvalidCpf);
    expect(() => Cpf.parse('00000000000')).toThrow(InvalidCpf);
  });

  it('shows only the middle digits when masked', () => {
    expect(Cpf.parse(VALID).masked).toBe('***.456.789-**');
  });

  it('never prints the full CPF by accident', () => {
    const cpf = Cpf.parse(VALID);

    expect(String(cpf)).toBe('***.456.789-**');
    expect(JSON.stringify({ cpf })).toBe('{"cpf":"***.456.789-**"}');
  });

  it('carries the catalog code', () => {
    expect(() => Cpf.parse('x')).toThrow(expect.objectContaining({ code: 'InvalidCpf' }));
  });
});
