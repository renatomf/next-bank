import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/auth/domain/email.dart';

// Checked in the app only to answer fast; the API stays the authority.
void main() {
  group('isValidEmail', () {
    for (final email in [
      'ana@example.test',
      'ana.souza+demo@mail.example.test',
    ]) {
      test('accepts $email', () => expect(isValidEmail(email), isTrue));
    }

    for (final email in [
      '',
      'ana',
      'ana@',
      '@example.test',
      'ana@example',
      'ana souza@example.test',
      'ana@exa mple.test',
      'ana@b@example.test',
    ]) {
      test('rejects "$email"', () => expect(isValidEmail(email), isFalse));
    }

    test('accepts up to 254 characters, as the API does', () {
      const domain = '@example.test';
      expect(isValidEmail('${'a' * (254 - domain.length)}$domain'), isTrue);
      expect(isValidEmail('${'a' * (255 - domain.length)}$domain'), isFalse);
    });
  });
}
