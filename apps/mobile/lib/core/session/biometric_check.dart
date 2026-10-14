import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The phone's biometric prompt, weak or strong: on the S21, the face or a
/// fingerprint (v1.1.0 plan, task 2.1; ADR 0013). It only opens the app: a
/// weak check cannot release the PIN kept behind the strong key, so it
/// never authorizes a Pix (MOB-13).
abstract interface class BiometricCheck {
  /// Shows the prompt; true when it recognized the customer. Cancelling,
  /// "Usar PIN", a lockout or any failure is false, leaving the PIN.
  Future<bool> confirm();
}

/// The phone's prompt; bound in main.dart.
final Provider<BiometricCheck> biometricCheckProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);
