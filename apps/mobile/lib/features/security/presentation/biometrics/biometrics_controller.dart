import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/features/security/presentation/security_providers.dart';

/// What "Usar biometria" shows in Security (v1.1.0 plan, task 2). Never
/// holds the PIN (MOB-02).
final class BiometricsState {
  /// Creates the state.
  const new({
    required this.available,
    required this.enabled,
    this.saving = false,
    this.error,
  });

  /// The phone has strong biometrics enrolled; otherwise nothing is offered.
  final bool available;

  /// A PIN is kept for biometrics.
  final bool enabled;

  /// True while the server checks the PIN.
  final bool saving;

  /// Why enabling failed.
  final String? error;
}

/// "Usar biometria" in Security.
final AsyncNotifierProvider<BiometricsController, BiometricsState>
biometricsControllerProvider = AsyncNotifierProvider.autoDispose(
  BiometricsController.new,
);

/// Turns biometrics on, with the PIN the server accepts, and off (MOB-11).
class BiometricsController extends AsyncNotifier<BiometricsState> {
  @override
  Future<BiometricsState> build() async {
    final store = ref.read(biometricPinStoreProvider);
    return BiometricsState(
      available: await store.isAvailable(),
      enabled: await store.hasPin(),
    );
  }

  /// Keeps [pin] behind biometrics once the server accepts it; returns
  /// whether biometrics is now on.
  Future<bool> enable(String pin) async {
    final current = await future;
    if (current.saving) return false;
    state = AsyncData(
      BiometricsState(
        available: current.available,
        enabled: false,
        saving: true,
      ),
    );
    try {
      await ref.read(securityRepositoryProvider).verifyPin(pin);
      await ref.read(biometricPinStoreProvider).save(pin);
      if (ref.mounted) {
        state = AsyncData(
          BiometricsState(available: current.available, enabled: true),
        );
      }
      return true;
    } on ApiFailure catch (failure) {
      if (ref.mounted) {
        state = AsyncData(
          BiometricsState(
            available: current.available,
            enabled: false,
            error: messageFor(failure),
          ),
        );
      }
      return false;
    }
  }

  /// Forgets the kept PIN.
  Future<void> disable() async {
    final current = await future;
    await ref.read(biometricPinStoreProvider).clear();
    if (ref.mounted) {
      state = AsyncData(
        BiometricsState(available: current.available, enabled: false),
      );
    }
  }
}
