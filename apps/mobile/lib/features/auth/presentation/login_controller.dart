import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/auth/domain/email.dart';
import 'package:next_bank/features/auth/presentation/auth_messages.dart';
import 'package:next_bank/features/auth/presentation/auth_providers.dart';

/// What the login screen shows. Never holds the password: it lives only in
/// the screen's text field (MOB-02).
final class LoginState {
  /// Creates the state; the default is the empty form.
  const new({
    this.sending = false,
    this.emailError,
    this.passwordError,
    this.error,
  });

  /// True while the login request runs.
  final bool sending;

  /// Local check of the e-mail field.
  final String? emailError;

  /// Local check of the password field.
  final String? passwordError;

  /// Why the API refused or could not be reached.
  final String? error;
}

/// The login screen's state, discarded when the screen closes.
final NotifierProvider<LoginController, LoginState> loginControllerProvider =
    NotifierProvider.autoDispose<LoginController, LoginState>(
      LoginController.new,
    );

/// Checks the form, logs in and starts the session; the router then leaves
/// the login screen.
class LoginController extends Notifier<LoginState> {
  @override
  LoginState build() => const LoginState();

  /// Ignored while a login is running, so a double tap sends one request.
  Future<void> submit({required String email, required String password}) async {
    if (state.sending) return;
    final address = email.trim();
    final emailError = isValidEmail(address)
        ? null
        : 'Informe um e-mail válido.';
    final passwordError = password.isEmpty ? 'Informe sua senha.' : null;
    if (emailError != null || passwordError != null) {
      state = LoginState(emailError: emailError, passwordError: passwordError);
      return;
    }

    state = const LoginState(sending: true);
    final repository = ref.read(authRepositoryProvider);
    final session = ref.read(sessionProvider.notifier);
    try {
      final tokens = await repository.login(
        email: address,
        password: password,
        deviceLabel: null,
      );
      await session.signIn(tokens);
    } on ApiFailure catch (failure) {
      if (ref.mounted) state = LoginState(error: messageFor(failure));
    }
  }
}
