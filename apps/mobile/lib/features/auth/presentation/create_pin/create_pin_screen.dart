import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/auth/presentation/create_pin/create_pin_controller.dart';

/// Transaction PIN creation (screen 4), in two steps: type, then confirm.
/// Any refusal starts over from the first step.
class CreatePinScreen extends ConsumerStatefulWidget {
  /// Creates the screen; [onCreated] moves on once the account has its PIN.
  const new({required this.onCreated, super.key});

  /// Called once, when the PIN exists.
  final VoidCallback onCreated;

  @override
  ConsumerState<CreatePinScreen> createState() => _CreatePinScreenState();
}

class _CreatePinScreenState extends ConsumerState<CreatePinScreen> {
  final _pin = TextEditingController();

  /// The PIN typed in the first step, kept only until it is confirmed.
  String? _first;

  @override
  void dispose() {
    _pin.dispose();
    super.dispose();
  }

  void _onCompleted(String pin) {
    final controller = ref.read(createPinControllerProvider.notifier);
    final first = _first;
    _pin.clear();
    if (first == null) {
      if (controller.check(pin)) setState(() => _first = pin);
      return;
    }
    setState(() => _first = null);
    // The controller reports progress and errors through its state.
    unawaited(controller.submit(pin: first, confirmation: pin));
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(createPinControllerProvider, (_, next) {
      if (next.created) widget.onCreated();
    });
    final state = ref.watch(createPinControllerProvider);
    final confirming = _first != null;
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              const Align(alignment: Alignment.centerLeft, child: NextLogo()),
              const SizedBox(height: NbSpace.xxl),
              Semantics(
                header: true,
                child: Text(
                  confirming ? 'Confirme seu PIN' : 'Crie seu PIN',
                  style: text.headlineSmall,
                ),
              ),
              const SizedBox(height: NbSpace.sm),
              Text(
                'Você vai usar estes 4 dígitos para confirmar cada Pix. '
                'Evite números repetidos ou em sequência.',
                style: text.bodySmall,
              ),
              const SizedBox(height: NbSpace.xl),
              PinField(
                // A new field per step, so the keyboard and the reader
                // announce the step that changed.
                key: ValueKey(confirming),
                label: confirming ? 'Digite o PIN de novo' : 'PIN de 4 dígitos',
                controller: _pin,
                errorText: state.error,
                onCompleted: _onCompleted,
                enabled: !state.sending,
              ),
              if (state.sending) ...[
                const SizedBox(height: NbSpace.xl),
                const Center(
                  child: CircularProgressIndicator(
                    semanticsLabel: 'Criando seu PIN',
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
