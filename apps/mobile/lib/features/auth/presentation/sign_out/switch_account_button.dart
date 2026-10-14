import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/auth/presentation/sign_out/sign_out_controller.dart';

/// "Entrar com outra conta" on the Unlock screen: ends this session, like
/// "Sair", and the router shows the login (v1.1.0 plan, task 2).
class SwitchAccountButton extends ConsumerWidget {
  /// Creates the button.
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leaving = ref.watch(signOutControllerProvider);
    return TextButton(
      onPressed: leaving
          ? null
          : () => ref.read(signOutControllerProvider.notifier).signOut(),
      child: const Text('Entrar com outra conta'),
    );
  }
}
