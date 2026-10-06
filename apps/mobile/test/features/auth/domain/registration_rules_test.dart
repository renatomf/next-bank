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

  group('hasAcceptablePasswordLength (AUTH-07, AUTH-08)', () {
    test('accepts 10 to 128 characters', () {
      expect(hasAcceptablePasswordLength('a' * 10), isTrue);
      expect(hasAcceptablePasswordLength('a' * 128), isTrue);
    });

    test('rejects 9 and 129 characters', () {
      expect(hasAcceptablePasswordLength('a' * 9), isFalse);
      expect(hasAcceptablePasswordLength('a' * 129), isFalse);
    });

    // The API counts Unicode code points; an emoji is two UTF-16 units.
    test('counts characters as the API does, not UTF-16 units', () {
      expect(hasAcceptablePasswordLength('🔒' * 10), isTrue);
      expect(hasAcceptablePasswordLength('🔒' * 9), isFalse);
    });
  });
}
