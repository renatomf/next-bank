import 'package:next_bank/core/session/session_tokens.dart';

/// Registration, login, PIN creation and logout against the API.
/// Failures are reported as `ApiFailure` with the catalog code.
abstract interface class AuthRepository {
  /// Creates the customer and starts a session.
  Future<SessionTokens> register({
    required String name,
    required String email,
    required String cpf,
    required String password,
    required String? deviceLabel,
  });

  /// Starts a session.
  Future<SessionTokens> login({
    required String email,
    required String password,
    required String? deviceLabel,
  });

  /// Creates the transaction PIN, once (changing it needs the password).
  Future<void> createPin(String pin);

  /// Ends the current session on the server.
  Future<void> logout();
}
