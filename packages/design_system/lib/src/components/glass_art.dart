import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// The developer's green glass art (v1.1.0 checkpoint, 2026-10-14), tinted
/// toward the brand's mint: behind the Unlock screen, the balance card and
/// the Pix amount card, and the cards (task 4.14), each on its own area of
/// the image. Decorative, so screen readers skip it.
class GlassArt extends StatelessWidget {
  /// Creates the art, covering its box.
  const new({this.alignment = Alignment.center, super.key});

  /// Which area of the image shows when it is cropped to its box.
  final Alignment alignment;

  /// The colorization, chosen by the developer among previews: each pixel's
  /// luminance maps from #00241C (shadows) to the mint #00FFC8 (lights),
  /// keeping 20% of the original color so the glass keeps its depth. Its
  /// brightest result is #33FFD3, the ground the contrast tests check.
  static const List<double> mint = [
    0.2, 0, 0, 0, 0, //
    0.14607, 0.69138, 0.04961, 0, 28.8, //
    0.11472, 0.38592, 0.23896, 0, 22.4, //
    0, 0, 0, 1, 0, //
  ];

  @override
  Widget build(BuildContext context) {
    return ColorFiltered(
      colorFilter: const ColorFilter.matrix(mint),
      child: Image(
        image: NbArt.glass,
        fit: BoxFit.cover,
        alignment: alignment,
        excludeFromSemantics: true,
      ),
    );
  }
}
