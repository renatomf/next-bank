import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/core/cpf.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/auth/domain/email.dart';
import 'package:next_bank/features/auth/domain/registration_rules.dart';
import 'package:next_bank/features/auth/presentation/auth_providers.dart';

/// What the registration screen shows. Never holds the password: it lives
/// only in the screen's text field (MOB-02).
final class RegisterState {
  /// Creates the state around the fictitious [cpf] on screen.
  const new({
    required this.cpf,
    this.sending = false,
    this.nameError,
    this.emailError,
    this.passwordError,
    this.error,
  });

  /// The fictitious CPF the account will use, as 11 digits (DEMO-01).
  final String cpf;

  /// True while the registration request runs.
  final bool sending;

  /// Local check of the name field.
  final String? nameError;

  /// Local check of the e-mail field.
  final String? emailError;

  /// Local check of the password field.
  final String? passwordError;

  /// Why the API refused or could not be reached.
  final String? error;
}

/// The registration screen's state, discarded when the screen closes.
final NotifierProvider<RegisterController, RegisterState>
registerControllerProvider =
    NotifierProvider.autoDispose<RegisterController, RegisterState>(
      RegisterController.new,
    );

/// Checks the form, registers with a fictitious CPF and starts the session;
/// the router then continues to the PIN creation.
class RegisterController extends Notifier<RegisterState> {
  @override
  RegisterState build() =>
      RegisterState(cpf: fictitiousCpf(ref.read(randomProvider)));

  /// "Gerar outro": ignored while sending, so the request always carries
  /// the CPF on screen.
  void drawAnotherCpf() {
    if (state.sending) return;
    state = RegisterState(cpf: fictitiousCpf(ref.read(randomProvider)));
  }

  /// Ignored while a registration is running, so a double tap sends one
  /// request.
  Future<void> submit({
    required String name,
    required String email,
    required String password,
  }) async {
    if (state.sending) return;
    final cpf = state.cpf;
    final address = email.trim();
    final nameError = isValidName(name) ? null : 'Informe seu nome completo.';
    final emailError = isValidEmail(address)
        ? null
        : 'Informe um e-mail válido.';
    final passwordError = hasAcceptablePasswordLength(password)
        ? null
        : 'Use de 10 a 128 caracteres.';
    if (nameError != null || emailError != null || passwordError != null) {
      state = RegisterState(
        cpf: cpf,
        nameError: nameError,
        emailError: emailError,
        passwordError: passwordError,
      );
      return;
    }

    state = RegisterState(cpf: cpf, sending: true);
    final repository = ref.read(authRepositoryProvider);
    final session = ref.read(sessionProvider.notifier);
    try {
      final tokens = await repository.register(
        name: name.trim(),
        email: address,
        cpf: cpf,
        password: password,
        deviceLabel: null,
      );
      await session.signIn(tokens);
    } on ApiFailure catch (failure) {
      if (ref.mounted) {
        state = RegisterState(cpf: cpf, error: messageFor(failure));
      }
    }
  }
}
