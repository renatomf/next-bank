import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

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
