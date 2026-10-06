import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/session/session_tokens.dart';

final SessionTokens tokens = SessionTokens(
  accessToken: 'access-token-value',
  accessTokenExpiresAt: DateTime.utc(2026, 10, 6, 12, 15),
  refreshToken: 'refresh-token-value',
);

void main() {
  group('SessionTokens', () {
    test('survives a round trip through its stored form', () {
      final restored = SessionTokens.tryParse(tokens.toStorage());

      expect(restored?.accessToken, 'access-token-value');
      expect(restored?.refreshToken, 'refresh-token-value');
      expect(restored?.accessTokenExpiresAt, DateTime.utc(2026, 10, 6, 12, 15));
    });

    test('keeps the three values in one stored record, never apart', () {
      final stored = tokens.toStorage();

      expect(stored, contains('access-token-value'));
      expect(stored, contains('refresh-token-value'));
    });

    for (final (description, stored) in [
      ('not JSON', 'not-json'),
      ('a JSON list', '[]'),
      (
        'a missing refresh token',
        '{"accessToken":"a","accessTokenExpiresAt":"2026-10-06T12:15:00Z"}',
      ),
      (
        'an invalid date',
        '{"accessToken":"a","accessTokenExpiresAt":"later","refreshToken":"r"}',
      ),
      (
        'a non-text token',
        '{"accessToken":1,"accessTokenExpiresAt":"2026-10-06T12:15:00Z","refreshToken":"r"}',
      ),
    ]) {
      test('reads $description as no session', () {
        expect(SessionTokens.tryParse(stored), isNull);
      });
    }

    test('never prints the tokens (MOB-02)', () {
      expect(tokens.toString(), isNot(contains('access-token-value')));
      expect(tokens.toString(), isNot(contains('refresh-token-value')));
    });
  });
}
