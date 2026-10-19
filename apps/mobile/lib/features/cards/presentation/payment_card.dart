import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/cards/presentation/card_brand_mark.dart';
import 'package:next_bank/features/cards/presentation/example_cards.dart';

/// A card as it looks in the hand (v1.1.0 plan, task 4.14): the balance
/// card's glass art on another area of the image, a dark veil for the text,
/// the logo, the contactless sign, the last four digits and a generic
/// brand; the line below the carousel names the card. Read by screen
/// readers as one sentence.
class PaymentCard extends StatelessWidget {
  /// Creates the card.
  const new({required this.card, super.key});

  /// The card shown.
  final ExampleCard card;

  /// The proportions of a real card (ISO/IEC 7810 ID-1).
  static const double aspectRatio = 85.6 / 53.98;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Cartão ${card.label}, final ${card.lastFour}',
      excludeSemantics: true,
      child: AspectRatio(
        aspectRatio: aspectRatio,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(NbRadius.box),
          child: Stack(
            fit: StackFit.expand,
            children: [
              GlassArt(alignment: card.artArea),
              // Darker toward the foot, where the digits are.
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0x33000000), Color(0xB3000000)],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(NbSpace.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        NextLogo(size: 22),
                        Spacer(),
                        Icon(Icons.contactless_outlined, color: Colors.white),
                      ],
                    ),
                    const Spacer(),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Text(
                            '•••• ${card.lastFour}',
                            style: NbType.bodyStrong.copyWith(
                              color: Colors.white,
                            ),
                          ),
                        ),
                        const CardBrandMark(),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
