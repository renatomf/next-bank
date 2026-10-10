import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/security/presentation/change_pin/change_pin_controller.dart';

/// A new transaction PIN with the password (week 7 plan, D5): also how a PIN
/// locked by wrong attempts, or in need of a reset, works again.
class ChangePinScreen extends ConsumerStatefulWidget {
  /// Creates the screen; [onDone] leaves it once the PIN changed.
  const new({required this.onBack, required this.onDone, super.key});

  /// Leaves without changing.
  final VoidCallback onBack;

  /// Leaves after the change, with the confirmation already shown.
  final VoidCallback onDone;

  @override
  ConsumerState<ChangePinScreen> createState() => _ChangePinScreenState();
}

class _ChangePinScreenState extends ConsumerState<ChangePinScreen> {
  final _password = TextEditingController();
  final _newPin = TextEditingController();
  final _confirmPin = TextEditingController();

  @override
  void dispose() {
    _password.dispose();
    _newPin.dispose();
    _confirmPin.dispose();
    super.dispose();
  }

  void _submit() {
    final password = _password.text;
    final newPin = _newPin.text;
    final confirmPin = _confirmPin.text;
    // The fields forget the secrets at once (MOB-02).
    _password.clear();
    _newPin.clear();
    _confirmPin.clear();
    unawaited(
      ref
          .read(changePinControllerProvider.notifier)
          .submit(password: password, newPin: newPin, confirmPin: confirmPin),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(changePinControllerProvider, (_, next) {
      if (!next.done) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('PIN alterado.')));
      widget.onDone();
    });
    final state = ref.watch(changePinControllerProvider);
    final error = state.error;
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              ScreenHeader(
                title: 'Trocar PIN',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: widget.onBack,
              ),
              const SizedBox(height: NbSpace.lg),
              Text(
                'Confirme com sua senha. O PIN novo também vale se o atual '
                'estiver bloqueado.',
                style: text.bodySmall,
              ),
              const SizedBox(height: NbSpace.xl),
              NbTextField(
                label: 'Sua senha',
                controller: _password,
                obscureText: true,
                autofillHints: const [AutofillHints.password],
                errorText: state.passwordError,
                enabled: !state.submitting,
              ),
              const SizedBox(height: NbSpace.lg),
              PinField(
                label: 'Novo PIN',
                controller: _newPin,
                errorText: state.pinError,
                enabled: !state.submitting,
              ),
              const SizedBox(height: NbSpace.lg),
              PinField(
                label: 'Digite o novo PIN de novo',
                controller: _confirmPin,
                errorText: state.confirmError,
                enabled: !state.submitting,
              ),
              if (error != null) ...[
                const SizedBox(height: NbSpace.lg),
                FormErrorText(error),
              ],
              const SizedBox(height: NbSpace.xl),
              PrimaryButton(
                label: 'Trocar PIN',
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
