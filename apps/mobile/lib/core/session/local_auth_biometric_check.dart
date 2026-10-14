import 'package:local_auth/local_auth.dart';
import 'package:local_auth_android/local_auth_android.dart';
import 'package:next_bank/core/session/biometric_check.dart';

/// [BiometricCheck] over local_auth: biometrics only, so the prompt takes
/// the face or a fingerprint but never the phone's PIN or pattern, which
/// would open the app to whoever knows the phone's unlock (ADR 0013).
final class LocalAuthBiometricCheck implements BiometricCheck {
  /// Uses [auth]; by default the phone's.
  new({LocalAuthentication? auth}) : _auth = auth ?? LocalAuthentication();

  final LocalAuthentication _auth;

  @override
  Future<bool> confirm() async {
    try {
      return await _auth.authenticate(
        localizedReason: 'Use sua biometria',
        authMessages: const [
          AndroidAuthMessages(
            signInTitle: 'Desbloquear o next bank',
            cancelButton: 'Usar PIN',
          ),
        ],
        biometricOnly: true,
        // No extra tap after the face: it only opens the app.
        sensitiveTransaction: false,
      );
    } on LocalAuthException {
      // Cancelled, locked out or unavailable: the customer types the PIN.
      return false;
    }
  }
}
