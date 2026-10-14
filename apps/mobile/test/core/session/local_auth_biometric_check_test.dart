import 'package:flutter_test/flutter_test.dart';
import 'package:local_auth/local_auth.dart';
import 'package:local_auth_android/local_auth_android.dart';
import 'package:next_bank/core/session/local_auth_biometric_check.dart';

/// The phone's prompt, recording how it was asked.
class _FakeLocalAuthentication extends LocalAuthentication {
  new(this._answer);

  final Future<bool> Function() _answer;

  bool? biometricOnly;
  bool? sensitiveTransaction;

  @override
  Future<bool> authenticate({
    required String localizedReason,
    Iterable<AuthMessages> authMessages = const <AuthMessages>[],
    bool biometricOnly = false,
    bool sensitiveTransaction = true,
    bool persistAcrossBackgrounding = false,
  }) {
    this.biometricOnly = biometricOnly;
    this.sensitiveTransaction = sensitiveTransaction;
    return _answer();
  }
}

// v1.1.0 plan, task 2.1 (ADR 0013, MOB-13): the face or a fingerprint opens
// the app; never the phone's PIN or pattern, which the prompt would also
// offer without biometricOnly.
void main() {
  test('asks for biometrics only, face included', () async {
    final auth = _FakeLocalAuthentication(() async => true);

    expect(await LocalAuthBiometricCheck(auth: auth).confirm(), isTrue);
    expect(auth.biometricOnly, isTrue);
    // The face unlocks without an extra tap to confirm.
    expect(auth.sensitiveTransaction, isFalse);
  });

  test('a prompt that does not recognize the customer fails', () async {
    final auth = _FakeLocalAuthentication(() async => false);

    expect(await LocalAuthBiometricCheck(auth: auth).confirm(), isFalse);
  });

  for (final code in [
    LocalAuthExceptionCode.userCanceled,
    LocalAuthExceptionCode.temporaryLockout,
    LocalAuthExceptionCode.biometricLockout,
    LocalAuthExceptionCode.noBiometricsEnrolled,
  ]) {
    test('fails on ${code.name}, leaving the PIN', () async {
      final auth = _FakeLocalAuthentication(
        () async => throw LocalAuthException(code: code),
      );

      expect(await LocalAuthBiometricCheck(auth: auth).confirm(), isFalse);
    });
  }
}
