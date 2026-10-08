import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/auth/presentation/sign_out_controller.dart';

/// "Sair": ends the session (AUTH-06); the router then shows the login.
/// Disabled while leaving, so a double tap ends the session once.
class SignOutButton extends ConsumerWidget {
  /// Creates the button.
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leaving = ref.watch(signOutControllerProvider);
    return IconCircleButton(
      icon: Icons.logout,
      label: 'Sair',
      onPressed: leaving
          ? null
          : () => ref.read(signOutControllerProvider.notifier).signOut(),
    );
  }
}
