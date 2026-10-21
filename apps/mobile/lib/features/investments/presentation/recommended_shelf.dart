import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/core/ui/example_tag.dart';
import 'package:next_bank/features/investments/presentation/example_investments.dart';

/// "Investimentos recomendados": the made-up offers, scrolling sideways,
/// each with its rate and product. Each says it is coming for now.
class RecommendedShelf extends StatelessWidget {
  /// Creates the shelf.
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Semantics(
                header: true,
                child: Text(
                  'Investimentos recomendados',
                  style: context.nbText.sectionTitle,
                ),
              ),
            ),
            const ExampleTag(),
          ],
        ),
        Text(
          'Produtos escolhidos para o seu perfil',
          style: context.nbText.caption,
        ),
        const SizedBox(height: NbSpace.md),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          // Every card as tall as the tallest.
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: NbSpace.sm,
              children: [
                for (final offer in exampleOffers) _OfferCard(offer: offer),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _OfferCard extends StatelessWidget {
  const new({required this.offer});

  final RecommendedOffer offer;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    void sayComingSoon() =>
        showNbToast(context, 'Em breve.', icon: Icons.info_outline);

    return Semantics(
      container: true,
      button: true,
      label: '${offer.kind}, ${offer.name}, ${offer.rate}',
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
          child: Container(
            width: 168,
            padding: const EdgeInsets.all(NbSpace.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: NbSpace.sm,
                  children: [
                    Icon(Icons.bar_chart, color: colors.accent),
                    Expanded(
                      child: Text(
                        offer.rate,
                        textAlign: TextAlign.end,
                        style: context.nbText.bodyStrong.copyWith(
                          color: colors.success,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: NbSpace.xl),
                Text(offer.kind, style: context.nbText.caption),
                Text(offer.name, style: context.nbText.bodyText),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
