import 'package:design_system/design_system.dart';
import 'package:flutter/painting.dart';

/// What the art's mint colorization makes of a white pixel: the brightest
/// color the art can show, wherever it is cropped.
Color brightestArt() {
  const m = GlassArt.mint;
  double channel(int row) =>
      ((m[row * 5] + m[row * 5 + 1] + m[row * 5 + 2]) * 255 + m[row * 5 + 4])
          .clamp(0, 255);
  return Color.fromARGB(
    255,
    channel(0).round(),
    channel(1).round(),
    channel(2).round(),
  );
}
