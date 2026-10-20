import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/investments/presentation/investor_profile_box.dart';

/// The "Mais" tab: documents, portability, terms and the broker's Pix, then
/// the invitation to set the investor profile. Each says it is coming for
/// now.
class MoreTab extends StatelessWidget {
  /// Creates the tab.
  const new({super.key});

  static const List<String> _rows = [
    'Meus documentos',
    'Portabilidade',
    'Termos de investimento',
    'Fazer Pix via conta da corretora',
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: NbSpace.xl,
      children: [
        MenuGroup(
          children: [
            for (final row in _rows)
              MenuRow(
                title: row,
                onTap: () =>
                    showNbToast(context, 'Em breve.', icon: Icons.info_outline),
              ),
          ],
        ),
        const InvestorProfileBox(
          icon: Icons.assignment_outlined,
          title: 'Apenas três perguntas para definir seu perfil de investidor',
          description:
              'Responda e veja os investimentos que combinam com você.',
        ),
      ],
    );
  }
}
