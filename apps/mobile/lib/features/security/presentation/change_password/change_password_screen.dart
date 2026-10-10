import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/security/presentation/change_password/change_password_controller.dart';

/// A new password with the current one (week 7 plan, D4): the other devices
/// are signed out, this one goes on (AUTH-06).
class ChangePasswordScreen extends ConsumerStatefulWidget {
  /// Creates the screen; [onDone] leaves it once the password changed.
  const new({required this.onBack, required this.onDone, super.key});

  /// Leaves without changing.
  final VoidCallback onBack;

  /// Leaves after the change, with the confirmation already shown.
  final VoidCallback onDone;

  @override
  ConsumerState<ChangePasswordScreen> createState() =>
      _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _current = TextEditingController();
  final _new = TextEditingController();
  final _confirm = TextEditingController();

  @override
  void dispose() {
    _current.dispose();
    _new.dispose();
    _confirm.dispose();
    super.dispose();
  }

  void _submit() {
    final current = _current.text;
    final newPassword = _new.text;
    final confirm = _confirm.text;
    // The fields forget the secrets at once (MOB-02).
    _current.clear();
    _new.clear();
    _confirm.clear();
    unawaited(
      ref
          .read(changePasswordControllerProvider.notifier)
          .submit(
            currentPassword: current,
            newPassword: newPassword,
            confirmPassword: confirm,
          ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(changePasswordControllerProvider, (_, next) {
      if (!next.done) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Senha alterada. Os outros aparelhos saíram da conta.'),
        ),
      );
      widget.onDone();
    });
    final state = ref.watch(changePasswordControllerProvider);
    final error = state.error;
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              ScreenHeader(
                title: 'Trocar senha',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: widget.onBack,
              ),
              const SizedBox(height: NbSpace.lg),
              Text(
                'Os outros aparelhos conectados saem da sua conta. Este '
                'continua.',
                style: text.bodySmall,
              ),
              const SizedBox(height: NbSpace.xl),
              NbTextField(
                label: 'Senha atual',
                controller: _current,
                obscureText: true,
                autofillHints: const [AutofillHints.password],
                errorText: state.currentPasswordError,
                enabled: !state.submitting,
              ),
              const SizedBox(height: NbSpace.lg),
              NbTextField(
                label: 'Nova senha',
                controller: _new,
                obscureText: true,
                autofillHints: const [AutofillHints.newPassword],
                errorText: state.newPasswordError,
                enabled: !state.submitting,
              ),
              const SizedBox(height: NbSpace.lg),
              NbTextField(
                label: 'Digite a nova senha de novo',
                controller: _confirm,
                obscureText: true,
                errorText: state.confirmError,
                enabled: !state.submitting,
              ),
              if (error != null) ...[
                const SizedBox(height: NbSpace.lg),
                FormErrorText(error),
              ],
              const SizedBox(height: NbSpace.xl),
              PrimaryButton(
                label: 'Trocar senha',
                onPressed: _submit,
                loading: state.submitting,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
