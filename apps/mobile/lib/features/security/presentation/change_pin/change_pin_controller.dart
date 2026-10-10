import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/core/pin_rules.dart';
import 'package:next_bank/features/security/presentation/security_providers.dart';

/// What the PIN change screen shows. Never holds the PIN nor the password
/// (MOB-02): the screen keeps them only until they are sent.
final class ChangePinState {
  /// Creates the state; the default is an empty form.
  const new({
    this.submitting = false,
    this.done = false,
    this.passwordError,
    this.pinError,
    this.confirmError,
    this.error,
  });

  /// True while the server checks the password and stores the PIN.
  final bool submitting;

  /// True once the new PIN is in place.
  final bool done;

  /// Beside the password.
  final String? passwordError;

  /// Beside the new PIN.
  final String? pinError;

  /// Beside the PIN typed again.
  final String? confirmError;

  /// For the whole screen.
  final String? error;
}

/// The screen's state, discarded when the screen closes.
final NotifierProvider<ChangePinController, ChangePinState>
changePinControllerProvider =
    NotifierProvider.autoDispose<ChangePinController, ChangePinState>(
      ChangePinController.new,
    );

/// A new transaction PIN with the password (domain-model.md 3.1), also how
/// a locked PIN works again (week 7 plan, D5).
class ChangePinController extends Notifier<ChangePinState> {
  @override
  ChangePinState build() => const ChangePinState();

  /// Checks the form on the device, then sends it once; ignored while a
  /// change runs.
  Future<void> submit({
    required String password,
    required String newPin,
    required String confirmPin,
  }) async {
    if (state.submitting) return;
    final local = _checked(password, newPin, confirmPin);
    if (local != null) {
      state = local;
      return;
    }
    state = const ChangePinState(submitting: true);
    try {
      await ref
          .read(securityRepositoryProvider)
          .changePin(password: password, newPin: newPin);
      if (ref.mounted) state = const ChangePinState(done: true);
    } on ApiFailure catch (failure) {
      if (!ref.mounted) return;
      state = switch (failure) {
        ApiRejected(code: ApiErrorCode.passwordIncorrect) => ChangePinState(
          passwordError: messageFor(failure),
        ),
        ApiRejected(code: ApiErrorCode.invalidPin) => ChangePinState(
          pinError: messageFor(failure),
        ),
        _ => ChangePinState(error: messageFor(failure)),
      };
    }
  }

  static ChangePinState? _checked(
    String password,
    String newPin,
    String confirmPin,
  ) {
    if (password.isEmpty) {
      return const ChangePinState(passwordError: 'Informe sua senha.');
    }
    if (!isAcceptablePin(newPin)) {
      return const ChangePinState(
        pinError: 'Use 4 dígitos que não sejam repetidos nem em sequência.',
      );
    }
    if (confirmPin != newPin) {
      return const ChangePinState(
        confirmError: 'Os PINs não conferem. Digite de novo.',
      );
    }
    return null;
  }
}
