import 'package:next_bank/core/session/biometric_pin_store.dart';

/// The PIN kept behind biometrics, without the Keystore or a fingerprint.
class FakeBiometricPinStore implements BiometricPinStore {
  /// Creates the store; [pin] is already kept, as after enabling.
  new({this.pin, this.available = true});

  /// Whether the phone has strong biometrics enrolled.
  bool available;

  /// The PIN kept, if any.
  String? pin;

  /// How the next read ends instead of releasing [pin]: cancelled by the
  /// customer, or the key gone after a new fingerprint.
  BiometricPinRead? nextRead;

  /// How many times biometrics were asked for.
  int reads = 0;

  @override
  Future<bool> isAvailable() async => available;

  @override
  Future<bool> hasPin() async => pin != null;

  @override
  Future<void> save(String pin) async => this.pin = pin;

  @override
  Future<BiometricPinRead> read() async {
    reads++;
    final next = nextRead;
    if (next is BiometricPinLost) pin = null;
    if (next != null) return next;
    final kept = pin;
    return kept == null ? const BiometricPinLost() : BiometricPin(kept);
  }

  @override
  Future<void> clear() async => pin = null;
}
