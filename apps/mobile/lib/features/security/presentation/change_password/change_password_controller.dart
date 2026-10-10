import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/core/password_rules.dart';
import 'package:next_bank/features/security/presentation/security_providers.dart';

/// What the password change screen shows. Never holds a password (MOB-02):
/// the screen keeps them only until they are sent.
final class ChangePasswordState {
  /// Creates the state; the default is an empty form.
  const new({
    this.submitting = false,
    this.done = false,
    this.currentPasswordError,
    this.newPasswordError,
    this.confirmError,
    this.error,
  });

  /// True while the server checks and stores the password.
  final bool submitting;

  /// True once the new password is in place and the other sessions ended.
  final bool done;

  /// Beside the current password.
  final String? currentPasswordError;

  /// Beside the new password.
  final String? newPasswordError;

  /// Beside the new password typed again.
  final String? confirmError;

  /// For the whole screen.
  final String? error;
}

/// The screen's state, discarded when the screen closes.
final NotifierProvider<ChangePasswordController, ChangePasswordState>
changePasswordControllerProvider =
    NotifierProvider.autoDispose<ChangePasswordController, ChangePasswordState>(
      ChangePasswordController.new,
    );

/// A new password with the current one (ASVS; week 7 plan, D4): the server
/// ends every other session, this one goes on (AUTH-06).
class ChangePasswordController extends Notifier<ChangePasswordState> {
  @override
  ChangePasswordState build() => const ChangePasswordState();

  /// Checks the form on the device, then sends it once; ignored while a
  /// change runs.
  Future<void> submit({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    if (state.submitting) return;
    final local = _checked(currentPassword, newPassword, confirmPassword);
    if (local != null) {
      state = local;
      return;
    }
    state = const ChangePasswordState(submitting: true);
    try {
      await ref
          .read(securityRepositoryProvider)
          .changePassword(
            currentPassword: currentPassword,
            newPassword: newPassword,
          );
      if (ref.mounted) state = const ChangePasswordState(done: true);
    } on ApiFailure catch (failure) {
      if (!ref.mounted) return;
      state = switch (failure) {
        ApiRejected(code: ApiErrorCode.passwordIncorrect) =>
          ChangePasswordState(currentPasswordError: messageFor(failure)),
        ApiRejected(code: ApiErrorCode.weakPassword) => ChangePasswordState(
          newPasswordError: messageFor(failure),
        ),
        _ => ChangePasswordState(error: messageFor(failure)),
      };
    }
  }

  static ChangePasswordState? _checked(
    String currentPassword,
    String newPassword,
    String confirmPassword,
  ) {
    if (currentPassword.isEmpty) {
      return const ChangePasswordState(
        currentPasswordError: 'Informe sua senha.',
      );
    }
    if (!hasAcceptablePasswordLength(newPassword)) {
      return const ChangePasswordState(
        newPasswordError: 'Use de 10 a 128 caracteres.',
      );
    }
    if (confirmPassword != newPassword) {
      return const ChangePasswordState(
        confirmError: 'As senhas não conferem. Digite de novo.',
      );
    }
    return null;
  }
}
