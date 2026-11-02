import { describe, expect, it } from 'vitest';
import {
  customerQueryOf,
  InvalidCustomerQuery,
} from '../../../../src/modules/operations/domain/customer-query.ts';
import { InvalidCpf } from '../../../../src/shared/domain/cpf.ts';
import { fictitiousCpf } from '../../identity/fixtures.ts';

// One search field for the staff (v1.3.0 plan, task 3, C2): the term says
// what it is. A CPF, an e-mail and an account number are matched exactly;
// anything else is the start of a name.
// Drawn at test time: never a CPF written in the code.
const VALID_CPF = fictitiousCpf();
const PUNCTUATED = `${VALID_CPF.slice(0, 3)}.${VALID_CPF.slice(3, 6)}.${VALID_CPF.slice(6, 9)}-${VALID_CPF.slice(9)}`;

describe('customerQueryOf', () => {
  it.each([VALID_CPF, PUNCTUATED, ` ${VALID_CPF} `])('reads %j as a CPF', (term) => {
    const query = customerQueryOf(term);

    expect(query.by).toBe('CPF');
    expect(query.by === 'CPF' && query.cpf.digits).toBe(VALID_CPF);
  });

  it('refuses a CPF with wrong check digits, rather than searching names for it', () => {
    const wrongCheckDigits = `${VALID_CPF.slice(0, 9)}${VALID_CPF.slice(9) === '00' ? '11' : '00'}`;

    expect(() => customerQueryOf(wrongCheckDigits)).toThrow(InvalidCpf);
  });

  it('reads an e-mail, as the registration stores it', () => {
    expect(customerQueryOf(' Ana.Souza@Example.TEST ')).toEqual({
      by: 'EMAIL',
      email: 'ana.souza@example.test',
    });
  });

  it('reads an account number', () => {
    expect(customerQueryOf('100000-4')).toEqual({ by: 'ACCOUNT', number: '100000-4' });
  });

  it('reads anything else as the start of a name', () => {
    expect(customerQueryOf('  Ana Sou ')).toEqual({ by: 'NAME', prefix: 'Ana Sou' });
  });

  it.each(['', 'an', '  a  '])('refuses %j: too short to narrow anything', (term) => {
    expect(() => customerQueryOf(term)).toThrow(InvalidCustomerQuery);
  });
});
