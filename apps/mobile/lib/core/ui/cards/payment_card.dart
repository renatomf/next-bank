import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// A card as it looks in the hand (v1.1.0 plan, tasks 4.14 and 4.15): the
/// balance card's glass art on [artArea], a dark veil for the text, the
/// logo, the contactless sign, the last four digits and a generic brand.
/// Read by screen readers as one sentence.
class PaymentCard extends StatelessWidget {
  /// Creates the card.
  const new({
    required this.label,
    required this.lastFour,
    required this.artArea,
    super.key,
  });

  /// The card's kind, such as "Débito", for screen readers.
  final String label;

  /// The last four digits; never the full number.
  final String lastFour;

  /// Which area of the glass art the card shows.
  final Alignment artArea;

  /// The proportions of a real card (ISO/IEC 7810 ID-1).
  static const double aspectRatio = 85.6 / 53.98;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Cartão $label, final $lastFour',
      excludeSemantics: true,
      child: AspectRatio(
        aspectRatio: aspectRatio,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(NbRadius.box),
          child: Stack(
            fit: StackFit.expand,
            children: [
              GlassArt(alignment: artArea),
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
                            '•••• $lastFour',
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

/// A generic card brand: two overlapping circles in the app's colors. It
/// hints at a card network without copying a real one's mark (repository
/// rules). Decoration only.
class CardBrandMark extends StatelessWidget {
  /// Creates the mark.
  const new({super.key});

  static const double _circle = 22;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: SizedBox(
        width: _circle * 1.6,
        height: _circle,
        child: Stack(
          children: [
            _Circle(color: NbBrand.mint.withValues(alpha: 0.9)),
            Positioned(
              right: 0,
              child: _Circle(color: Colors.white.withValues(alpha: 0.7)),
            ),
          ],
        ),
      ),
    );
  }
}

class _Circle extends StatelessWidget {
  const new({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    width: CardBrandMark._circle,
    height: CardBrandMark._circle,
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );
}
