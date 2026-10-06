import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/auth/domain/cpf.dart';

// The same textbook examples as the API tests; never real people's data.
// The rule mirrors the API's Cpf (check digits, no repeated digits).
void main() {
  group('isValidCpf', () {
    for (final cpf in ['12345678909', '11144477735', '123.456.789-09']) {
      test('accepts $cpf', () => expect(isValidCpf(cpf), isTrue));
    }

    for (final (name, cpf) in [
      ('a wrong first check digit', '12345678919'),
      ('a wrong second check digit', '12345678900'),
      ('too short', '1234567890'),
      ('too long', '123456789091'),
      ('letters', '1234567890a'),
      ('unexpected separators', '123/456/789-09'),
      ('repeated digits', '11111111111'),
      ('zeros', '00000000000'),
      ('empty', ''),
    ]) {
      test('rejects $name', () => expect(isValidCpf(cpf), isFalse));
    }
  });

  // DEMO-01: the app fills the CPF, so visitors never type a real one.
  group('fictitiousCpf', () {
    test('always draws a valid CPF, as 11 digits', () {
      for (var seed = 0; seed < 500; seed++) {
        final cpf = fictitiousCpf(Random(seed));

        expect(cpf, matches(RegExp(r'^\d{11}$')), reason: 'seed $seed');
        expect(isValidCpf(cpf), isTrue, reason: 'seed $seed: $cpf');
      }
    });

    test('draws a different CPF each time', () {
      final random = Random(7);

      expect(fictitiousCpf(random), isNot(fictitiousCpf(random)));
    });
  });

  test('formatCpf shows the usual punctuation', () {
    expect(formatCpf('12345678909'), '123.456.789-09');
  });
}
