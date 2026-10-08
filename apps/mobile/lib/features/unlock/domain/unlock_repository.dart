/// Checks the transaction PIN on the server (ADR 0004): the app never decides
/// whether a PIN is right.
abstract interface class UnlockRepository {
  /// Completes when the PIN is right; fails with an `ApiFailure` otherwise.
  Future<void> verifyPin(String pin);
}
