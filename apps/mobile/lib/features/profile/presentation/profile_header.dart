import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/profile/profile_controller.dart';

/// The top of the profile: the X back to the Home, the customer's name, the
/// CPF as the server masks it (READ-02) and "Trocar conta".
class ProfileHeader extends ConsumerWidget {
  /// Creates the header; the app gives the switch-account button, so
  /// features never import each other.
  const new({required this.onClose, required this.switchAccount, super.key});

  /// Leaves the profile.
  final VoidCallback onClose;

  /// "Trocar conta", from the auth feature.
  final Widget switchAccount;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider).value;
    final cpf = profile?.cpfMasked;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        IconCircleButton(
          icon: Icons.close,
          label: 'Fechar',
          onPressed: onClose,
        ),
        const SizedBox(height: NbSpace.lg),
        Row(
          children: [
            Expanded(
              child: Semantics(
                header: true,
                child: Text(
                  profile?.name ?? '',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
              ),
            ),
            const SizedBox(width: NbSpace.sm),
            // Wraps on a small phone with large text (brief, section 8).
            Flexible(child: switchAccount),
          ],
        ),
        if (cpf != null) Text('CPF: $cpf', style: context.nbText.caption),
      ],
    );
  }
}
