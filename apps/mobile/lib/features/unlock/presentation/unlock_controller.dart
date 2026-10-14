import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/app_lock.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/features/unlock/presentation/unlock_providers.dart';

/// What the Unlock screen shows. Never holds the PIN: the screen keeps the
/// typed digits only until they are sent (MOB-02).
final class UnlockState {
  /// Creates the state; the default asks for the PIN.
  const new({this.verifying = false, this.blocked = false, this.error});

  /// True while the server checks the PIN.
  final bool verifying;

  /// The PIN cannot be typed again: only leaving is left (week 6 plan, D6).
  final bool blocked;

  /// Why the PIN was not accepted.
  final String? error;
}

/// The Unlock screen's state, discarded when the screen closes.
final NotifierProvider<UnlockController, UnlockState> unlockControllerProvider =
    NotifierProvider.autoDispose<UnlockController, UnlockState>(
      UnlockController.new,
    );

/// Unlocks the app with the PIN checked on the server (F-16, PIX-06).
class UnlockController extends Notifier<UnlockState> {
  @override
  UnlockState build() => const UnlockState();

  /// Sends the PIN once; ignored while a check runs, so a double submit
  /// costs one attempt.
  Future<void> submit(String pin) => _check(pin, fromBiometrics: false);

  /// Asks biometrics for the kept PIN and checks it on the server like a
  /// typed one (ADR 0004). A cancel leaves the PIN to type; a PIN no longer
  /// kept, such as after a new fingerprint, says so (MOB-11).
  Future<void> useBiometrics() async {
    if (state.verifying || state.blocked) return;
    final store = ref.read(biometricPinStoreProvider);
    switch (await store.read()) {
      case BiometricPin(:final pin):
        if (!ref.mounted) return;
        await _check(pin, fromBiometrics: true);
      case BiometricCancelled():
        return;
      case BiometricPinLost():
        await store.clear();
        if (!ref.mounted) return;
        state = const UnlockState(
          error: 'A biometria foi desativada neste aparelho. Digite seu PIN.',
        );
    }
  }

  Future<void> _check(String pin, {required bool fromBiometrics}) async {
    if (state.verifying || state.blocked) return;
    state = const UnlockState(verifying: true);
    try {
      await ref.read(unlockRepositoryProvider).verifyPin(pin);
      if (!ref.mounted) return;
      ref.read(appLockProvider.notifier).unlock();
      state = const UnlockState();
    } on ApiFailure catch (failure) {
      if (!ref.mounted) return;
      // Catalog: the account has no PIN; the profile read again sends the
      // router to the PIN creation.
      if (failure case ApiRejected(code: ApiErrorCode.pinNotCreated)) {
        ref.invalidate(profileProvider);
      }
      final blocked = switch (failure) {
        ApiRejected(code: ApiErrorCode.pinLocked) ||
        ApiRejected(code: ApiErrorCode.pinResetRequired) => true,
        _ => false,
      };
      // A kept PIN the server refuses is out of date, and a locked PIN must
      // be reset with the password: either way, it is no longer kept.
      final refused =
          fromBiometrics &&
          failure is ApiRejected &&
          failure.code == ApiErrorCode.pinIncorrect;
      if (blocked || refused) {
        await ref.read(biometricPinStoreProvider).clear();
        if (!ref.mounted) return;
      }
      state = UnlockState(blocked: blocked, error: messageFor(failure));
    }
  }
}
