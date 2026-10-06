import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/session/secure_token_store.dart';
import 'package:next_bank/core/session/session_tokens.dart';

// Tokens live only in the Keychain / Keystore (MOB-01).
final SessionTokens tokens = SessionTokens(
  accessToken: 'access-token-value',
  accessTokenExpiresAt: DateTime.utc(2026, 10, 6, 12, 15),
  refreshToken: 'refresh-token-value',
);

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  group('SecureTokenStore', () {
    test('reads back what it wrote', () async {
      final store = SecureTokenStore();

      await store.write(tokens);
      final read = await store.read();

      expect(read?.refreshToken, 'refresh-token-value');
      expect(read?.accessTokenExpiresAt, DateTime.utc(2026, 10, 6, 12, 15));
    });

    test('has no session before anything is written', () async {
      expect(await SecureTokenStore().read(), isNull);
    });

    test('forgets the session when cleared', () async {
      final store = SecureTokenStore();
      await store.write(tokens);

      await store.clear();

      expect(await store.read(), isNull);
    });

    test('treats a corrupted record as no session and removes it', () async {
      FlutterSecureStorage.setMockInitialValues({
        SecureTokenStore.key: 'corrupted',
      });
      final store = SecureTokenStore();

      expect(await store.read(), isNull);
      // Same mocked storage, not reset: the corrupted record is really gone.
      expect(
        await SecureTokenStore.storage.read(key: SecureTokenStore.key),
        isNull,
      );
    });

    test(
      'keeps iOS tokens on this device: no iCloud sync or restore elsewhere',
      () {
        expect(
          SecureTokenStore.storage.iOptions.accessibility,
          KeychainAccessibility.first_unlock_this_device,
        );
        expect(SecureTokenStore.storage.iOptions.synchronizable, isFalse);
      },
    );
  });
}
