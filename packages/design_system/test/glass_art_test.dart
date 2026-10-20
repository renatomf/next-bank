import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// The glass art shows another area of the image when asked (v1.1.0 plan,
// task 4.14): the cards don't copy the balance card's crop.
void main() {
  Future<void> pumpArt(WidgetTester tester, GlassArt art) => tester.pumpWidget(
    MaterialApp(home: SizedBox(width: 200, height: 100, child: art)),
  );

  testWidgets('centers the image by default', (tester) async {
    await pumpArt(tester, const GlassArt());

    expect(
      tester.widget<Image>(find.byType(Image)).alignment,
      Alignment.center,
    );
  });

  testWidgets('shows the area asked for', (tester) async {
    await pumpArt(tester, const GlassArt(alignment: Alignment.topRight));

    expect(
      tester.widget<Image>(find.byType(Image)).alignment,
      Alignment.topRight,
    );
  });
}
