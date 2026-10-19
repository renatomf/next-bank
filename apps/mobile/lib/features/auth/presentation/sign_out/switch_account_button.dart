import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/auth/presentation/sign_out/sign_out_controller.dart';

/// "Entrar com outra conta" on the Unlock screen and "Trocar conta" on the
/// profile: ends this session, like "Sair", and the router shows the login
/// (v1.1.0 plan, tasks 2 and 4.4).
class SwitchAccountButton extends ConsumerWidget {
  /// Creates the button with its [label].
  const new({
    this.label = 'Entrar com outra conta',
    this.askFirst = false,
    super.key,
  });

  /// What the button says where it is.
  final String label;

  /// Asks before leaving, with a way back: on the profile the customer is
  /// still in (S21 checkpoint of task 4.4); the Unlock screen needs none.
  final bool askFirst;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leaving = ref.watch(signOutControllerProvider);
    return TextButton(
      onPressed: leaving ? null : () => _switch(context, ref),
      child: Text(label),
    );
  }

  Future<void> _switch(BuildContext context, WidgetRef ref) async {
    final confirmed =
        !askFirst ||
        await showConfirmDialog(
          context,
          title: 'Trocar de conta?',
          message: 'Você sai desta conta e entra com outra no login.',
          confirmLabel: 'Trocar conta',
          cancelLabel: 'Voltar',
        );
    if (!confirmed) return;
    await ref.read(signOutControllerProvider.notifier).signOut();
  }
}
