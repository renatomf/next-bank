import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/auth/presentation/sign_out_controller.dart';

/// "Sair": ends the session (AUTH-06); the router then shows the login.
class SignOutButton extends ConsumerWidget {
  /// Creates the button.
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leaving = ref.watch(signOutControllerProvider);
    return IconButton(
      tooltip: 'Sair',
      onPressed: leaving
          ? null
          : () => ref.read(signOutControllerProvider.notifier).signOut(),
      icon: leaving
          ? const SizedBox.square(
              dimension: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Icon(Icons.logout),
    );
  }
}
