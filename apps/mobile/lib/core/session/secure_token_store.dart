import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:next_bank/core/session/session_tokens.dart';
import 'package:next_bank/core/session/token_store.dart';

/// Session tokens in the Keychain (iOS) and Keystore-backed AES-GCM storage
/// (Android), never in plain preferences or files (MOB-01).
final class SecureTokenStore implements TokenStore {
  /// The single record that holds the whole session.
  static const String key = 'session';

  /// iOS: readable after the first unlock, kept on this device only: no
  /// iCloud Keychain sync and no restore onto another phone. Android: the
  /// library's default AES-GCM with an RSA key in the Keystore.
  static const FlutterSecureStorage storage = FlutterSecureStorage(
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );

  @override
  Future<SessionTokens?> read() async {
    final stored = await storage.read(key: key);
    if (stored == null) return null;
    final tokens = SessionTokens.tryParse(stored);
    // A record that cannot be read is no session: remove it for good.
    if (tokens == null) await clear();
    return tokens;
  }

  @override
  Future<void> write(SessionTokens tokens) =>
      storage.write(key: key, value: tokens.toStorage());

  @override
  Future<void> clear() => storage.delete(key: key);
}
