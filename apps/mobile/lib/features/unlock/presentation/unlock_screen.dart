import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/unlock/presentation/unlock_controller.dart';

/// The Unlock screen (screen 5; F-16): the PIN before anything of the account,
/// when the app opens with a stored session and after 5 minutes away.
class UnlockScreen extends ConsumerStatefulWidget {
  /// Creates the screen; [actions] go in the header, such as "Sair".
  const new({this.actions = const [], super.key});

  /// Header actions, given by the router so features do not import each other.
  final List<Widget> actions;

  @override
  ConsumerState<UnlockScreen> createState() => _UnlockScreenState();
}

class _UnlockScreenState extends ConsumerState<UnlockScreen> {
  final _pin = TextEditingController();

  @override
  void dispose() {
    _pin.dispose();
    super.dispose();
  }

  void _onCompleted(String pin) {
    _pin.clear();
    // The controller reports progress and errors through its state.
    unawaited(ref.read(unlockControllerProvider.notifier).submit(pin));
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(unlockControllerProvider);
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              Row(
                children: [const NextLogo(), const Spacer(), ...widget.actions],
              ),
              const SizedBox(height: NbSpace.xxl),
              Semantics(
                header: true,
                child: Text('Digite seu PIN', style: text.headlineSmall),
              ),
              const SizedBox(height: NbSpace.sm),
              Text(
                'Por segurança, confirme que é você para abrir sua conta.',
                style: text.bodySmall,
              ),
              const SizedBox(height: NbSpace.xl),
              if (state.blocked)
                // Nothing left to type: the message says why, "Sair" says how.
                InfoNotice(message: state.error ?? '')
              else
                PinField(
                  label: 'PIN de 4 dígitos',
                  controller: _pin,
                  errorText: state.error,
                  onCompleted: _onCompleted,
                  enabled: !state.verifying,
                ),
              if (state.verifying) ...[
                const SizedBox(height: NbSpace.xl),
                const Center(
                  child: CircularProgressIndicator(
                    semanticsLabel: 'Conferindo seu PIN',
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
