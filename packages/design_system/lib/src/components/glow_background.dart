import 'package:design_system/src/theme.dart';
import 'package:flutter/material.dart';

/// Screen background with the ambient mint glow at the top, as in the
/// mockups (brief, section 2.2).
class GlowBackground extends StatelessWidget {
  /// Paints the background behind [child].
  const new({required this.child, super.key});

  /// The screen content.
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return ColoredBox(
      color: colors.background,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: const Alignment(0.8, -1.1),
            radius: 1.2,
            colors: [colors.glow, colors.glow.withValues(alpha: 0)],
          ),
        ),
        child: child,
      ),
    );
  }
}
