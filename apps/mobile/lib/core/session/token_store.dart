import 'package:next_bank/core/session/session_tokens.dart';

/// Where the session survives app restarts. The only implementation keeps it
/// in the Keychain / Keystore (MOB-01); tests use an in-memory fake.
abstract interface class TokenStore {
  /// The stored session, or null when there is none (or it is unreadable).
  Future<SessionTokens?> read();

  /// Replaces the stored session in a single write.
  Future<void> write(SessionTokens tokens);

  /// Removes the stored session.
  Future<void> clear();
}
