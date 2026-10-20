import 'package:design_system/src/components/css_gradients.dart';
import 'package:design_system/src/components/dither.dart';
import 'package:design_system/src/theme/theme.dart';
import 'package:flutter/material.dart';

/// Screen background with the ambient mint glow at the top, as in the
/// mockups: radial-gradient(70% 35% at 95% 0%, glow, transparent 70%)
/// (brief, section 2.2).
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
      child: Stack(
        fit: StackFit.expand,
        children: [
          LayoutBuilder(
            builder: (context, constraints) => DecoratedBox(
              decoration: BoxDecoration(
                gradient: cssRadialGradient(
                  size: constraints.biggest,
                  center: const Offset(0.95, 0),
                  radii: const Size(0.7, 0.35),
                  colors: [colors.glow, colors.glow.withValues(alpha: 0)],
                  stops: const [0, 0.7],
                ),
              ),
            ),
          ),
          // A faint glow on near-black bands into rings without it.
          const Dither(),
          child,
        ],
      ),
    );
  }
}
