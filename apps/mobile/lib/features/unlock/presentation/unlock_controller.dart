import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/core/session/app_lock.dart';
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
      state = UnlockState(
        blocked: switch (failure) {
          ApiRejected(code: ApiErrorCode.pinLocked) ||
          ApiRejected(code: ApiErrorCode.pinResetRequired) => true,
          _ => false,
        },
        error: messageFor(failure),
      );
    }
  }
}
