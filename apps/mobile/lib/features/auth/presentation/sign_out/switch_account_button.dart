import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/auth/presentation/sign_out/sign_out_controller.dart';

/// "Entrar com outra conta" on the Unlock screen and "Trocar conta" on the
/// profile: ends this session, like "Sair", and the router shows the login
/// (v1.1.0 plan, tasks 2 and 4.4).
class SwitchAccountButton extends ConsumerWidget {
  /// Creates the button with its [label].
  const new({this.label = 'Entrar com outra conta', super.key});

  /// What the button says where it is.
  final String label;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leaving = ref.watch(signOutControllerProvider);
    return TextButton(
      onPressed: leaving
          ? null
          : () => ref.read(signOutControllerProvider.notifier).signOut(),
      child: Text(label),
    );
  }
}
