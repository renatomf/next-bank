import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/auth/presentation/auth_messages.dart';
import 'package:next_bank/features/auth/presentation/login_controller.dart';

/// Login with e-mail and password (screen 2). Says why the user is back
/// here when the server ended the session.
class LoginScreen extends ConsumerStatefulWidget {
  /// Creates the login screen; [onRegister] opens the registration.
  const new({required this.onRegister, super.key});

  /// "Criar conta".
  final VoidCallback onRegister;

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    // The controller reports progress and errors through its state.
    unawaited(
      ref
          .read(loginControllerProvider.notifier)
          .submit(email: _email.text, password: _password.text),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(loginControllerProvider);
    final endReason = switch (ref.watch(sessionProvider).value) {
      SignedOut(:final reason) => reason,
      _ => null,
    };
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: AutofillGroup(
            child: ListView(
              padding: const EdgeInsets.all(NbSpace.screen),
              children: [
                const Align(alignment: Alignment.centerLeft, child: NextLogo()),
                const SizedBox(height: NbSpace.xxl),
                // The tagline of the Home mockup.
                const DisplayTitle(
                  lead: 'Seu dinheiro,',
                  trail: 'um passo à frente.',
                ),
                if (endReason != null) ...[
                  const SizedBox(height: NbSpace.xl),
                  InfoNotice(message: sessionEndMessage(endReason)),
                ],
                const SizedBox(height: NbSpace.xxl),
                NbTextField(
                  label: 'E-mail',
                  controller: _email,
                  errorText: state.emailError,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  textInputAction: TextInputAction.next,
                  enabled: !state.sending,
                ),
                const SizedBox(height: NbSpace.lg),
                NbTextField(
                  label: 'Senha',
                  controller: _password,
                  errorText: state.passwordError,
                  obscureText: true,
                  autofillHints: const [AutofillHints.password],
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _submit(),
                  enabled: !state.sending,
                ),
                if (state.error case final error?) ...[
                  const SizedBox(height: NbSpace.lg),
                  FormErrorText(error),
                ],
                const SizedBox(height: NbSpace.xl),
                PrimaryButton(
                  label: 'Entrar',
                  loading: state.sending,
                  onPressed: _submit,
                ),
                const SizedBox(height: NbSpace.sm),
                Center(
                  child: TextButton(
                    onPressed: state.sending ? null : widget.onRegister,
                    child: const Text('Criar conta'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
