import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:next_bank/core/session/secure_token_store.dart';
import 'package:next_bank/core/theme/theme_choice.dart';
import 'package:next_bank/core/theme/theme_store.dart';

/// The theme choice in the secure storage: not sensitive, but the app keeps
/// nothing in plain preferences (MOB-01).
final class SecureThemeStore implements ThemeStore {
  /// The record that holds the choice.
  static const String key = 'theme';

  /// The same storage, with the same options, as the session.
  static const FlutterSecureStorage storage = SecureTokenStore.storage;

  @override
  Future<ThemeChoice> read() async {
    final stored = await storage.read(key: key);
    // An unknown value, e.g. from another version, follows the system.
    return ThemeChoice.values.asNameMap()[stored] ?? ThemeChoice.system;
  }

  @override
  Future<void> write(ThemeChoice choice) => choice == ThemeChoice.system
      ? storage.delete(key: key)
      : storage.write(key: key, value: choice.name);
}
