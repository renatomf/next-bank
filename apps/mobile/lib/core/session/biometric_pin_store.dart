import 'package:flutter_riverpod/flutter_riverpod.dart';

/// How asking biometrics for the kept PIN ended (v1.1.0 plan, task 2).
sealed class BiometricPinRead {
  const new();
}

/// Biometrics passed: the PIN, to send to the server like a typed one.
final class BiometricPin extends BiometricPinRead {
  /// Wraps the released [pin].
  const new(this.pin);

  /// The kept PIN. Never logged nor held in a state (MOB-02).
  final String pin;
}

/// The customer closed the prompt or chose "Usar PIN".
final class BiometricCancelled extends BiometricPinRead {
  /// The cancel.
  const new();
}

/// No PIN is kept any more: never enabled, or the key was voided, such as
/// by a newly enrolled fingerprint (MOB-11).
final class BiometricPinLost extends BiometricPinRead {
  /// The loss.
  const new();
}

/// The transaction PIN kept behind the phone's strong biometrics: a
/// convenience that releases the PIN, never a check of its own (ADR 0004).
abstract interface class BiometricPinStore {
  /// Whether the phone has strong biometrics enrolled.
  Future<bool> isAvailable();

  /// Whether a PIN is kept, without asking for biometrics.
  Future<bool> hasPin();

  /// Keeps [pin] behind biometrics.
  Future<void> save(String pin);

  /// Asks for biometrics and releases the kept PIN.
  Future<BiometricPinRead> read();

  /// Forgets the kept PIN.
  Future<void> clear();
}

/// Where the PIN is kept for biometrics; bound in main.dart.
final Provider<BiometricPinStore> biometricPinStoreProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);

/// Whether the Unlock screen offers biometrics: the phone has them and a PIN
/// is kept. Read again on every visit, since enabling happens elsewhere.
final FutureProvider<bool> biometricUnlockProvider = FutureProvider.autoDispose(
  (ref) async {
    final store = ref.watch(biometricPinStoreProvider);
    return await store.isAvailable() && await store.hasPin();
  },
);
