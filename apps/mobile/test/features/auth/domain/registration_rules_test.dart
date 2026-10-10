import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/auth/domain/registration_rules.dart';

// Local checks that mirror the API (register schema and Password), so the
// visitor learns at once; the API stays the authority.
void main() {
  group('isValidName', () {
    for (final name in ['Ana Souza', 'Li', 'A' * 120, '  Ana Souza  ']) {
      test('accepts "${name.length > 20 ? '${name.length} chars' : name}"', () {
        expect(isValidName(name), isTrue);
      });
    }

    for (final (label, name) in [
      ('empty', ''),
      ('one letter after trimming', '  A  '),
      ('more than 120 characters', 'A' * 121),
      ('a control character', 'Ana\u0007Souza'),
    ]) {
      test('rejects $label', () => expect(isValidName(name), isFalse));
    }
  });
}
