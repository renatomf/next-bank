import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/cards/presentation/card_status_row.dart';
import 'package:next_bank/features/cards/presentation/example_card_figures.dart';

/// What the debit card shows below the carousel: its status, the
/// pre-approved credit, the shortcuts and the quick settings. Layout only:
/// each action says it is coming.
class DebitCardPanel extends StatelessWidget {
  /// Creates the panel.
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    void sayComingSoon() =>
        showNbToast(context, 'Em breve.', icon: Icons.info_outline);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: NbSpace.lg,
      children: [
        const CardStatusRow(),
        _PreApprovedBox(onActivate: sayComingSoon),
        NbGrid(
          columns: 4,
          children: [
            for (final (icon, label) in const [
              (Icons.account_balance_wallet_outlined, 'Carteira digital'),
              (Icons.key_outlined, 'Exibir senha'),
              (Icons.credit_card, 'Cartão virtual'),
              (Icons.add_circle_outline, 'Mais opções'),
            ])
              ActionTile(
                icon: Icon(icon),
                label: label,
                onPressed: sayComingSoon,
              ),
          ],
        ),
        Row(
          children: [
            Expanded(
              child: Text(
                'Configurações rápidas',
                style: context.nbText.sectionTitle,
              ),
            ),
            TextButton(
              onPressed: sayComingSoon,
              child: const Text('Acessar todas'),
            ),
          ],
        ),
        MenuGroup(
          children: [
            MenuRow(
              icon: Icons.key_outlined,
              title: 'Exibir senha',
              onTap: sayComingSoon,
            ),
            MenuRow(
              icon: Icons.arrow_upward,
              title: 'Aumentar limite',
              onTap: sayComingSoon,
            ),
            MenuRow(
              icon: Icons.star_border,
              title: 'Benefícios',
              onTap: sayComingSoon,
            ),
          ],
        ),
      ],
    );
  }
}

/// The made-up pre-approved credit, with the way to turn it on.
class _PreApprovedBox extends StatelessWidget {
  const new({required this.onActivate});

  final VoidCallback onActivate;

  @override
  Widget build(BuildContext context) {
    final limit = formatReais(examplePreApprovedCents).full;

    return NbSurface(
      selected: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: NbSpace.sm,
        children: [
          Text(
            'Você tem $limit de limite pré-aprovado',
            style: context.nbText.bodyStrong,
          ),
          const Divider(),
          Text(
            'Mais liberdade nas suas compras: ative a função crédito do seu '
            'cartão e comece a usar.',
            style: context.nbText.caption,
          ),
          TextButton(onPressed: onActivate, child: const Text('Ativar')),
        ],
      ),
    );
  }
}
