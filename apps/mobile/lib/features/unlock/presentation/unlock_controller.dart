import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/app_lock.dart';
import 'package:next_bank/core/session/biometric_check.dart';
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
  // A prompt is open: a second tap must not open another.
  bool _prompting = false;

  @override
  UnlockState build() => const UnlockState();

  /// Opens the app when the phone's prompt, face or fingerprint, recognizes
  /// the customer: a local convenience the server never sees (ADR 0004,
  /// ADR 0013). Only while a PIN is kept, that is, once biometrics were
  /// turned on with the PIN (MOB-11). A failed prompt leaves the PIN to type.
  Future<void> useBiometrics() async {
    if (_prompting || state.verifying || state.blocked) return;
    _prompting = true;
    try {
      if (!await ref.read(biometricPinStoreProvider).hasPin()) return;
      final recognized = await ref.read(biometricCheckProvider).confirm();
      if (recognized && ref.mounted) {
        ref.read(appLockProvider.notifier).unlock();
      }
    } finally {
      _prompting = false;
    }
  }

  /// Sends the PIN once; ignored while a check runs, so a double submit
  /// costs one attempt.
  Future<void> submit(String pin) async {
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
      // A locked PIN must be reset with the password: it is no longer kept.
      if (blocked) {
        await ref.read(biometricPinStoreProvider).clear();
        if (!ref.mounted) return;
      }
      state = UnlockState(blocked: blocked, error: messageFor(failure));
    }
  }
}
