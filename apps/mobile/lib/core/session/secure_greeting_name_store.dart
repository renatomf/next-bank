import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:next_bank/core/session/greeting_name_store.dart';
import 'package:next_bank/core/session/secure_token_store.dart';

/// The greeting's first name in the Keychain / Keystore, beside the session
/// (MOB-01, MOB-12).
final class SecureGreetingNameStore implements GreetingNameStore {
  /// Uses [storage]; by default the session's own secure storage, with its
  /// options (this device only, no backup).
  new({FlutterSecureStorage? storage})
    : _storage = storage ?? SecureTokenStore.storage;

  final FlutterSecureStorage _storage;

  static const String _key = 'greeting_name';

  @override
  Future<String?> read() => _storage.read(key: _key);

  @override
  Future<void> write(String firstName) =>
      _storage.write(key: _key, value: firstName);

  @override
  Future<void> clear() => _storage.delete(key: _key);
}
