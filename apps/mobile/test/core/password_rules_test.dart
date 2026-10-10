import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/password_rules.dart';

void main() {
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
