import 'package:next_bank/features/security/domain/active_session.dart';

/// The customer's sessions and credentials. Failures are reported as
/// `ApiFailure` with the catalog code.
abstract interface class SecurityRepository {
  /// The active sessions, most recently used first.
  Future<List<ActiveSession>> sessions();

  /// Ends the session [id], one that is not this device's.
  Future<void> revoke(String id);

  /// A new transaction PIN, with the password; it also lifts a locked PIN.
  Future<void> changePin({required String password, required String newPin});

  /// A new password with the current one; every other session ends.
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  });
}
