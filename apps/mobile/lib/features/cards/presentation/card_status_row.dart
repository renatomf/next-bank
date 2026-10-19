import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// Whether the card is unlocked, with the way to lock it. Layout only:
/// "Bloquear" says it is coming.
class CardStatusRow extends StatelessWidget {
  /// Creates the row.
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: NbSpace.lg),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(NbRadius.boxInner),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        spacing: NbSpace.md,
        children: [
          Icon(Icons.lock_open, size: NbSize.icon, color: colors.success),
          Expanded(
            child: Text(
              'Cartão desbloqueado',
              style: NbType.bodyText.copyWith(color: colors.text),
            ),
          ),
          TextButton(
            onPressed: () =>
                showNbToast(context, 'Em breve.', icon: Icons.info_outline),
            child: const Text('Bloquear'),
          ),
        ],
      ),
    );
  }
}
