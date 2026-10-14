import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';

/// The PIN behind an Android Keystore key that needs strong biometrics on
/// every read and dies with a newly enrolled fingerprint (v1.1.0 plan, task
/// 2; MOB-11). It lives in a storage space of its own: when the key dies,
/// the library erases that space, and the session must not go with it.
final class SecureBiometricPinStore implements BiometricPinStore {
  /// Uses [storage] and [hasStrongBiometrics]; by default the Keystore and
  /// the phone's own answer.
  new({
    FlutterSecureStorage? storage,
    Future<bool> Function()? hasStrongBiometrics,
  }) : _storage = storage ?? const FlutterSecureStorage(),
       _hasStrongBiometrics = hasStrongBiometrics ?? _phoneHasStrongBiometrics;

  final FlutterSecureStorage _storage;
  final Future<bool> Function() _hasStrongBiometrics;

  static const String _key = 'transaction_pin';

  // Strong (class 3) biometrics, asked on every read, invalidated by a new
  // enrollment (setInvalidatedByBiometricEnrollment in the library).
  static const AndroidOptions _options = AndroidOptions.biometric(
    enforceBiometrics: true,
    requireBiometricsPerOperation: true,
    biometricType: AndroidBiometricType.strongBiometricOnly,
    storageNamespace: 'biometric_pin',
    biometricPromptTitle: 'Desbloquear o next bank',
    biometricPromptSubtitle: 'Use sua biometria',
    biometricPromptNegativeButton: 'Usar PIN',
  );

  static Future<bool> _phoneHasStrongBiometrics() async {
    final available = await LocalAuthentication().getAvailableBiometrics();
    return available.contains(BiometricType.strong);
  }

  @override
  Future<bool> isAvailable() => _hasStrongBiometrics();

  @override
  Future<bool> hasPin() => _storage.containsKey(key: _key, aOptions: _options);

  @override
  Future<void> save(String pin) =>
      _storage.write(key: _key, value: pin, aOptions: _options);

  @override
  Future<BiometricPinRead> read() async {
    try {
      final pin = await _storage.read(key: _key, aOptions: _options);
      return pin == null ? const BiometricPinLost() : BiometricPin(pin);
    } on PlatformException catch (error) {
      final message = error.message ?? '';
      if (message.contains('KeyPermanentlyInvalidated')) {
        await clear();
        return const BiometricPinLost();
      }
      // The prompt closed ("Usar PIN", back), a lockout or anything else: the
      // PIN stays, and the customer types it instead.
      return const BiometricCancelled();
    }
  }

  @override
  Future<void> clear() => _storage.delete(key: _key, aOptions: _options);
}
