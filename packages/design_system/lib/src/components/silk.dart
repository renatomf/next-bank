import 'package:design_system/src/css_gradients.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// The silk of mint lights behind the always-dark cards (brief, section 2.3;
/// the Home mockup's CSS gives every value). Internal to the package: the
/// cards that use it are what the app sees. The mockup's four CSS backgrounds,
/// drawn with CSS geometry, from the bottom layer up.
class Silk extends StatelessWidget {
  /// Creates the silk.
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        Widget layer(Gradient gradient) =>
            DecoratedBox(decoration: BoxDecoration(gradient: gradient));
        return Stack(
          fit: StackFit.expand,
          children: [
            // linear-gradient(160deg, #0B2A26 0%, #06110F 70%)
            layer(
              cssLinearGradient(
                size: size,
                angleDegrees: 160,
                colors: const [
                  NbBalanceCardColors.baseTop,
                  NbBalanceCardColors.baseBottom,
                ],
                stops: const [0, 0.7],
              ),
            ),
            // linear-gradient(118deg, clear 38%, sheen 48%, clear 58%)
            layer(
              cssLinearGradient(
                size: size,
                angleDegrees: 118,
                colors: [
                  NbBalanceCardColors.sheen.withValues(alpha: 0),
                  NbBalanceCardColors.sheen,
                  NbBalanceCardColors.sheen.withValues(alpha: 0),
                ],
                stops: const [0.38, 0.48, 0.58],
              ),
            ),
            // radial-gradient(60% 80% at 8% 105%, teal 65% → clear at 65%)
            layer(
              cssRadialGradient(
                size: size,
                center: const Offset(0.08, 1.05),
                radii: const Size(0.6, 0.8),
                colors: [
                  NbBalanceCardColors.glowBottom,
                  NbBalanceCardColors.glowBottom.withValues(alpha: 0),
                ],
                stops: const [0, 0.65],
              ),
            ),
            // radial-gradient(70% 90% at 92% 8%, mint 75% → clear at 60%)
            layer(
              cssRadialGradient(
                size: size,
                center: const Offset(0.92, 0.08),
                radii: const Size(0.7, 0.9),
                colors: [
                  NbBalanceCardColors.glowTop,
                  NbBalanceCardColors.glowTop.withValues(alpha: 0),
                ],
                stops: const [0, 0.6],
              ),
            ),
          ],
        );
      },
    );
  }
}
