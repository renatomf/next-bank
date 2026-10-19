import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/auth/presentation/sign_out/sign_out_controller.dart';

/// "Sair da conta": ends the session (AUTH-06); the router then shows the
/// login. One outlined box, icon and text, all of it the button (S21
/// checkpoint of v1.1.0, task 4.4). Disabled while leaving, so a double tap
/// ends the session once.
class SignOutButton extends ConsumerWidget {
  /// Creates the button.
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.nbColors;
    final leaving = ref.watch(signOutControllerProvider);

    return OutlinedButton.icon(
      onPressed: leaving
          ? null
          : () => ref.read(signOutControllerProvider.notifier).signOut(),
      icon: const Icon(Icons.logout),
      label: const Text('Sair da conta'),
      style: OutlinedButton.styleFrom(
        foregroundColor: colors.danger,
        side: BorderSide(color: colors.danger),
        minimumSize: const Size.fromHeight(NbSize.button),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NbRadius.box),
        ),
      ),
    );
  }
}
