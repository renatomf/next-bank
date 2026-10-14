import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// The developer's green glass art (v1.1.0 checkpoint, 2026-10-14), tinted
/// toward the brand's mint: behind the Unlock screen, the balance card and
/// the Pix amount card. Decorative, so screen readers skip it.
class GlassArt extends StatelessWidget {
  /// Creates the art, covering its box.
  const new({super.key});

  /// The colorization, chosen by the developer among previews: each pixel's
  /// luminance maps from #00241C (shadows) toward the mint #00FFC8 (lights),
  /// keeping 20% of the original color so the glass keeps its depth. The
  /// gain is 35% above the plain mapping, for a brighter art (developer's
  /// request): the lights saturate at the mint, while the brightest result,
  /// #33FFE1, barely moves, so the contrast tests still hold.
  static const List<double> mint = [
    0.2, 0, 0, 0, 0, //
    0.19719, 0.86336, 0.06697, 0, 28.8, //
    0.12639, 0.42519, 0.24292, 0, 22.4, //
    0, 0, 0, 1, 0, //
  ];

  @override
  Widget build(BuildContext context) {
    return const ColorFiltered(
      colorFilter: ColorFilter.matrix(mint),
      child: Image(
        image: NbArt.glass,
        fit: BoxFit.cover,
        excludeFromSemantics: true,
      ),
    );
  }
}
