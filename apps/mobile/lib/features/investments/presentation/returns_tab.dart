import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/investments/presentation/investment_link_card.dart';
import 'package:next_bank/features/investments/presentation/investor_profile_box.dart';
import 'package:next_bank/features/investments/presentation/recommended_shelf.dart';

/// The "Rentabilidade" tab: with no investor profile yet, the invitation to
/// set it, portability and the recommended offers.
class ReturnsTab extends StatelessWidget {
  /// Creates the tab.
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: NbSpace.xl,
      children: [
        InvestorProfileBox(
          title: 'Sem perfil de investidor',
          description:
              'Defina seu perfil e encontre as melhores opções de '
              'investimentos para você.',
        ),
        InvestmentLinkCard(
          icon: Icons.move_down,
          title: 'Tem investimentos em outro banco?',
          description:
              'Faça a portabilidade em poucos toques e concentre seu '
              'patrimônio em um só app.',
        ),
        RecommendedShelf(),
      ],
    );
  }
}
