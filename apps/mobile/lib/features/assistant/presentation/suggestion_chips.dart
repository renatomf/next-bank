import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// Quick suggestions above the assistant's field, scrolling sideways. Each
/// says it is coming for now.
class SuggestionChips extends StatelessWidget {
  /// Creates the suggestions.
  const new({super.key});

  static const List<(IconData, String)> _suggestions = [
    (Icons.event_outlined, 'Criar lembrete'),
    (Icons.account_balance_wallet_outlined, 'Ver meu saldo'),
    (Icons.receipt_long_outlined, 'Analisar extrato'),
  ];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        spacing: NbSpace.sm,
        children: [
          for (final (icon, label) in _suggestions)
            NbChip(
              label: label,
              icon: icon,
              onPressed: () =>
                  showNbToast(context, 'Em breve.', icon: Icons.info_outline),
            ),
        ],
      ),
    );
  }
}
