import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/auth/domain/cpf.dart';
import 'package:next_bank/features/auth/presentation/register/register_controller.dart';

/// Registration (screen 3). The CPF is drawn by the app and cannot be
/// typed, so visitors of the public demo never enter their own (DEMO-01).
class RegisterScreen extends ConsumerStatefulWidget {
  /// Creates the screen; [onLogin] goes back to the login.
  const new({required this.onLogin, super.key});

  /// "Já tenho conta".
  final VoidCallback onLogin;

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _cpf = TextEditingController();

  @override
  void initState() {
    super.initState();
    _cpf.text = formatCpf(ref.read(registerControllerProvider).cpf);
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _cpf.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    // The controller reports progress and errors through its state.
    unawaited(
      ref
          .read(registerControllerProvider.notifier)
          .submit(
            name: _name.text,
            email: _email.text,
            password: _password.text,
          ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(
      registerControllerProvider.select((state) => state.cpf),
      (_, cpf) => _cpf.text = formatCpf(cpf),
    );
    final state = ref.watch(registerControllerProvider);
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: AutofillGroup(
            child: ListView(
              padding: const EdgeInsets.all(NbSpace.screen),
              children: [
                const Align(alignment: Alignment.centerLeft, child: NextLogo()),
                const SizedBox(height: NbSpace.xxl),
                Semantics(
                  header: true,
                  child: Text(
                    'Criar conta',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                ),
                const SizedBox(height: NbSpace.lg),
                const InfoNotice(
                  message:
                      'Demonstração: o CPF é gerado pelo app. Use um nome e '
                      'um e-mail fictícios.',
                ),
                const SizedBox(height: NbSpace.xl),
                NbTextField(
                  label: 'Nome completo',
                  controller: _name,
                  errorText: state.nameError,
                  keyboardType: TextInputType.name,
                  textInputAction: TextInputAction.next,
                  enabled: !state.sending,
                ),
                const SizedBox(height: NbSpace.lg),
                NbTextField(
                  label: 'E-mail',
                  controller: _email,
                  errorText: state.emailError,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  enabled: !state.sending,
                ),
                const SizedBox(height: NbSpace.lg),
                NbTextField(
                  label: 'CPF fictício',
                  controller: _cpf,
                  readOnly: true,
                  suffix: TextButton(
                    onPressed: state.sending
                        ? null
                        : ref
                              .read(registerControllerProvider.notifier)
                              .drawAnotherCpf,
                    child: const Text('Gerar outro'),
                  ),
                ),
                const SizedBox(height: NbSpace.lg),
                NbTextField(
                  label: 'Senha',
                  controller: _password,
                  errorText: state.passwordError,
                  obscureText: true,
                  autofillHints: const [AutofillHints.newPassword],
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
                  label: 'Criar conta',
                  loading: state.sending,
                  onPressed: _submit,
                ),
                const SizedBox(height: NbSpace.sm),
                Center(
                  child: TextButton(
                    onPressed: state.sending ? null : widget.onLogin,
                    child: const Text('Já tenho conta'),
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
