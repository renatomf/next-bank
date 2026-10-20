import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/investments/presentation/example_investments.dart';
import 'package:next_bank/features/investments/presentation/investment_link_card.dart';
import 'package:next_bank/features/investments/presentation/recommended_shelf.dart';

/// The "Investir" tab: the recommended offers, the full shelf of products,
/// two to a row, and Home Broker. Each says it is coming for now.
class InvestTab extends StatelessWidget {
  /// Creates the tab.
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const RecommendedShelf(),
        const SizedBox(height: NbSpace.xl),
        Semantics(
          header: true,
          child: Text('Produtos', style: context.nbText.sectionTitle),
        ),
        Text(
          'Prateleira completa de investimentos',
          style: context.nbText.caption,
        ),
        const SizedBox(height: NbSpace.md),
        NbGrid(
          columns: 2,
          children: [
            for (final product in investmentProducts)
              _ProductCard(product: product),
          ],
        ),
        const SizedBox(height: NbSpace.xl),
        const InvestmentLinkCard(
          icon: Icons.candlestick_chart_outlined,
          title: 'Home Broker',
          description: 'Acompanhe e negocie ações em tempo real e sem custo',
        ),
      ],
    );
  }
}

class _ProductCard extends StatelessWidget {
  const new({required this.product});

  final InvestmentProduct product;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    void sayComingSoon() =>
        showNbToast(context, 'Em breve.', icon: Icons.info_outline);

    return Semantics(
      container: true,
      button: true,
      label: '${product.title}. ${product.description}',
      onTap: sayComingSoon,
      excludeSemantics: true,
      child: Material(
        color: colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NbRadius.box),
          side: BorderSide(color: colors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: sayComingSoon,
          child: Padding(
            padding: const EdgeInsets.all(NbSpace.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: NbSpace.xs,
              children: [
                Text(product.title, style: context.nbText.bodyStrong),
                Text(product.description, style: context.nbText.caption),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
