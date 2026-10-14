import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/share/widget_png.dart';

// v1.1.0 plan, task 1: the receipt image is drawn off screen, at its own
// width and at the height its content needs, never from what is on screen.
void main() {
  testWidgets('draws a widget off screen as a PNG of its own size', (
    tester,
  ) async {
    final png = (await tester.runAsync(
      () => paintWidgetToPng(
        const SizedBox(height: 50, child: ColoredBox(color: Color(0xFF00FFC8))),
        width: 100,
      ),
    ))!;

    expect(png.sublist(0, 8), [137, 80, 78, 71, 13, 10, 26, 10]);
    final image = (await tester.runAsync(() async {
      final codec = await ui.instantiateImageCodec(png);
      return (await codec.getNextFrame()).image;
    }))!;
    expect((image.width, image.height), (300, 150));
  });
}
